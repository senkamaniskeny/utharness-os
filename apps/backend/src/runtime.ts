import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import * as nodePty from "node-pty";
import { EventEmitter } from "node:events";
import { builtinAdapters, type AgentAdapter, type AgentStatus, type SessionOptions } from "./agents.js";
import { AppDatabase } from "./database.js";

export type RuntimeEvent = { type: string; payload: Record<string, unknown>; at: string };

export class EventBus extends EventEmitter {
  publish(type: string, payload: Record<string, unknown>): RuntimeEvent {
    const event = { type, payload, at: new Date().toISOString() };
    this.emit("event", event);
    this.emit(type, event);
    return event;
  }
}

export class AgentRegistry {
  private readonly adapters = new Map<string, AgentAdapter>(builtinAdapters.filter((a) => Boolean(a.executable)).map((a) => [a.id, a]));
  constructor(private readonly db: AppDatabase, private readonly bus: EventBus) {}

  register(adapter: AgentAdapter): void { this.adapters.set(adapter.id, adapter); }
  get(id: string): AgentAdapter | undefined { return this.adapters.get(id); }
  all(): AgentAdapter[] { return [...this.adapters.values()]; }

  async detectAll(): Promise<Record<string, unknown>[]> {
    const found: Record<string, unknown>[] = [];
    for (const adapter of this.adapters.values()) {
      const detection = await adapter.detect();
      const now = this.db.now();
      this.db.raw.prepare(`INSERT INTO agents (id,name,kind,executable,version,status,capabilities_json,metadata_json,created_at,updated_at)
        VALUES (@id,@name,'cli',@executable,@version,@status,@capabilities,@metadata,@now,@now)
        ON CONFLICT(id) DO UPDATE SET executable=excluded.executable,version=excluded.version,status=excluded.status,capabilities_json=excluded.capabilities_json,metadata_json=excluded.metadata_json,updated_at=excluded.updated_at`).run({
        id: adapter.id, name: adapter.name, executable: detection.executable ?? adapter.executable, version: detection.version ?? null,
        status: detection.detected ? "available" : "unknown", capabilities: JSON.stringify(await adapter.getCapabilities()), metadata: JSON.stringify(adapter.metadata ?? {}), now
      });
      if (detection.detected) {
        this.db.raw.prepare("INSERT OR REPLACE INTO agent_installations (id,agent_id,source,path,version,detected_at) VALUES (?,?,?,?,?,?)").run(randomUUID(), adapter.id, detection.source ?? "unknown", detection.executable ?? adapter.executable, detection.version ?? null, now);
      }
      found.push({ ...detection, id: adapter.id, name: adapter.name });
    }
    this.bus.publish("agent.status", { detected: found.length });
    return found;
  }
}

interface AgentProcess {
  pid: number;
  onData(handler: (data: string) => void): void;
  onExit(handler: (code: number) => void): void;
  write(data: string): void;
  kill(): void;
}

function spawnAgentProcess(executable: string, cwd: string, env?: Record<string, string>): AgentProcess {
  try {
    const terminal = nodePty.spawn(executable, [], { name: "xterm-color", cols: 120, rows: 36, cwd, env: { ...process.env, ...env } as Record<string, string> });
    return { pid: terminal.pid, onData: (handler) => terminal.onData(handler), onExit: (handler) => terminal.onExit(({ exitCode }) => handler(exitCode)), write: (data) => terminal.write(data), kill: () => terminal.kill() };
  } catch {
    const child = spawn(executable, [], { cwd, env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    return { pid: child.pid ?? -1, onData: (handler) => { child.stdout.on("data", (data: Buffer) => handler(data.toString())); child.stderr.on("data", (data: Buffer) => handler(data.toString())); }, onExit: (handler) => child.on("exit", (code) => handler(code ?? 1)), write: (data) => child.stdin.write(data), kill: () => child.kill("SIGTERM") };
  }
}

interface LiveSession { id: string; process: AgentProcess; startedAt: string; cwd: string; agentId: string; }

export class PermissionEngine {
  constructor(private readonly db: AppDatabase) {}
  assertAllowed(subject: string, action: string, resource: string): void {
    const decision = this.db.raw.prepare("SELECT effect FROM permissions WHERE subject=? AND action=? AND resource IN (?, '*') ORDER BY resource DESC LIMIT 1").get(subject, action, resource) as { effect?: string } | undefined;
    if (decision?.effect === "deny") throw new Error(`Permission denied: ${action} on ${resource}`);
    if (decision?.effect === "allow") return;
    if (["shell.execute", "filesystem.write", "network.connect"].includes(action)) throw new Error(`Approval required: ${action}`);
  }
}

export class SessionManager {
  private readonly live = new Map<string, LiveSession>();
  constructor(private readonly db: AppDatabase, private readonly registry: AgentRegistry, private readonly bus: EventBus, private readonly permissions: PermissionEngine) {}

  create(agentId: string, options: SessionOptions, actor = "local-user"): Record<string, unknown> {
    const adapter = this.registry.get(agentId);
    if (!adapter) throw new Error(`Unknown agent: ${agentId}`);
    this.permissions.assertAllowed(actor, "process.start", adapter.executable);
    const id = randomUUID();
    const startedAt = this.db.now();
    const child = spawnAgentProcess(adapter.executable, options.cwd, options.env);
    const row = { id, agent_id: agentId, pid: child.pid || null, cwd: options.cwd, status: "running", assigned_model: options.model ?? null, permissions_json: JSON.stringify(options.permissions ?? {}), started_at: startedAt };
    this.db.raw.prepare(`INSERT INTO sessions (id,agent_id,pid,cwd,status,assigned_model,permissions_json,started_at) VALUES (@id,@agent_id,@pid,@cwd,@status,@assigned_model,@permissions_json,@started_at)`).run(row);
    this.db.raw.prepare("INSERT INTO processes (id,session_id,pid,command,status,started_at) VALUES (?,?,?,?,?,?)").run(randomUUID(), id, child.pid, adapter.executable, "running", startedAt);
    const live: LiveSession = { id, process: child, startedAt, cwd: options.cwd, agentId };
    this.live.set(id, live);
    child.onData((data) => { this.db.raw.prepare("INSERT INTO messages (id,session_id,role,content,created_at) VALUES (?,?,?,?,?)").run(randomUUID(), id, "agent", data, this.db.now()); this.bus.publish("agent.output", { sessionId: id, data }); });
    child.onExit((code) => { this.db.raw.prepare("UPDATE sessions SET status='stopped',ended_at=?,exit_code=? WHERE id=?").run(this.db.now(), code, id); this.db.raw.prepare("UPDATE processes SET status='stopped',ended_at=? WHERE session_id=?").run(this.db.now(), id); this.live.delete(id); this.bus.publish("agent.stopped", { sessionId: id, code }); });
    this.bus.publish("session.created", { sessionId: id, agentId, pid: child.pid });
    return { ...row, status: "running" };
  }

  input(id: string, input: string, actor = "local-user"): void { const session = this.live.get(id); if (!session) throw new Error("Session is not running"); this.permissions.assertAllowed(actor, "process.stdin", id); session.process.write(input); }
  kill(id: string, actor = "local-user"): void { const session = this.live.get(id); if (!session) throw new Error("Session is not running"); this.permissions.assertAllowed(actor, "process.kill", id); session.process.kill(); }
  get(id: string): Record<string, unknown> | undefined { return this.db.raw.prepare("SELECT * FROM sessions WHERE id=?").get(id) as Record<string, unknown> | undefined; }
  list(): Record<string, unknown>[] { return this.db.raw.prepare("SELECT * FROM sessions ORDER BY started_at DESC").all() as Record<string, unknown>[]; }
}

export class TaskEngine {
  constructor(private readonly db: AppDatabase, private readonly bus: EventBus) {}
  create(title: string, description: string, priority = 0, teamId?: string): Record<string, unknown> {
    const now = this.db.now(); const task = { id: randomUUID(), team_id: teamId ?? null, title, description, status: "queued", priority, created_at: now, updated_at: now };
    this.db.raw.prepare("INSERT INTO tasks (id,team_id,title,description,status,priority,created_at,updated_at) VALUES (@id,@team_id,@title,@description,@status,@priority,@created_at,@updated_at)").run(task);
    this.bus.publish("task.created", task); return task;
  }
  list(): Record<string, unknown>[] { return this.db.raw.prepare("SELECT * FROM tasks ORDER BY priority DESC, created_at DESC").all() as Record<string, unknown>[]; }
  update(id: string, status: string): Record<string, unknown> {
    this.db.raw.prepare("UPDATE tasks SET status=?,updated_at=? WHERE id=?").run(status, this.db.now(), id);
    const task = this.db.raw.prepare("SELECT * FROM tasks WHERE id=?").get(id) as Record<string, unknown>;
    if (!task) throw new Error("Task not found"); this.bus.publish(`task.${status}`, task); return task;
  }
}

export function statusForSession(value: unknown): AgentStatus { return ["unknown", "available", "running", "stopped", "failed"].includes(String(value)) ? value as AgentStatus : "unknown"; }
