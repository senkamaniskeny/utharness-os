import { afterEach, describe, expect, it } from "vitest";
import { buildApp, type AppContext } from "../src/server.js";

let context: AppContext | undefined;

afterEach(async () => { if (context) { await context.app.close(); context.db.close(); context = undefined; } });

describe("UTHARNESS backend", () => {
  it("reports a healthy local system and creates schema tables", async () => {
    context = await buildApp({ dbFile: ":memory:" });
    const response = await context.app.inject({ method: "GET", url: "/api/health", remoteAddress: "127.0.0.1" });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("healthy");
    expect(context.db.tableExists("agents")).toBe(true);
    expect(context.db.tableExists("audit_logs")).toBe(true);
  });

  it("validates and persists tasks", async () => {
    context = await buildApp({ dbFile: ":memory:" });
    const invalid = await context.app.inject({ method: "POST", url: "/api/tasks", payload: { title: "" }, remoteAddress: "127.0.0.1" });
    expect(invalid.statusCode).toBe(400);
    const created = await context.app.inject({ method: "POST", url: "/api/tasks", payload: { title: "Verify discovery", description: "Run scanner", priority: 5 }, remoteAddress: "127.0.0.1" });
    expect(created.statusCode).toBe(201);
    const task = created.json();
    expect(task.status).toBe("queued");
    const updated = await context.app.inject({ method: "PATCH", url: `/api/tasks/${task.id}`, payload: { status: "completed" }, remoteAddress: "127.0.0.1" });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().status).toBe("completed");
  });

  it("persists memory and permission decisions", async () => {
    context = await buildApp({ dbFile: ":memory:" });
    const memory = await context.app.inject({ method: "POST", url: "/api/memory", payload: { scope: "test", key: "answer", value: "42" }, remoteAddress: "127.0.0.1" });
    expect(memory.statusCode).toBe(201);
    const permission = await context.app.inject({ method: "POST", url: "/api/permissions", payload: { subject: "local-user", action: "process.start", resource: "echo", effect: "allow" }, remoteAddress: "127.0.0.1" });
    expect(permission.statusCode).toBe(201);
    const audit = await context.app.inject({ method: "GET", url: "/api/audit", remoteAddress: "127.0.0.1" });
    expect(audit.json().audit.length).toBe(1);
  });

  it("executes a team task and publishes mailbox messages", async () => {
    context = await buildApp({ dbFile: ":memory:" });
    const teamResponse = await context.app.inject({ method: "POST", url: "/api/teams", payload: { name: "Core Team", goal: "Ship backend" }, remoteAddress: "127.0.0.1" });
    expect(teamResponse.statusCode).toBe(201);
    const team = teamResponse.json();
    const taskResponse = await context.app.inject({ method: "POST", url: "/api/tasks", payload: { title: "Implement API", teamId: team.id }, remoteAddress: "127.0.0.1" });
    const runResponse = await context.app.inject({ method: "POST", url: `/api/teams/${team.id}/run`, remoteAddress: "127.0.0.1" });
    expect(runResponse.statusCode).toBe(200);
    expect(runResponse.json().tasks[0].status).toBe("completed");
    const messageResponse = await context.app.inject({ method: "POST", url: `/api/teams/${team.id}/messages`, payload: { sender: "leader", content: "Ready" }, remoteAddress: "127.0.0.1" });
    expect(messageResponse.statusCode).toBe(201);
    expect(taskResponse.statusCode).toBe(201);
  });

  it("runs workflow steps in dependency order and registers providers", async () => {
    context = await buildApp({ dbFile: ":memory:" });
    const task = await context.app.inject({ method: "POST", url: "/api/tasks", payload: { title: "Workflow task" }, remoteAddress: "127.0.0.1" });
    const workflow = await context.app.inject({ method: "POST", url: "/api/workflows", payload: { name: "Release", steps: [{ id: "build" }, { id: "test", taskId: task.json().id, dependsOn: ["build"] }] }, remoteAddress: "127.0.0.1" });
    const run = await context.app.inject({ method: "POST", url: `/api/workflows/${workflow.json().id}/run`, remoteAddress: "127.0.0.1" });
    expect(run.statusCode).toBe(200);
    expect(run.json().status).toBe("completed");
    const provider = await context.app.inject({ method: "POST", url: "/api/providers", payload: { name: "Local", kind: "ollama", endpoint: "http://127.0.0.1:11434" }, remoteAddress: "127.0.0.1" });
    expect(provider.statusCode).toBe(201);
  });

  it("rejects non-local requests by default", async () => {
    context = await buildApp({ dbFile: ":memory:" });
    const response = await context.app.inject({ method: "GET", url: "/api/health", remoteAddress: "10.0.0.2" });
    expect(response.statusCode).toBe(403);
  });
});
