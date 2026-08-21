#!/usr/bin/env node
const baseUrl = process.env.UTHARNESS_URL ?? "http://127.0.0.1:4317";
const [command = "doctor", subcommand] = process.argv.slice(2);

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json() as unknown;
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main(): Promise<void> {
  if (command === "server") {
    const { spawn } = await import("node:child_process");
    const child = spawn("pnpm", ["--filter", "@utharness/backend", "dev"], { stdio: "inherit", detached: false });
    child.on("exit", (code) => process.exit(code ?? 0));
    return;
  }
  if (command === "agents" && subcommand === "scan") { console.log(JSON.stringify(await api("/api/agents/detect", { method: "POST" }), null, 2)); return; }
  if (command === "agents") { console.log(JSON.stringify(await api("/api/agents"), null, 2)); return; }
  if (command === "tasks") { console.log(JSON.stringify(await api("/api/tasks"), null, 2)); return; }
  if (command === "doctor" || command === "setup") { console.log(JSON.stringify(await api("/api/health"), null, 2)); return; }
  if (["team", "models", "mcp", "workflows", "tui", "update", "repair"].includes(command)) { console.log(JSON.stringify(await api(`/api/${command === "team" ? "teams" : command}`), null, 2)); return; }
  console.error("Usage: utharness [setup|server|agents [scan]|tasks|team|models|mcp|workflows|doctor|tui|update|repair]"); process.exitCode = 2;
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
