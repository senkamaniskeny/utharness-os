import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { AppDatabase, type ResourceTable } from "./database.js";
import { AgentRegistry, EventBus, PermissionEngine, SessionManager, TaskEngine } from "./runtime.js";
import { Orchestrator, TeamService, WorkflowService } from "./orchestration.js";
import { TerminalManager } from "./terminal.js";

const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const createSessionSchema = z.object({ agentId: idSchema, cwd: z.string().min(1).max(4096), model: z.string().max(256).optional(), env: z.record(z.string()).optional(), permissions: z.record(z.boolean()).optional() });
const taskSchema = z.object({ title: z.string().min(1).max(256), description: z.string().max(10000).default(""), priority: z.number().int().min(-100).max(100).default(0), teamId: idSchema.optional() });
const updateTaskSchema = z.object({ status: z.enum(["queued", "running", "completed", "failed", "cancelled"]) });
const memorySchema = z.object({ scope: z.string().min(1).max(256), key: z.string().min(1).max(256), value: z.string().max(100000) });
const permissionSchema = z.object({ subject: z.string().min(1).max(256), action: z.string().min(1).max(256), resource: z.string().min(1).max(4096), effect: z.enum(["allow", "deny"]) });
const approvalSchema = z.object({ subject: z.string().min(1).max(256), action: z.string().min(1).max(256), resource: z.string().min(1).max(4096) });

const genericRoutes: Record<string, ResourceTable> = { teams: "teams", workflows: "workflows", models: "models", providers: "providers", mcp: "mcp_servers", memory: "memory", permissions: "permissions", approvals: "approval_requests", terminal: "terminal_sessions", telemetry: "telemetry", audit: "audit_logs", settings: "settings" };

function bodyOf(request: FastifyRequest): unknown { return request.body ?? {}; }
function actorOf(request: FastifyRequest): string { return String(request.headers["x-utharness-actor"] ?? "local-user"); }
function toJson(value: unknown): string { return JSON.stringify(value ?? {}); }

export interface AppContext { app: FastifyInstance; db: AppDatabase; bus: EventBus; registry: AgentRegistry; sessions: SessionManager; tasks: TaskEngine; teams: TeamService; orchestrator: Orchestrator; workflows: WorkflowService; terminal: TerminalManager; }

export async function buildApp(options: { dbFile?: string; logger?: boolean } = {}): Promise<AppContext> {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 1024 * 1024 });
  const db = new AppDatabase(options.dbFile);
  const bus = new EventBus();
  const registry = new AgentRegistry(db, bus);
  const permissions = new PermissionEngine(db);
  const sessions = new SessionManager(db, registry, bus, permissions);
  const tasks = new TaskEngine(db, bus);
  const teams = new TeamService(db, bus);
  const orchestrator = new Orchestrator(db, tasks, bus);
  const workflows = new WorkflowService(db, tasks, bus);
  const terminal = new TerminalManager(db, bus, permissions);
  const nodePtyAvailable = await import("node-pty").then(() => true).catch(() => false);

  await app.register(cors, { origin: false });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request, reply) => { reply.header("x-content-type-options", "nosniff"); reply.header("cache-control", "no-store"); if (request.ip !== "127.0.0.1" && request.ip !== "::1" && process.env.UTHARNESS_ALLOW_REMOTE !== "1") return reply.code(403).send({ error: "Localhost-only server" }); });

  app.get("/api/health", async (_request, reply) => {
    const checks = { node: { healthy: true, version: process.versions.node }, git: { healthy: spawnSync("git", ["--version"], { stdio: "ignore" }).status === 0 }, sqlite: { healthy: db.tableExists("settings") }, pty: { healthy: nodePtyAvailable || process.platform !== "win32", backend: nodePtyAvailable ? "node-pty" : "child_process-fallback" }, websocket: { healthy: true }, database: { healthy: db.tableExists("schema_migrations") }, agentRunner: { healthy: true }, agentDiscovery: { healthy: true }, mcp: { healthy: db.tableExists("mcp_servers") }, modelProviders: { healthy: db.tableExists("providers") }, permissions: { healthy: db.tableExists("permissions") } };
    return reply.send({ status: Object.values(checks).every((check) => check.healthy) ? "healthy" : "degraded", checks, timestamp: db.now() });
  });
  app.get("/api/system", async () => ({ name: "UTHARNESS OS", version: "0.1.0", platform: process.platform, arch: process.arch, node: process.version, pid: process.pid, db: process.env.UTHARNESS_DB ?? "./data/utharness.sqlite" }));

  app.get("/api/agents", async () => ({ agents: db.raw.prepare("SELECT * FROM agents ORDER BY name").all() }));
  app.post("/api/agents/detect", async () => ({ agents: await registry.detectAll() }));
  app.get<{ Params: { id: string } }>("/api/agents/:id", async (request, reply) => { const id = idSchema.safeParse(request.params.id); if (!id.success) return reply.code(400).send({ error: "Invalid agent id" }); const result = db.raw.prepare("SELECT * FROM agents WHERE id=?").get(id.data); return result ? result : reply.code(404).send({ error: "Agent not found" }); });

  app.get("/api/sessions", async () => ({ sessions: sessions.list() }));
  app.post("/api/sessions", async (request, reply) => { const parsed = createSessionSchema.safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid session options", details: parsed.error.flatten() }); try { const options = { cwd: parsed.data.cwd, ...(parsed.data.model === undefined ? {} : { model: parsed.data.model }), ...(parsed.data.env === undefined ? {} : { env: parsed.data.env }), ...(parsed.data.permissions === undefined ? {} : { permissions: parsed.data.permissions }) }; return reply.code(201).send(sessions.create(parsed.data.agentId, options, actorOf(request))); } catch (error) { return reply.code(403).send({ error: error instanceof Error ? error.message : "Unable to create session" }); } });
  app.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => { const row = sessions.get(request.params.id); return row ? row : reply.code(404).send({ error: "Session not found" }); });
  app.post<{ Params: { id: string } }>("/api/sessions/:id/input", async (request, reply) => { const parsed = z.object({ input: z.string().max(100000) }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid input" }); try { sessions.input(request.params.id, parsed.data.input, actorOf(request)); return { ok: true }; } catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : "Unable to send input" }); } });
  app.delete<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => { try { sessions.kill(request.params.id, actorOf(request)); return { ok: true }; } catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : "Unable to stop session" }); } });

  app.get("/api/tasks", async () => ({ tasks: tasks.list() }));
  app.post("/api/tasks", async (request, reply) => { const parsed = taskSchema.safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid task", details: parsed.error.flatten() }); return reply.code(201).send(tasks.create(parsed.data.title, parsed.data.description, parsed.data.priority, parsed.data.teamId)); });
  app.patch<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => { const parsed = updateTaskSchema.safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid task status" }); try { return tasks.update(request.params.id, parsed.data.status); } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : "Task not found" }); } });

  app.post("/api/teams", async (request, reply) => { const parsed = z.object({ name: z.string().min(1).max(256), goal: z.string().min(1).max(10000), agentIds: z.array(idSchema).max(32).optional() }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid team", details: parsed.error.flatten() }); return reply.code(201).send(teams.create(parsed.data)); });
  app.post<{ Params: { id: string } }>("/api/teams/:id/run", async (request, reply) => { try { return await orchestrator.runTeam(request.params.id); } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : "Unable to run team" }); } });
  app.post<{ Params: { id: string } }>("/api/teams/:id/messages", async (request, reply) => { const parsed = z.object({ sender: z.string().min(1).max(256), recipient: z.string().max(256).optional(), content: z.string().min(1).max(100000) }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid team message" }); try { return reply.code(201).send(teams.send(request.params.id, parsed.data.sender, parsed.data.content, parsed.data.recipient)); } catch (error) { return reply.code(404).send({ error: error instanceof Error ? error.message : "Unable to send team message" }); } });
  app.post("/api/workflows", async (request, reply) => { const parsed = z.object({ name: z.string().min(1).max(256), steps: z.array(z.object({ id: idSchema, taskId: idSchema.optional(), dependsOn: z.array(idSchema).optional() })).min(1).max(100) }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid workflow", details: parsed.error.flatten() }); return reply.code(201).send(workflows.create(parsed.data)); });
  app.post<{ Params: { id: string } }>("/api/workflows/:id/run", async (request, reply) => { try { return await workflows.run(request.params.id); } catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : "Unable to run workflow" }); } });
  app.post("/api/models", async (request, reply) => { const parsed = z.object({ name: z.string().min(1).max(256), modelName: z.string().min(1).max(256), providerId: idSchema.optional(), metadata: z.record(z.unknown()).optional() }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid model" }); const row = { id: randomUUID(), name: parsed.data.name, provider_id: parsed.data.providerId ?? null, model_name: parsed.data.modelName, metadata_json: toJson(parsed.data.metadata), }; db.raw.prepare("INSERT INTO models (id,name,provider_id,model_name,metadata_json) VALUES (@id,@name,@provider_id,@model_name,@metadata_json)").run(row); return reply.code(201).send(row); });
  app.post("/api/providers", async (request, reply) => { const parsed = z.object({ name: z.string().min(1).max(256), kind: z.string().min(1).max(128), endpoint: z.string().url().optional() }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid provider" }); const row = { id: randomUUID(), name: parsed.data.name, kind: parsed.data.kind, endpoint: parsed.data.endpoint ?? null, enabled: 1 }; db.raw.prepare("INSERT INTO providers (id,name,kind,endpoint,enabled) VALUES (@id,@name,@kind,@endpoint,@enabled)").run(row); return reply.code(201).send(row); });
  app.post("/api/terminal", async (request, reply) => { const parsed = z.object({ cwd: z.string().min(1).max(4096), shell: z.string().max(4096).optional(), cols: z.number().int().optional(), rows: z.number().int().optional() }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid terminal options" }); try { return reply.code(201).send(terminal.open(parsed.data.cwd, parsed.data.shell, parsed.data.cols, parsed.data.rows, actorOf(request))); } catch (error) { return reply.code(403).send({ error: error instanceof Error ? error.message : "Unable to open terminal" }); } });
  app.post<{ Params: { id: string } }>("/api/terminal/:id/input", async (request, reply) => { const parsed = z.object({ data: z.string().max(100000) }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid terminal input" }); try { terminal.write(request.params.id, parsed.data.data, actorOf(request)); return { ok: true }; } catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : "Unable to write terminal" }); } });
  app.post<{ Params: { id: string } }>("/api/terminal/:id/resize", async (request, reply) => { const parsed = z.object({ cols: z.number().int(), rows: z.number().int() }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid terminal dimensions" }); try { terminal.resize(request.params.id, parsed.data.cols, parsed.data.rows); return { ok: true }; } catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : "Unable to resize terminal" }); } });
  app.delete<{ Params: { id: string } }>("/api/terminal/:id", async (request, reply) => { try { terminal.close(request.params.id, actorOf(request)); return { ok: true }; } catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : "Unable to close terminal" }); } });
  app.post("/api/mcp", async (request, reply) => { const parsed = z.object({ name: z.string().min(1).max(256), transport: z.enum(["stdio", "sse", "http"]), endpoint: z.string().url().optional(), command: z.string().max(4096).optional() }).safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid MCP server" }); const row = { id: randomUUID(), name: parsed.data.name, transport: parsed.data.transport, endpoint: parsed.data.endpoint ?? null, command: parsed.data.command ?? null, enabled: 1, created_at: db.now() }; db.raw.prepare("INSERT INTO mcp_servers (id,name,transport,endpoint,command,enabled,created_at) VALUES (@id,@name,@transport,@endpoint,@command,@enabled,@created_at)").run(row); return reply.code(201).send(row); });

  for (const [path, table] of Object.entries(genericRoutes)) {
    app.get(`/api/${path}`, async (request) => ({ [path]: db.list(table, Number((request.query as { limit?: string }).limit ?? 100)) }));
  }
  app.post("/api/memory", async (request, reply) => { const parsed = memorySchema.safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid memory", details: parsed.error.flatten() }); const now = db.now(); db.raw.prepare("INSERT INTO memory (id,scope,key,value,created_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run(randomUUID(), parsed.data.scope, parsed.data.key, parsed.data.value, now, now); return reply.code(201).send({ scope: parsed.data.scope, key: parsed.data.key, value: parsed.data.value, updated_at: now }); });
  app.post("/api/permissions", async (request, reply) => { const parsed = permissionSchema.safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid permission", details: parsed.error.flatten() }); const row = { id: randomUUID(), ...parsed.data, created_at: db.now() }; db.raw.prepare("INSERT INTO permissions (id,subject,action,resource,effect,created_at) VALUES (@id,@subject,@action,@resource,@effect,@created_at)").run(row); db.raw.prepare("INSERT INTO audit_logs (id,actor,action,resource,outcome,metadata_json,created_at) VALUES (?,?,?,?,?,?,?)").run(randomUUID(), actorOf(request), "permission.create", parsed.data.resource, "success", toJson(row), db.now()); return reply.code(201).send(row); });
  app.post("/api/approvals", async (request, reply) => { const parsed = approvalSchema.safeParse(bodyOf(request)); if (!parsed.success) return reply.code(400).send({ error: "Invalid approval request", details: parsed.error.flatten() }); const row = { id: randomUUID(), ...parsed.data, status: "pending", created_at: db.now() }; db.raw.prepare("INSERT INTO approval_requests (id,subject,action,resource,status,created_at) VALUES (@id,@subject,@action,@resource,@status,@created_at)").run(row); bus.publish("security.request", row); return reply.code(201).send(row); });

  app.get("/api/events", async () => ({ events: db.raw.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT 100").all() }));
  app.setErrorHandler((error, _request, reply) => { app.log.error(error); const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500; return reply.code(statusCode).send({ error: "Internal server error" }); });

  const wss = new WebSocketServer({ noServer: true });
  app.server.on("upgrade", (request, socket, head) => { if (request.url !== "/ws") { socket.destroy(); return; } wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws)); });
  wss.on("connection", (socket) => { socket.send(JSON.stringify({ type: "system.health", payload: { status: "connected" }, at: db.now() })); });
  bus.on("event", (event) => { db.raw.prepare("INSERT INTO events (id,event_type,payload_json,created_at) VALUES (?,?,?,?)").run(randomUUID(), event.type, JSON.stringify(event.payload), event.at); for (const client of wss.clients) if (client.readyState === 1) client.send(JSON.stringify(event)); });

  return { app, db, bus, registry, sessions, tasks, teams, orchestrator, workflows, terminal };
}

const isMain = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");
if (isMain) {
  const host = process.env.UTHARNESS_HOST ?? "127.0.0.1";
  const port = Number(process.env.UTHARNESS_PORT ?? 4317);
  const context = await buildApp({ logger: true });
  await context.app.listen({ host, port });
  context.app.log.info(`UTHARNESS OS backend listening on http://${host}:${port}`);
}
