import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { agentToolMap, type AgentToolDefinition, type InstallerKind } from "./agent-tools.js";
import type { AppDatabase } from "./database.js";
import type { EventBus } from "./runtime.js";

export interface InstallJobRecord {
  id: string;
  tool_id: string;
  status: "queued" | "running" | "completed" | "failed";
  command_json: string;
  output: string;
  exit_code: number | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

interface InstallerCommand { command: string; args: string[]; kind: InstallerKind; }

function commandFor(tool: AgentToolDefinition): InstallerCommand | null {
  const packageName = tool.installer.packageName;
  if (!packageName) return null;
  if (tool.installer.kind === "npm") return { command: "npm", args: ["install", "--global", packageName], kind: "npm" };
  if (tool.installer.kind === "python") return { command: "python3", args: ["-m", "pip", "install", "--user", packageName], kind: "python" };
  return null;
}

export class AgentInstaller {
  private readonly live = new Map<string, ChildProcess>();
  constructor(private readonly db: AppDatabase, private readonly bus: EventBus) {}

  list(limit = 100): InstallJobRecord[] {
    return this.db.raw.prepare("SELECT * FROM agent_install_jobs ORDER BY created_at DESC LIMIT ?").all(Math.min(Math.max(limit, 1), 100)) as InstallJobRecord[];
  }

  get(id: string): InstallJobRecord | undefined {
    return this.db.raw.prepare("SELECT * FROM agent_install_jobs WHERE id=?").get(id) as InstallJobRecord | undefined;
  }

  start(toolId: string): InstallJobRecord {
    const tool = agentToolMap.get(toolId);
    if (!tool) throw new Error("Unknown catalog tool");
    const command = commandFor(tool);
    if (!command) throw new Error(`${tool.name} requires manual setup from its official source`);
    const id = randomUUID();
    const createdAt = this.db.now();
    const queued: InstallJobRecord = { id, tool_id: tool.id, status: "queued", command_json: JSON.stringify(command), output: "", exit_code: null, error: null, created_at: createdAt, started_at: null, ended_at: null };
    this.db.raw.prepare("INSERT INTO agent_install_jobs (id,tool_id,status,command_json,output,created_at) VALUES (@id,@tool_id,@status,@command_json,@output,@created_at)").run(queued);
    this.bus.publish("agent.install.queued", { jobId: id, toolId: tool.id, command: command.command, args: command.args });
    const child = spawn(command.command, command.args, { cwd: process.cwd(), env: { ...process.env, CI: process.env.CI ?? "1" }, stdio: ["ignore", "pipe", "pipe"] });
    this.live.set(id, child);
    const startedAt = this.db.now();
    this.db.raw.prepare("UPDATE agent_install_jobs SET status='running',started_at=? WHERE id=?").run(startedAt, id);
    this.bus.publish("agent.install.started", { jobId: id, toolId: tool.id, pid: child.pid ?? null });
    const append = (data: Buffer): void => {
      const chunk = data.toString();
      const row = this.get(id);
      const output = `${row?.output ?? ""}${chunk}`.slice(-200_000);
      this.db.raw.prepare("UPDATE agent_install_jobs SET output=? WHERE id=?").run(output, id);
      this.bus.publish("agent.install.output", { jobId: id, toolId: tool.id, data: chunk });
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => this.finish(id, tool, 1, error.message));
    child.on("close", (code) => this.finish(id, tool, code ?? 1, code === 0 ? null : `Installer exited with code ${code ?? 1}`));
    return this.get(id) ?? queued;
  }

  stop(id: string): void {
    const child = this.live.get(id);
    if (!child) throw new Error("Installation job is not running");
    child.kill("SIGTERM");
  }

  private finish(id: string, tool: AgentToolDefinition, code: number, error: string | null): void {
    if (!this.live.has(id)) return;
    this.live.delete(id);
    const endedAt = this.db.now();
    const status = code === 0 ? "completed" : "failed";
    this.db.raw.prepare("UPDATE agent_install_jobs SET status=?,exit_code=?,error=?,ended_at=? WHERE id=?").run(status, code, error, endedAt, id);
    this.bus.publish(`agent.install.${status}`, { jobId: id, toolId: tool.id, exitCode: code, error });
  }
}
