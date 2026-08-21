export type ApiResource =
  | "agents"
  | "sessions"
  | "tasks"
  | "teams"
  | "workflows"
  | "models"
  | "providers"
  | "mcp"
  | "memory"
  | "permissions"
  | "approvals"
  | "terminal"
  | "telemetry"
  | "audit"
  | "settings";

export interface HealthResponse {
  status: "healthy" | "degraded";
  checks: Record<string, { healthy: boolean; [key: string]: unknown }>;
  timestamp: string;
}

export interface SystemResponse {
  name: string;
  version: string;
  platform: string;
  arch: string;
  node: string;
  pid: number;
  db: string;
}

export interface AgentRecord {
  id: string;
  name: string;
  kind: string;
  executable: string;
  version: string | null;
  status: string;
  capabilities_json: string;
  metadata_json?: string;
}

export type AgentToolMode = "cli" | "editor" | "framework" | "service" | "hosted";
export interface AgentToolInstaller { kind: "npm" | "python" | "manual" | "none"; packageName?: string; executable?: string; note?: string; }
export interface AgentToolRecord { id: string; name: string; publisher: string; mode: AgentToolMode; description: string; officialUrl: string; docsUrl?: string; repositoryUrl?: string; executable?: string; iconSlug: string; capabilities: string[]; installer: AgentToolInstaller; installed: boolean; detected: boolean; detectedExecutable: string | null; detectedVersion: string | null; latestInstall: InstallJobRecord | null; }
export interface InstallJobRecord { id: string; tool_id: string; status: "queued" | "running" | "completed" | "failed"; command_json: string; output: string; exit_code: number | null; error: string | null; created_at: string; started_at: string | null; ended_at: string | null; }
export interface AgentChatResponse { tool: AgentToolRecord; session: SessionRecord; }

export interface SessionRecord {
  id: string;
  agent_id: string;
  pid: number | null;
  cwd: string;
  status: string;
  assigned_model: string | null;
  permissions_json: string;
  started_at: string;
  ended_at: string | null;
  exit_code: number | null;
}

export interface TaskRecord {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  created_at: string;
  updated_at: string;
  team_id: string | null;
  assigned_agent_id?: string | null;
}

export interface TeamRecord { id: string; name: string; goal: string; status: string; created_at: string; }
export interface TeamMemberRecord { team_id: string; agent_id: string; role: string; }
export interface MailboxMessageRecord { id: string; team_id: string; sender: string; recipient: string | null; content: string; created_at: string; read_at?: string | null; }
export interface WorkflowRecord { id: string; name: string; definition_json: string; created_at: string; updated_at: string; }
export interface WorkflowRunRecord { id: string; workflow_id: string; status: string; output_json: string; started_at: string; ended_at: string | null; }
export interface MemoryRecord { id: string; scope: string; key: string; value: string; created_at: string; updated_at: string; }
export interface McpServerRecord { id: string; name: string; transport: string; endpoint: string | null; command: string | null; enabled: number; created_at: string; }
export interface ModelRecord { id: string; name: string; provider_id: string | null; model_name: string; metadata_json: string; }
export interface ProviderRecord { id: string; name: string; kind: string; endpoint: string | null; enabled: number; }
export interface PermissionRecord { id: string; subject: string; action: string; resource: string; effect: string; created_at: string; }
export interface ApprovalRecord { id: string; subject: string; action: string; resource: string; status: string; created_at: string; resolved_at: string | null; }
export interface TerminalRecord { id: string; session_id: string | null; cwd: string; shell: string; status: string; created_at: string; ended_at: string | null; }
export interface AuditRecord { id: string; actor: string; action: string; resource: string; outcome: string; metadata_json: string; created_at: string; }

export interface EventEnvelope { type: string; payload: Record<string, unknown>; at: string; }
export type ConnectionState = "connecting" | "open" | "closed" | "error";
export interface FrontendRuntimeConfig { apiBaseUrl: string; websocketUrl: string; }

export function getRuntimeConfig(overrides: Partial<FrontendRuntimeConfig> = {}): FrontendRuntimeConfig {
  const globalConfig = (globalThis as { UTHARNESS_CONFIG?: Partial<FrontendRuntimeConfig> }).UTHARNESS_CONFIG ?? {};
  const apiBaseUrl = overrides.apiBaseUrl || globalConfig.apiBaseUrl || "http://127.0.0.1:4317";
  const websocketUrl = overrides.websocketUrl || globalConfig.websocketUrl || apiBaseUrl.replace(/^http/, "ws") + "/ws";
  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), websocketUrl };
}

export class UtharnessApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  constructor(message: string, status: number, details: unknown) { super(message); this.name = "UtharnessApiError"; this.status = status; this.details = details; }
}

export class UtharnessClient {
  readonly config: FrontendRuntimeConfig;
  constructor(config: Partial<FrontendRuntimeConfig> = {}) { this.config = getRuntimeConfig(config); }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
      ...init,
      headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    });
    const body = await response.json().catch(() => undefined) as T & { error?: string } | undefined;
    if (!response.ok) throw new UtharnessApiError(body?.error ?? `Request failed with ${response.status}`, response.status, body);
    return body as T;
  }

  health(): Promise<HealthResponse> { return this.request("/api/health"); }
  system(): Promise<SystemResponse> { return this.request("/api/system"); }
  agents(): Promise<{ agents: AgentRecord[] }> { return this.request("/api/agents"); }
  detectAgents(): Promise<{ agents: Array<AgentRecord & { detected: boolean; source?: string }> }> { return this.request("/api/agents/detect", { method: "POST" }); }
  agentTools(params: { mode?: AgentToolMode; q?: string } = {}): Promise<{ tools: AgentToolRecord[]; selectedToolId: string | null }> { const query = new URLSearchParams(); if (params.mode) query.set("mode", params.mode); if (params.q) query.set("q", params.q); const suffix = query.toString() ? `?${query.toString()}` : ""; return this.request(`/api/agent-tools${suffix}`); }
  installAgentTool(id: string): Promise<InstallJobRecord> { return this.request(`/api/agent-tools/${id}/install`, { method: "POST" }); }
  agentInstallations(): Promise<{ jobs: InstallJobRecord[] }> { return this.request("/api/agent-tools/installations"); }
  agentInstallation(id: string): Promise<InstallJobRecord> { return this.request(`/api/agent-tools/installations/${id}`); }
  stopAgentInstallation(id: string): Promise<{ ok: boolean }> { return this.request(`/api/agent-tools/installations/${id}`, { method: "DELETE" }); }
  selectAgentTool(id: string): Promise<{ selectedToolId: string }> { return this.request(`/api/agent-tools/${id}/select`, { method: "POST" }); }
  openAgentChat(id: string, cwd: string, model?: string, message?: string): Promise<AgentChatResponse> { return this.request(`/api/agent-tools/${id}/chat`, { method: "POST", body: JSON.stringify({ cwd, ...(model ? { model } : {}), ...(message ? { message } : {}) }) }); }
  sessions(): Promise<{ sessions: SessionRecord[] }> { return this.request("/api/sessions"); }
  createSession(agentId: string, cwd: string, model?: string): Promise<SessionRecord> { return this.request("/api/sessions", { method: "POST", body: JSON.stringify({ agentId, cwd, ...(model ? { model } : {}) }) }); }
  stopSession(id: string): Promise<{ ok: boolean }> { return this.request(`/api/sessions/${id}`, { method: "DELETE" }); }
  sendSessionInput(id: string, input: string): Promise<{ ok: boolean }> { return this.request(`/api/sessions/${id}/input`, { method: "POST", body: JSON.stringify({ input }) }); }
  tasks(): Promise<{ tasks: TaskRecord[] }> { return this.request("/api/tasks"); }
  createTask(title: string, description: string, priority: number, teamId?: string): Promise<TaskRecord> { return this.request("/api/tasks", { method: "POST", body: JSON.stringify({ title, description, priority, ...(teamId ? { teamId } : {}) }) }); }
  updateTask(id: string, status: string): Promise<TaskRecord> { return this.request(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
  events(): Promise<{ events: Array<Record<string, unknown>> }> { return this.request("/api/events"); }
  teams(): Promise<{ teams: TeamRecord[] }> { return this.request("/api/teams"); }
  createTeam(name: string, goal: string, agentIds: string[]): Promise<TeamRecord> { return this.request("/api/teams", { method: "POST", body: JSON.stringify({ name, goal, agentIds }) }); }
  runTeam(id: string): Promise<Record<string, unknown>> { return this.request(`/api/teams/${id}/run`, { method: "POST" }); }
  sendTeamMessage(id: string, sender: string, content: string, recipient?: string): Promise<MailboxMessageRecord> { return this.request(`/api/teams/${id}/messages`, { method: "POST", body: JSON.stringify({ sender, content, ...(recipient ? { recipient } : {}) }) }); }
  teamMembers(): Promise<{ members: TeamMemberRecord[] }> { return this.request("/api/team-members"); }
  teamMessages(): Promise<{ messages: MailboxMessageRecord[] }> { return this.request("/api/team-messages"); }
  workflows(): Promise<{ workflows: WorkflowRecord[] }> { return this.request("/api/workflows"); }
  createWorkflow(name: string, steps: Array<{ id: string; taskId?: string; dependsOn?: string[] }>): Promise<WorkflowRecord> { return this.request("/api/workflows", { method: "POST", body: JSON.stringify({ name, steps }) }); }
  runWorkflow(id: string): Promise<WorkflowRunRecord> { return this.request(`/api/workflows/${id}/run`, { method: "POST" }); }
  workflowRuns(): Promise<{ runs: WorkflowRunRecord[] }> { return this.request("/api/workflow-runs"); }
  memory(): Promise<{ memory: MemoryRecord[] }> { return this.request("/api/memory"); }
  saveMemory(scope: string, key: string, value: string): Promise<MemoryRecord> { return this.request("/api/memory", { method: "POST", body: JSON.stringify({ scope, key, value }) }); }
  mcp(): Promise<{ mcp: McpServerRecord[] }> { return this.request("/api/mcp"); }
  createMcp(name: string, transport: string, endpoint?: string, command?: string): Promise<McpServerRecord> { return this.request("/api/mcp", { method: "POST", body: JSON.stringify({ name, transport, ...(endpoint ? { endpoint } : {}), ...(command ? { command } : {}) }) }); }
  models(): Promise<{ models: ModelRecord[] }> { return this.request("/api/models"); }
  createModel(name: string, modelName: string, providerId?: string): Promise<ModelRecord> { return this.request("/api/models", { method: "POST", body: JSON.stringify({ name, modelName, ...(providerId ? { providerId } : {}) }) }); }
  providers(): Promise<{ providers: ProviderRecord[] }> { return this.request("/api/providers"); }
  createProvider(name: string, kind: string, endpoint?: string): Promise<ProviderRecord> { return this.request("/api/providers", { method: "POST", body: JSON.stringify({ name, kind, ...(endpoint ? { endpoint } : {}) }) }); }
  permissions(): Promise<{ permissions: PermissionRecord[] }> { return this.request("/api/permissions"); }
  createPermission(subject: string, action: string, resource: string, effect: string): Promise<PermissionRecord> { return this.request("/api/permissions", { method: "POST", body: JSON.stringify({ subject, action, resource, effect }) }); }
  approvals(): Promise<{ approvals: ApprovalRecord[] }> { return this.request("/api/approvals"); }
  createApproval(subject: string, action: string, resource: string): Promise<ApprovalRecord> { return this.request("/api/approvals", { method: "POST", body: JSON.stringify({ subject, action, resource }) }); }
  resolveApproval(id: string, status: "approved" | "denied"): Promise<ApprovalRecord> { return this.request(`/api/approvals/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
  terminal(): Promise<{ terminal: TerminalRecord[] }> { return this.request("/api/terminal"); }
  openTerminal(cwd: string, shell?: string): Promise<TerminalRecord> { return this.request("/api/terminal", { method: "POST", body: JSON.stringify({ cwd, ...(shell ? { shell } : {}) }) }); }
  sendTerminalInput(id: string, data: string): Promise<{ ok: boolean }> { return this.request(`/api/terminal/${id}/input`, { method: "POST", body: JSON.stringify({ data }) }); }
  resizeTerminal(id: string, cols: number, rows: number): Promise<{ ok: boolean }> { return this.request(`/api/terminal/${id}/resize`, { method: "POST", body: JSON.stringify({ cols, rows }) }); }
  closeTerminal(id: string): Promise<{ ok: boolean }> { return this.request(`/api/terminal/${id}`, { method: "DELETE" }); }
  audit(): Promise<{ audit: AuditRecord[] }> { return this.request("/api/audit"); }
}

export class UtharnessEventStream {
  private socket: WebSocket | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private closedByUser = false;
  private readonly listeners = new Set<(event: EventEnvelope) => void>();
  private readonly stateListeners = new Set<(state: ConnectionState) => void>();
  private reconnectDelay = 500;
  state: ConnectionState = "closed";

  constructor(private readonly url: string) {}
  connect(): void { this.closedByUser = false; this.setState("connecting"); this.socket?.close(); this.socket = new WebSocket(this.url); this.socket.addEventListener("open", () => { this.reconnectDelay = 500; this.setState("open"); }); this.socket.addEventListener("message", (message) => { try { this.listeners.forEach((listener) => listener(JSON.parse(String(message.data)) as EventEnvelope)); } catch { this.setState("error"); } }); this.socket.addEventListener("error", () => this.setState("error")); this.socket.addEventListener("close", () => { this.setState("closed"); if (!this.closedByUser) { this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay); this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10_000); } }); }
  close(): void { this.closedByUser = true; if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.socket?.close(); this.setState("closed"); }
  onEvent(listener: (event: EventEnvelope) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onState(listener: (state: ConnectionState) => void): () => void { this.stateListeners.add(listener); listener(this.state); return () => this.stateListeners.delete(listener); }
  private setState(state: ConnectionState): void { this.state = state; this.stateListeners.forEach((listener) => listener(state)); }
}
