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
}

export interface EventEnvelope {
  type: string;
  payload: Record<string, unknown>;
  at: string;
}

export type ConnectionState = "connecting" | "open" | "closed" | "error";

export interface FrontendRuntimeConfig {
  apiBaseUrl: string;
  websocketUrl: string;
}

export function getRuntimeConfig(overrides: Partial<FrontendRuntimeConfig> = {}): FrontendRuntimeConfig {
  const globalConfig = (globalThis as { UTHARNESS_CONFIG?: Partial<FrontendRuntimeConfig> }).UTHARNESS_CONFIG ?? {};
  const apiBaseUrl = overrides.apiBaseUrl || globalConfig.apiBaseUrl || "http://127.0.0.1:4317";
  const websocketUrl = overrides.websocketUrl || globalConfig.websocketUrl || apiBaseUrl.replace(/^http/, "ws") + "/ws";
  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), websocketUrl };
}

export class UtharnessApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "UtharnessApiError";
    this.status = status;
    this.details = details;
  }
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
  tasks(): Promise<{ tasks: TaskRecord[] }> { return this.request("/api/tasks"); }
  events(): Promise<{ events: Array<Record<string, unknown>> }> { return this.request("/api/events"); }
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

  connect(): void {
    this.closedByUser = false;
    this.setState("connecting");
    this.socket?.close();
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener("open", () => { this.reconnectDelay = 500; this.setState("open"); });
    this.socket.addEventListener("message", (message) => {
      try { this.listeners.forEach((listener) => listener(JSON.parse(String(message.data)) as EventEnvelope)); } catch { this.setState("error"); }
    });
    this.socket.addEventListener("error", () => this.setState("error"));
    this.socket.addEventListener("close", () => {
      this.setState("closed");
      if (!this.closedByUser) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10_000);
      }
    });
  }

  close(): void { this.closedByUser = true; if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.socket?.close(); this.setState("closed"); }
  onEvent(listener: (event: EventEnvelope) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onState(listener: (state: ConnectionState) => void): () => void { this.stateListeners.add(listener); listener(this.state); return () => this.stateListeners.delete(listener); }
  private setState(state: ConnectionState): void { this.state = state; this.stateListeners.forEach((listener) => listener(state)); }
}
