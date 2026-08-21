import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { agentToolCatalog } from "./agent-tools.js";

const execFileAsync = promisify(execFile);

export type AgentStatus = "unknown" | "available" | "running" | "stopped" | "failed";
export type AgentKind = "cli" | "http" | "library";

export interface AgentDetectionResult {
  detected: boolean;
  executable?: string;
  version?: string;
  source?: string;
  details?: Record<string, unknown>;
}

export interface SessionOptions {
  cwd: string;
  model?: string;
  env?: Record<string, string>;
  permissions?: Record<string, boolean>;
}

export interface AgentSession {
  id: string;
  pid?: number;
  status: AgentStatus;
  cwd: string;
  startedAt: string;
}

export interface UsageStats { inputTokens: number; outputTokens: number; durationMs: number; }

export interface AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  readonly metadata: Record<string, unknown>;
  detect(): Promise<AgentDetectionResult>;
  getVersion(): Promise<string>;
  getCapabilities(): Promise<string[]>;
  startSession(options: SessionOptions): Promise<AgentSession>;
  sendMessage(sessionId: string, message: string): Promise<void>;
  sendInput(sessionId: string, input: string): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  kill(sessionId: string): Promise<void>;
  getStatus(sessionId: string): Promise<AgentStatus>;
  getUsage(sessionId: string): Promise<UsageStats>;
}

export abstract class CliAgentAdapter implements AgentAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly executable: string;
  abstract readonly capabilities: string[];
  readonly metadata: Record<string, unknown> = {};

  async detect(): Promise<AgentDetectionResult> {
    try {
      await access(this.executable);
      return { detected: true, executable: this.executable, version: await this.getVersion(), source: "configured-path" };
    } catch {
      try {
        const { stdout } = await execFileAsync("sh", ["-lc", `command -v -- ${this.executable}`]);
        const executable = stdout.trim();
        if (!executable) return { detected: false, source: "PATH" };
        return { detected: true, executable, version: await this.getVersion(), source: "PATH" };
      } catch {
        return { detected: false, source: "PATH" };
      }
    }
  }

  async getVersion(): Promise<string> {
    try {
      const { stdout, stderr } = await execFileAsync(this.executable, ["--version"], { timeout: 3000 });
      return (stdout || stderr).trim().split("\n")[0] ?? "unknown";
    } catch { return "unknown"; }
  }

  getCapabilities(): Promise<string[]> { return Promise.resolve(this.capabilities); }
  startSession(_options: SessionOptions): Promise<AgentSession> { return Promise.reject(new Error(`${this.name} adapter requires the process manager`)); }
  sendMessage(_sessionId: string, _message: string): Promise<void> { return Promise.reject(new Error("Session transport is owned by the process manager")); }
  sendInput(_sessionId: string, _input: string): Promise<void> { return Promise.reject(new Error("Session transport is owned by the process manager")); }
  cancel(_sessionId: string): Promise<void> { return Promise.reject(new Error("Session transport is owned by the process manager")); }
  kill(_sessionId: string): Promise<void> { return Promise.reject(new Error("Session transport is owned by the process manager")); }
  getStatus(_sessionId: string): Promise<AgentStatus> { return Promise.resolve("unknown"); }
  getUsage(_sessionId: string): Promise<UsageStats> { return Promise.resolve({ inputTokens: 0, outputTokens: 0, durationMs: 0 }); }
}

export class GenericCliAdapter extends CliAgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  readonly capabilities: string[];
  readonly metadata: Record<string, unknown>;
  constructor(id: string, name: string, executable: string, capabilities = ["shell", "streaming-output", "stdin"], metadata: Record<string, unknown> = {}) { super(); this.id = id; this.name = name; this.executable = executable; this.capabilities = capabilities; this.metadata = metadata; }
}

export const builtinAdapters: CliAgentAdapter[] = agentToolCatalog
  .filter((tool) => tool.mode === "cli" && Boolean(tool.executable))
  .map((tool) => new GenericCliAdapter(tool.id, tool.name, tool.executable!, [...tool.capabilities, "streaming-output", "stdin"], { officialUrl: tool.officialUrl, docsUrl: tool.docsUrl, repositoryUrl: tool.repositoryUrl, iconSlug: tool.iconSlug, publisher: tool.publisher }));
