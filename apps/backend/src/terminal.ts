import { randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { AppDatabase } from "./database.js";
import { EventBus, PermissionEngine } from "./runtime.js";

type TerminalBackend = {
  onData(handler: (data: string) => void): void;
  onExit(handler: (event: { exitCode: number }) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
};

interface LiveTerminal { id: string; terminal: TerminalBackend; }

function childProcessBackend(child: ChildProcessWithoutNullStreams): TerminalBackend {
  return { onData: (handler) => child.stdout.on("data", (data: Buffer) => handler(data.toString())), onExit: (handler) => child.on("exit", (code) => handler({ exitCode: code ?? 1 })), write: (data) => child.stdin.write(data), resize: () => undefined, kill: () => child.kill("SIGTERM") };
}

async function createBackend(shell: string, cwd: string, cols: number, rows: number): Promise<TerminalBackend> {
  try {
    const module = await import("node-pty");
    return module.spawn(shell, [], { name: "xterm-color", cols, rows, cwd, env: process.env as Record<string, string> });
  } catch {
    return childProcessBackend(spawn(shell, [], { cwd, env: process.env, stdio: ["pipe", "pipe", "pipe"] }));
  }
}

export class TerminalManager {
  private readonly live = new Map<string, LiveTerminal>();
  constructor(private readonly db: AppDatabase, private readonly bus: EventBus, private readonly permissions: PermissionEngine) {}

  async open(cwd: string, requestedShell = process.env.SHELL ?? "/bin/sh", cols = 120, rows = 36, actor = "local-user"): Promise<Record<string, unknown>> {
    const directory = realpathSync(cwd);
    if (!statSync(directory).isDirectory()) throw new Error("Terminal cwd must be a directory");
    const shell = realpathSync(join("/", requestedShell.replace(/^\/+/, "")));
    this.permissions.assertAllowed(actor, "terminal.open", directory);
    const id = randomUUID(); const createdAt = this.db.now();
    const terminal = await createBackend(shell, directory, Math.min(Math.max(cols, 20), 300), Math.min(Math.max(rows, 5), 120));
    this.live.set(id, { id, terminal });
    this.db.raw.prepare("INSERT INTO terminal_sessions (id,cwd,shell,status,created_at) VALUES (?,?,?,?,?)").run(id, directory, shell, "running", createdAt);
    terminal.onData((data) => this.bus.publish("terminal.output", { terminalId: id, data }));
    terminal.onExit(({ exitCode }) => { this.db.raw.prepare("UPDATE terminal_sessions SET status='stopped',ended_at=? WHERE id=?").run(this.db.now(), id); this.live.delete(id); this.bus.publish("terminal.exit", { terminalId: id, exitCode }); });
    return { id, cwd: directory, shell, status: "running", created_at: createdAt };
  }

  write(id: string, data: string, actor = "local-user"): void { const live = this.live.get(id); if (!live) throw new Error("Terminal is not running"); this.permissions.assertAllowed(actor, "terminal.input", id); if (data.length > 100000) throw new Error("Terminal input too large"); live.terminal.write(data); }
  resize(id: string, cols: number, rows: number): void { const live = this.live.get(id); if (!live) throw new Error("Terminal is not running"); live.terminal.resize(Math.min(Math.max(cols, 20), 300), Math.min(Math.max(rows, 5), 120)); }
  close(id: string, actor = "local-user"): void { const live = this.live.get(id); if (!live) throw new Error("Terminal is not running"); this.permissions.assertAllowed(actor, "terminal.close", id); live.terminal.kill(); }
}
