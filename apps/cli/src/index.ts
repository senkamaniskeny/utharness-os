#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version?: string };
const version = packageJson.version ?? "0.1.0";
const baseUrl = process.env.UTHARNESS_URL ?? "http://127.0.0.1:4317";
const [rawCommand = "doctor", subcommand] = process.argv.slice(2);
const command = rawCommand.toLowerCase();

const usage = `UTHARNESS OS ${version}

Usage:
  utharness-os <command>
  utharness <command>

Commands:
  help                 Show this help message
  version              Show the installed CLI version
  doctor               Check backend health
  status               Show backend health and runtime status
  config               Show local CLI configuration (secrets excluded)
  setup                Check backend health before first use
  agents               List registered agents
  agents scan         Detect agents available on PATH
  tasks                List tracked tasks
  team                 List teams
  models               List configured models
  mcp                  List MCP registrations
  workflows            List workflows
  server               Start the local backend from a workspace checkout

Environment:
  UTHARNESS_URL        Backend URL (default: ${baseUrl})
  UTHARNESS_DB         Local SQLite path used by the backend
`;

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as unknown;
  if (!response.ok)
    throw new Error(`${response.status}: ${JSON.stringify(body)}`);
  return body;
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printConfig(): void {
  const websocketUrl =
    process.env.UTHARNESS_WS_URL ?? baseUrl.replace(/^http/, "ws") + "/ws";
  print({
    apiBaseUrl: baseUrl,
    websocketUrl,
    database: process.env.UTHARNESS_DB ?? "data/utharness.sqlite",
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    secrets: "environment-only; values omitted",
  });
}

async function main(): Promise<void> {
  if (["help", "--help", "-h"].includes(command)) {
    console.log(usage);
    return;
  }
  if (["version", "--version", "-v"].includes(command)) {
    console.log(version);
    return;
  }
  if (command === "config") {
    printConfig();
    return;
  }
  if (command === "server") {
    const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const child = spawn(
      packageManager,
      ["--filter", "@utharness/backend", "dev"],
      { stdio: "inherit", detached: false },
    );
    child.on("exit", (code) => process.exit(code ?? 0));
    return;
  }
  if (command === "agents" && subcommand === "scan") {
    print(await api("/api/agents/detect", { method: "POST" }));
    return;
  }
  if (command === "agents") {
    print(await api("/api/agents"));
    return;
  }
  if (command === "tasks") {
    print(await api("/api/tasks"));
    return;
  }
  if (command === "doctor" || command === "setup") {
    print(await api("/api/health"));
    return;
  }
  if (command === "status") {
    print({
      health: await api("/api/health"),
      system: await api("/api/system"),
    });
    return;
  }
  if (command === "team") {
    print(await api("/api/teams"));
    return;
  }
  if (command === "models") {
    print(await api("/api/models"));
    return;
  }
  if (command === "mcp") {
    print(await api("/api/mcp"));
    return;
  }
  if (command === "workflows") {
    print(await api("/api/workflows"));
    return;
  }
  console.error(usage);
  process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
