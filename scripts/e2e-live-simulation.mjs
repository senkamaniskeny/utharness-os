import assert from "node:assert/strict";
import wsPackage from "../apps/backend/node_modules/ws/index.js";
const { WebSocket } = wsPackage;

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4527";
const wsUrl = base.replace(/^http/, "ws") + "/ws";
const actorHeaders = { "content-type": "application/json", "x-utharness-actor": "local-user" };
const events = [];

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { accept: "application/json", ...(options.body ? actorHeaders : {}) , ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} ${response.status}: ${JSON.stringify(body)}`);
  return body;
}
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function waitForEvent(type, timeout = 5000) { const start = Date.now(); return new Promise((resolve, reject) => { const tick = () => { const found = events.find((event) => event.type === type); if (found) return resolve(found); if (Date.now() - start > timeout) return reject(new Error(`Timed out waiting for ${type}`)); setTimeout(tick, 50); }; tick(); }); }
function waitForCount(type, expected, timeout = 5000) { const start = Date.now(); return new Promise((resolve, reject) => { const tick = () => { const found = events.filter((event) => event.type === type); if (found.length >= expected) return resolve(found); if (Date.now() - start > timeout) return reject(new Error(`Timed out waiting for ${expected} ${type} events`)); setTimeout(tick, 50); }; tick(); }); }
async function openStream() { const socket = new WebSocket(wsUrl); await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); }); socket.on("message", (data) => { try { events.push(JSON.parse(data.toString())); } catch { /* invalid stream frame is ignored by the test listener */ } }); await waitForEvent("system.health"); return socket; }
async function postPermission(action, resource) { return request("/api/permissions", { method: "POST", body: JSON.stringify({ subject: "local-user", action, resource, effect: "allow" }) }); }
async function createTask(title, description, priority, teamId) { return request("/api/tasks", { method: "POST", body: JSON.stringify({ title, description, priority, ...(teamId ? { teamId } : {}) }) }); }
function count(type) { return events.filter((event) => event.type === type).length; }

const result = { base, startedAt: new Date().toISOString(), checks: [], events: {}, entities: {} };
function check(name, value) { assert.ok(value, name); result.checks.push(name); }

const health = await request("/api/health");
check("backend health is healthy", health.status === "healthy");
check("websocket capability is healthy", health.checks.websocket.healthy === true);
const system = await request("/api/system");
check("system identity is UTHARNESS OS", system.name === "UTHARNESS OS");

const socket = await openStream();
check("websocket handshake delivered", count("system.health") >= 1);

await postPermission("process.start", "/bin/cat");
await postPermission("process.stdin", "*");
await postPermission("process.kill", "*");
await postPermission("terminal.open", "/home/ubuntu/utharness-os");
await postPermission("terminal.input", "*");
await postPermission("terminal.close", "*");

const detection = await request("/api/agents/detect", { method: "POST" });
const agents = await request("/api/agents");
check("three fixture agents detected", detection.agents.filter((agent) => agent.id.startsWith("fixture-") && agent.detected).length === 3);
check("agent registry persisted", agents.agents.some((agent) => agent.id === "fixture-architect") && agents.agents.some((agent) => agent.id === "fixture-reviewer"));
result.entities.agents = agents.agents.filter((agent) => agent.id.startsWith("fixture-"));
await waitForEvent("agent.status");

const architectSession = await request("/api/sessions", { method: "POST", body: JSON.stringify({ agentId: "fixture-architect", cwd: "/home/ubuntu/utharness-os", permissions: { shell: true } }) });
const implementerSession = await request("/api/sessions", { method: "POST", body: JSON.stringify({ agentId: "fixture-implementer", cwd: "/home/ubuntu/utharness-os", permissions: { shell: true } }) });
check("parallel agent sessions created", architectSession.status === "running" && implementerSession.status === "running");
await request(`/api/sessions/${architectSession.id}/input`, { method: "POST", body: JSON.stringify({ input: "architect: plan ready\\n" }) });
await request(`/api/sessions/${implementerSession.id}/input`, { method: "POST", body: JSON.stringify({ input: "implementer: change ready\\n" }) });
await waitForEvent("agent.output");
result.entities.sessions = [architectSession, implementerSession];

const team = await request("/api/teams", { method: "POST", body: JSON.stringify({ name: "E2E Agent Council", goal: "Coordinate architecture, implementation, and review", agentIds: ["fixture-architect", "fixture-implementer", "fixture-reviewer"] }) });
result.entities.team = team;
await waitForEvent("team.created");
const planTask = await createTask("Architect the integration scenario", "Produce a plan for the fixture swarm.", 10, team.id);
const buildTask = await createTask("Implement the integration scenario", "Execute the plan and publish a change.", 8, team.id);
const reviewTask = await createTask("Review the integration scenario", "Validate the implementation and telemetry.", 6, team.id);
const teamMessage = await request(`/api/teams/${team.id}/messages`, { method: "POST", body: JSON.stringify({ sender: "fixture-architect", recipient: "fixture-implementer", content: "Plan ready: implement the fixture workflow and report telemetry." }) });
check("team mailbox message persisted", teamMessage.team_id === team.id && teamMessage.recipient === "fixture-implementer");
await waitForEvent("team.message");
const teamRun = await request(`/api/teams/${team.id}/run`, { method: "POST" });
check("team run completed", teamRun.status === "completed" && teamRun.tasks.length === 3);
check("team tasks completed", [planTask.id, buildTask.id, reviewTask.id].every((id) => teamRun.tasks.some((task) => task.id === id && task.status === "completed")));
result.entities.teamRun = teamRun;

const workflowPlan = await createTask("Workflow plan", "DAG plan step", 5);
const workflowBuild = await createTask("Workflow build", "DAG build step", 4);
const workflowReview = await createTask("Workflow review", "DAG review step", 3);
const workflow = await request("/api/workflows", { method: "POST", body: JSON.stringify({ name: "E2E dependency workflow", steps: [{ id: "plan", taskId: workflowPlan.id }, { id: "build", taskId: workflowBuild.id, dependsOn: ["plan"] }, { id: "review", taskId: workflowReview.id, dependsOn: ["build"] }] }) });
const workflowRun = await request(`/api/workflows/${workflow.id}/run`, { method: "POST" });
check("workflow DAG completed", workflowRun.status === "completed");
check("workflow dependency steps completed", JSON.parse(workflowRun.output_json).length === 3);
result.entities.workflow = workflow;
result.entities.workflowRun = workflowRun;

const failedTask = await createTask("Failure path", "Intentional failed state", 2);
const failed = await request(`/api/tasks/${failedTask.id}`, { method: "PATCH", body: JSON.stringify({ status: "failed" }) });
const recoveryTask = await createTask("Recovery path", "Retry after failure", 2);
await request(`/api/tasks/${recoveryTask.id}`, { method: "PATCH", body: JSON.stringify({ status: "running" }) });
const recovered = await request(`/api/tasks/${recoveryTask.id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
check("failed task state persisted", failed.status === "failed");
check("recovery task completed", recovered.status === "completed");

const terminal = await request("/api/terminal", { method: "POST", body: JSON.stringify({ cwd: "/home/ubuntu/utharness-os", shell: "/bin/sh", cols: 100, rows: 30 }) });
await request(`/api/terminal/${terminal.id}/resize`, { method: "POST", body: JSON.stringify({ cols: 120, rows: 36 }) });
await request(`/api/terminal/${terminal.id}/input`, { method: "POST", body: JSON.stringify({ data: "printf 'terminal: telemetry ready\\n'\\n" }) });
await waitForEvent("terminal.output");
await request(`/api/terminal/${terminal.id}`, { method: "DELETE" });
await waitForCount("terminal.exit", 1);
const terminalRows = await request("/api/terminal");
check("terminal lifecycle emitted output", count("terminal.output") >= 1);
check("terminal lifecycle persisted stopped state", terminalRows.terminal.some((row) => row.id === terminal.id && row.status === "stopped"));
result.entities.terminal = terminal;
result.entities.terminalFinal = terminalRows.terminal.find((row) => row.id === terminal.id);

await request(`/api/sessions/${architectSession.id}`, { method: "DELETE" });
await request(`/api/sessions/${implementerSession.id}`, { method: "DELETE" });
await waitForCount("agent.stopped", 2);

const persistedTasks = await request("/api/tasks");
const persistedEvents = await request("/api/events");
check("tasks persisted after workflow", persistedTasks.tasks.some((task) => task.id === recoveryTask.id && task.status === "completed"));
check("event history persisted", persistedEvents.events.length >= 20);
for (const type of ["agent.status", "session.created", "agent.output", "team.created", "team.message", "task.created", "task.completed", "workflow.started", "workflow.step", "workflow.completed", "terminal.output"]) check(`live event ${type}`, count(type) > 0);

result.events = Object.fromEntries([...new Set(events.map((event) => event.type))].map((type) => [type, count(type)]));
result.finishedAt = new Date().toISOString();
console.log(JSON.stringify(result, null, 2));
socket.close();
