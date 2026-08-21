import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const TABLES = [
  "agents", "agent_installations", "agent_capabilities", "sessions", "messages", "events",
  "teams", "team_members", "tasks", "task_dependencies", "mailbox_messages", "workspaces",
  "workflows", "workflow_runs", "memory", "skills", "mcp_servers", "models", "providers",
  "permissions", "approval_requests", "terminal_sessions", "processes", "telemetry", "audit_logs",
  "checkpoints", "settings"
] as const;

export type ResourceTable = typeof TABLES[number];

const schema = `
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, executable TEXT NOT NULL,
  version TEXT, status TEXT NOT NULL DEFAULT 'unknown', capabilities_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_installations (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, source TEXT NOT NULL, path TEXT NOT NULL,
  version TEXT, detected_at TEXT NOT NULL, FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS agent_capabilities (agent_id TEXT NOT NULL, capability TEXT NOT NULL, PRIMARY KEY(agent_id, capability));
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, pid INTEGER, cwd TEXT NOT NULL, status TEXT NOT NULL,
  assigned_model TEXT, permissions_json TEXT NOT NULL DEFAULT '{}', started_at TEXT NOT NULL,
  ended_at TEXT, exit_code INTEGER, FOREIGN KEY(agent_id) REFERENCES agents(id)
);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, session_id TEXT, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, goal TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS team_members (team_id TEXT NOT NULL, agent_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(team_id, agent_id));
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, team_id TEXT, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0, assigned_agent_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS task_dependencies (task_id TEXT NOT NULL, depends_on_task_id TEXT NOT NULL, PRIMARY KEY(task_id, depends_on_task_id));
CREATE TABLE IF NOT EXISTS mailbox_messages (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, sender TEXT NOT NULL, recipient TEXT, content TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT);
CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workflows (id TEXT PRIMARY KEY, name TEXT NOT NULL, definition_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workflow_runs (id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, status TEXT NOT NULL, output_json TEXT NOT NULL DEFAULT '{}', started_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE IF NOT EXISTS memory (id TEXT PRIMARY KEY, scope TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(scope, key));
CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, command TEXT, enabled INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS mcp_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, transport TEXT NOT NULL, endpoint TEXT, command TEXT, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, name TEXT NOT NULL, provider_id TEXT, model_name TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS providers (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, endpoint TEXT, enabled INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS permissions (id TEXT PRIMARY KEY, subject TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL, effect TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS approval_requests (id TEXT PRIMARY KEY, subject TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS terminal_sessions (id TEXT PRIMARY KEY, session_id TEXT, cwd TEXT NOT NULL, shell TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE IF NOT EXISTS processes (id TEXT PRIMARY KEY, session_id TEXT, pid INTEGER NOT NULL, command TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE IF NOT EXISTS telemetry (id TEXT PRIMARY KEY, name TEXT NOT NULL, value REAL NOT NULL, labels_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL, outcome TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS checkpoints (id TEXT PRIMARY KEY, session_id TEXT, name TEXT NOT NULL, state_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL);
`;

export class AppDatabase {
  readonly raw: Database.Database;
  readonly orm: ReturnType<typeof drizzle>;

  constructor(filename = process.env.UTHARNESS_DB ?? "./data/utharness.sqlite") {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.raw = new Database(filename);
    this.raw.pragma("journal_mode = WAL");
    this.raw.pragma("foreign_keys = ON");
    this.raw.pragma("busy_timeout = 5000");
    this.raw.exec(schema);
    this.raw.prepare("INSERT OR IGNORE INTO schema_migrations (id, name, applied_at) VALUES (1, ?, ?)").run("initial-schema", new Date().toISOString());
    this.orm = drizzle(this.raw);
  }

  now(): string { return new Date().toISOString(); }

  close(): void { this.raw.close(); }

  tableExists(table: string): boolean {
    return Boolean(this.raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
  }

  list(table: ResourceTable, limit = 100): Record<string, unknown>[] {
    if (!TABLES.includes(table)) throw new Error(`Unsupported table: ${table}`);
    return this.raw.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT ?`).all(Math.min(Math.max(limit, 1), 500)) as Record<string, unknown>[];
  }
}

export { TABLES };
