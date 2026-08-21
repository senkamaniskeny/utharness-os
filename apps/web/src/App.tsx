import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, Bot, CheckCircle2, CircleAlert, Database, Gauge, Layers3, RefreshCw, Radio, ScanSearch, Server, TerminalSquare, Workflow } from "lucide-react";
import { type AgentRecord, type ConnectionState, type EventEnvelope, type HealthResponse, type SystemResponse, type TaskRecord, UtharnessClient, UtharnessEventStream, getRuntimeConfig } from "@utharness/frontend-client";

const client = new UtharnessClient(getRuntimeConfig({ apiBaseUrl: import.meta.env.VITE_UTHARNESS_API_URL, websocketUrl: import.meta.env.VITE_UTHARNESS_WS_URL }));

function formatTime(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)); }
function statusClass(status: string): string { return status.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [system, setSystem] = useState<SystemResponse | null>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const [nextHealth, nextSystem, nextAgents, nextTasks, nextEvents] = await Promise.all([client.health(), client.system(), client.agents(), client.tasks(), client.events()]);
      setHealth(nextHealth); setSystem(nextSystem); setAgents(nextAgents.agents); setTasks(nextTasks.tasks);
      setEvents(nextEvents.events.map((event) => ({ type: String(event.event_type ?? "event"), payload: JSON.parse(String(event.payload_json ?? "{}")) as Record<string, unknown>, at: String(event.created_at) })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reach the backend"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadDashboard(); }, []);
  useEffect(() => {
    const stream = new UtharnessEventStream(client.config.websocketUrl);
    const stopState = stream.onState(setConnection);
    const stopEvents = stream.onEvent((event) => { setEvents((current) => [event, ...current].slice(0, 30)); if (event.type.startsWith("agent.") || event.type.startsWith("task.")) void loadDashboard(); });
    stream.connect();
    return () => { stopState(); stopEvents(); stream.close(); };
  }, []);

  const detectedCount = useMemo(() => agents.filter((agent) => agent.status === "available").length, [agents]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === "completed").length, [tasks]);
  const healthyChecks = health ? Object.values(health.checks).filter((check) => check.healthy).length : 0;

  const scanAgents = async (): Promise<void> => { setScanning(true); setError(null); try { const result = await client.detectAgents(); setAgents(result.agents); } catch (cause) { setError(cause instanceof Error ? cause.message : "Agent scan failed"); } finally { setScanning(false); } };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Layers3 size={18} /></div><div><strong>UTHARNESS</strong><span>LOCAL CONTROL PLANE</span></div></div>
        <div className="sidebar-status"><span className={`status-dot ${connection === "open" ? "online" : "offline"}`} /> <span>{connection === "open" ? "EVENT STREAM ONLINE" : "EVENT STREAM OFFLINE"}</span></div>
        <nav><a className="nav-item active"><Gauge size={17} /> Overview</a><a className="nav-item"><Bot size={17} /> Agents <b>{agents.length}</b></a><a className="nav-item"><TerminalSquare size={17} /> Sessions</a><a className="nav-item"><Workflow size={17} /> Workflows</a><a className="nav-item"><Server size={17} /> MCP & Models</a></nav>
        <div className="sidebar-footer"><span>LOCAL-FIRST</span><small>No cloud account required</small></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><p className="eyebrow">SYSTEM / OVERVIEW</p><h1>Operational dashboard</h1></div><button className="ghost-button" onClick={() => void loadDashboard()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh</button></header>
        {error && <div className="error-banner"><CircleAlert size={18} /> {error}</div>}
        <section className="hero-card"><div><span className="eyebrow accent">UTHARNESS OS 0.1.0</span><h2>Coordinate local agents<br />with operational clarity.</h2><p>One local backend for discovery, sessions, tasks, teams, workflows, and permissions.</p></div><div className="hero-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><Radio size={22} /></div></div></section>
        <section className="metric-grid"><Metric icon={<Activity size={17} />} label="System health" value={health?.status === "healthy" ? "Healthy" : health ? "Degraded" : "—"} detail={`${healthyChecks}/${health ? Object.keys(health.checks).length : 0} checks passing`} tone={health?.status === "healthy" ? "green" : "amber"} /><Metric icon={<Bot size={17} />} label="Detected agents" value={String(detectedCount)} detail={`${agents.length} registrations`} tone="blue" /><Metric icon={<CheckCircle2 size={17} />} label="Completed tasks" value={String(completedTasks)} detail={`${tasks.length} total tasks`} tone="purple" /><Metric icon={<Database size={17} />} label="Persistence" value={health?.checks.database?.healthy ? "SQLite" : "—"} detail="Authoritative local store" tone="orange" /></section>
        <section className="content-grid"><div className="panel agents-panel"><div className="panel-heading"><div><p className="eyebrow">REGISTRY</p><h3>Agent inventory</h3></div><button className="primary-button" onClick={() => void scanAgents()} disabled={scanning}><ScanSearch size={15} /> {scanning ? "Scanning" : "Scan agents"}</button></div><div className="table-list">{agents.length === 0 && <EmptyState icon={<Bot size={20} />} text={loading ? "Loading registry…" : "No agents scanned yet."} />}{agents.slice(0, 8).map((agent) => <div className="list-row" key={agent.id}><div className="row-icon"><Bot size={16} /></div><div className="row-main"><strong>{agent.name}</strong><span>{agent.executable} · {agent.version ?? "version unknown"}</span></div><span className={`pill ${statusClass(agent.status)}`}>{agent.status}</span></div>)}</div></div><div className="panel tasks-panel"><div className="panel-heading"><div><p className="eyebrow">TASK ENGINE</p><h3>Work queue</h3></div><span className="panel-count">{tasks.length}</span></div><div className="table-list">{tasks.length === 0 && <EmptyState icon={<CheckCircle2 size={20} />} text="No tasks in the local queue." />}{tasks.slice(0, 7).map((task) => <div className="list-row" key={task.id}><div className={`task-status ${statusClass(task.status)}`}><span /></div><div className="row-main"><strong>{task.title}</strong><span>{task.description || "No description"}</span></div><span className={`pill ${statusClass(task.status)}`}>{task.status}</span></div>)}</div></div></section>
        <section className="panel events-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE TELEMETRY</p><h3>Event stream</h3></div><div className="stream-state"><span className={`status-dot ${connection === "open" ? "online" : "offline"}`} /> {connection}</div></div><div className="event-list">{events.length === 0 && <EmptyState icon={<Radio size={20} />} text="Waiting for backend events…" />}{events.slice(0, 8).map((event, index) => <div className="event-row" key={`${event.at}-${index}`}><span className="event-time">{formatTime(event.at)}</span><code>{event.type}</code><span className="event-payload">{JSON.stringify(event.payload)}</span></div>)}</div></section>
        <footer className="app-footer"><span>{system ? `${system.platform} · ${system.arch} · Node ${system.node}` : "Connecting to backend runtime…"}</span><span>REST {client.config.apiBaseUrl} · WS {client.config.websocketUrl}</span></footer>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></div>; }
function EmptyState({ icon, text }: { icon: ReactNode; text: string }) { return <div className="empty-state">{icon}<span>{text}</span></div>; }
