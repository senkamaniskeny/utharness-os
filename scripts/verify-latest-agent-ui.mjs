import wsPackage from "../apps/backend/node_modules/ws/index.js";
const { WebSocket } = wsPackage;

const base = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:4691";
const checks = [];
function check(name, value) { if (!value) throw new Error(`FAILED: ${name}`); checks.push(name); }
async function request(path, options) { const response = await fetch(`${base}${path}`, options); const body = await response.json().catch(() => undefined); if (!response.ok) throw new Error(`${options?.method ?? "GET"} ${path} ${response.status}: ${JSON.stringify(body)}`); return body; }

const health = await request("/api/health");
check("health is healthy", health.status === "healthy");
check("all health checks are healthy", Object.values(health.checks).every((item) => item.healthy));
const all = await request("/api/agent-tools");
check("catalog exposes 50 tools", all.tools.length === 50);
check("catalog contains Codex", all.tools.some((tool) => tool.id === "codex"));
const cli = await request("/api/agent-tools?mode=cli");
check("local CLI filter returns only cli tools", cli.tools.length === 27 && cli.tools.every((tool) => tool.mode === "cli"));
const framework = await request("/api/agent-tools?mode=framework");
check("framework filter returns only frameworks", framework.tools.length > 0 && framework.tools.every((tool) => tool.mode === "framework"));
const search = await request("/api/agent-tools?q=Codex");
check("search filter returns Codex only", search.tools.length === 1 && search.tools[0].id === "codex");
await request("/api/agent-tools/claude-code/select", { method: "POST" });
const selectedClaude = await request("/api/agent-tools?q=Claude");
check("selection persists for Claude Code", selectedClaude.selectedToolId === "claude-code");
await request("/api/agent-tools/codex/select", { method: "POST" });
const selectedCodex = await request("/api/agent-tools?q=Codex");
check("selection restores to Codex", selectedCodex.selectedToolId === "codex");

const events = [];
const ws = new WebSocket(base.replace(/^http/, "ws") + "/ws");
ws.on("message", (data) => { try { events.push(JSON.parse(data.toString())); } catch {} });
await new Promise((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
await new Promise((resolve) => setTimeout(resolve, 150));
check("WebSocket handshake is open", events.some((event) => event.type === "system.health"));
const chat = await request("/api/agent-tools/codex/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cwd: "/home/ubuntu/utharness-os", message: "Reply READY, then wait." }) });
check("Codex chat session opens", chat.session?.status === "running" && Boolean(chat.session?.id));
await new Promise((resolve) => setTimeout(resolve, 2500));
const session = await request(`/api/sessions/${chat.session.id}`);
const sessionEvents = events.filter((event) => event.payload?.sessionId === chat.session.id);
check("PTY output has no stdin terminal error", !sessionEvents.some((event) => event.type === "agent.error" && String(event.payload?.data).includes("stdin is not a terminal")));
await request(`/api/sessions/${chat.session.id}`, { method: "DELETE" });
await new Promise((resolve) => setTimeout(resolve, 300));
const stopped = await request(`/api/sessions/${chat.session.id}`);
check("Codex chat session stops cleanly", stopped.status === "stopped");
ws.close();
console.log(JSON.stringify({ passed: checks.length, checks, sessionStatus: session.status, stoppedStatus: stopped.status, outputEvents: sessionEvents.filter((event) => event.type === "agent.output").length }, null, 2));
