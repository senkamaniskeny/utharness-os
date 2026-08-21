import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, CheckCircle2, ChevronRight, Command, Moon, PanelLeft, RefreshCw, Search, Sun, X } from "lucide-react";
import { type AgentRecord, type ConnectionState, type EventEnvelope, type HealthResponse, type SystemResponse, type TaskRecord, UtharnessClient, UtharnessEventStream, getRuntimeConfig } from "@utharness/frontend-client";
import { StatusBeacon, ThreeDIcon, type ThreeDIconName, type ThreeDIconState } from "./components/ThreeDIcon.js";

const client = new UtharnessClient(getRuntimeConfig({ apiBaseUrl: import.meta.env.VITE_UTHARNESS_API_URL, websocketUrl: import.meta.env.VITE_UTHARNESS_WS_URL }));

type ModuleName = "overview" | "agents" | "sessions" | "tasks" | "teams" | "workflows" | "memory" | "mcp" | "models" | "permissions" | "terminal" | "audit";
type ThemeName = "dark" | "light";

const navigation: Array<{ id: ModuleName; label: string; icon: ThreeDIconName; detail: string }> = [
  { id: "overview", label: "Overview", icon: "overview", detail: "Mission control" },
  { id: "agents", label: "Agents", icon: "agents", detail: "Local registry" },
  { id: "sessions", label: "Sessions", icon: "sessions", detail: "Live runtimes" },
  { id: "tasks", label: "Tasks", icon: "tasks", detail: "Shared queue" },
  { id: "teams", label: "Teams", icon: "teams", detail: "Agent council" },
  { id: "workflows", label: "Workflows", icon: "workflows", detail: "Execution graphs" },
  { id: "memory", label: "Memory", icon: "memory", detail: "Local context" },
  { id: "mcp", label: "MCP", icon: "mcp", detail: "Tool control" },
  { id: "models", label: "Models", icon: "models", detail: "Provider hub" },
  { id: "permissions", label: "Permissions", icon: "permissions", detail: "Approval queue" },
  { id: "terminal", label: "Terminal", icon: "terminal", detail: "PTY sessions" },
  { id: "audit", label: "Audit", icon: "audit", detail: "Event history" },
];

function formatTime(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)); }
function formatUptime(value: number): string { const minutes = Math.max(0, Math.floor(value / 60)); return `${String(Math.floor(minutes / 60)).padStart(2, "0")}h ${String(minutes % 60).padStart(2, "0")}m`; }
function statusClass(status: string): string { return status.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }
function stateFor(status: string): ThreeDIconState { if (["available", "completed", "healthy"].includes(status)) return "active"; if (["running", "connecting"].includes(status)) return "running"; if (["failed", "error"].includes(status)) return "error"; if (["warning", "degraded"].includes(status)) return "warning"; return "neutral"; }

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleName>("overview");
  const [theme, setTheme] = useState<ThemeName>("dark");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [system, setSystem] = useState<SystemResponse | null>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const stream = new UtharnessEventStream(client.config.websocketUrl);
    const stopState = stream.onState(setConnection);
    const stopEvents = stream.onEvent((event) => { setEvents((current) => [event, ...current].slice(0, 40)); if (event.type.startsWith("agent.") || event.type.startsWith("task.") || event.type.startsWith("system.")) void loadDashboard(); });
    stream.connect();
    return () => { stopState(); stopEvents(); stream.close(); };
  }, []);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); } if (event.key === "Escape") setPaletteOpen(false); };
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const detectedCount = useMemo(() => agents.filter((agent) => agent.status === "available").length, [agents]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === "completed").length, [tasks]);
  const runningAgents = useMemo(() => agents.filter((agent) => agent.status === "running" || agent.status === "available").length, [agents]);
  const healthyChecks = health ? Object.values(health.checks).filter((check) => check.healthy).length : 0;
  const activeNav = navigation.find((item) => item.id === activeModule) ?? navigation[0]!;

  const scanAgents = async (): Promise<void> => { setScanning(true); setError(null); try { const result = await client.detectAgents(); setAgents(result.agents); setNotice(`${result.agents.filter((agent) => agent.detected).length} local agents detected`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Agent scan failed"); } finally { setScanning(false); } };
  const runCommand = (command: string): void => { setPaletteOpen(false); setPaletteQuery(""); if (command === "refresh") void loadDashboard(); else if (command === "scan") void scanAgents(); else if (command === "theme") setTheme((current) => current === "dark" ? "light" : "dark"); else { setActiveModule(command as ModuleName); setNotice(`${navigation.find((item) => item.id === command)?.label ?? "Module"} selected`); } };

  return (
    <div className="app-shell">
      <AmbientMesh />
      <aside className="sidebar glass-surface">
        <div className="brand"><ThreeDIcon name="system" size="feature" state="active" label="UTHARNESS system" /><div><strong>UTHARNESS OS</strong><span>LOCAL AGENT COMMAND CENTER</span></div></div>
        <div className="system-chip"><StatusBeacon state={connection === "open" ? "active" : connection === "error" ? "error" : "running"} /><span>{connection === "open" ? "EVENT STREAM ONLINE" : connection.toUpperCase()}</span><span className="chip-local">LOCAL</span></div>
        <div className="sidebar-heading"><span>MISSION CONTROL</span><button className="icon-button" aria-label="Collapse sidebar"><PanelLeft size={16} /></button></div>
        <nav>{navigation.map((item) => <button className={`nav-item ${activeModule === item.id ? "active" : ""}`} key={item.id} onClick={() => setActiveModule(item.id)}><ThreeDIcon name={item.icon} size="compact" state={activeModule === item.id ? "active" : "neutral"} /><span><strong>{item.label}</strong><small>{item.detail}</small></span>{item.id === "agents" && <b>{agents.length}</b>}{item.id === "tasks" && <b>{tasks.length}</b>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="workspace-mini"><span className="mini-label">WORKSPACE</span><strong>utharness-os</strong><span className="mono">/home/ubuntu/utharness-os</span></div><button className="workspace-button"><FolderIcon /> <span>Local workspace</span><ChevronRight size={14} /></button></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="crumbs"><span className="eyebrow">UTHARNESS / {activeNav.label.toUpperCase()}</span><h1>{activeNav.id === "overview" ? "Mission control" : activeNav.label}</h1></div><div className="top-actions"><button className="search-button pressed-control" onClick={() => setPaletteOpen(true)}><Search size={15} /><span>Search commands</span><kbd>Ctrl K</kbd></button><button className="icon-button pressed-control" aria-label="Notifications" onClick={() => setNotice("No new notifications")}><Bell size={17} /><span className="notification-dot" /></button><ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === "dark" ? "light" : "dark")} /></div></header>
        {error && <div className="error-banner glass-surface"><ThreeDIcon name="permissions" size="compact" state="error" /><span>{error}</span><button onClick={() => void loadDashboard()} className="text-button">Retry</button></div>}
        {notice && <div className="notice-banner"><CheckCircle2 size={15} /> {notice}<button aria-label="Dismiss notice" onClick={() => setNotice(null)}><X size={14} /></button></div>}
        {activeModule === "overview" ? <Overview health={health} system={system} agents={agents} tasks={tasks} events={events} connection={connection} detectedCount={detectedCount} runningAgents={runningAgents} completedTasks={completedTasks} healthyChecks={healthyChecks} scanning={scanning} loading={loading} onRefresh={() => void loadDashboard()} onScan={() => void scanAgents()} /> : <ModuleView module={activeModule} agents={agents} tasks={tasks} events={events} health={health} onScan={() => void scanAgents()} scanning={scanning} />}
        <footer className="telemetry-dock glass-surface"><div><span className="telemetry-key">RUNTIME</span><strong>{system ? formatUptime(Math.floor(Date.now() / 1000) - Math.floor(new Date().setHours(0, 0, 0, 0) / 1000)) : "--"}</strong></div><div><span className="telemetry-key">AGENTS</span><strong>{runningAgents.toString().padStart(2, "0")}</strong></div><div><span className="telemetry-key">TASKS</span><strong>{tasks.length.toString().padStart(2, "0")}</strong></div><div><span className="telemetry-key">STREAM</span><strong className={connection === "open" ? "telemetry-good" : "telemetry-warn"}>{connection.toUpperCase()}</strong></div><div className="telemetry-spacer" /><span className="telemetry-path">REST {client.config.apiBaseUrl} · WS {client.config.websocketUrl}</span></footer>
      </main>
      {paletteOpen && <CommandPalette query={paletteQuery} onQuery={setPaletteQuery} onClose={() => setPaletteOpen(false)} onCommand={runCommand} />}
    </div>
  );
}

function Overview({ health, system, agents, tasks, events, connection, detectedCount, runningAgents, completedTasks, healthyChecks, scanning, loading, onRefresh, onScan }: { health: HealthResponse | null; system: SystemResponse | null; agents: AgentRecord[]; tasks: TaskRecord[]; events: EventEnvelope[]; connection: ConnectionState; detectedCount: number; runningAgents: number; completedTasks: number; healthyChecks: number; scanning: boolean; loading: boolean; onRefresh: () => void; onScan: () => void }) {
  return <>
    <section className="hero glass-surface"><div className="hero-copy"><span className="eyebrow accent">LOCAL RUNTIME / 0.1.0</span><h2>See the whole swarm.<br /><em>Move with intent.</em></h2><p>UTHARNESS turns installed AI agents into an observable, permissioned local operating environment.</p><div className="hero-actions"><button className="primary-button pressed-control" onClick={onScan} disabled={scanning}><ThreeDIcon name="agents" size="inline" state="active" />{scanning ? "Scanning environment" : "Scan local agents"}</button><button className="secondary-button pressed-control" onClick={onRefresh} disabled={loading}><RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh telemetry</button></div></div><div className="hero-core"><div className="hero-rings"><span /><span /><span /></div><ThreeDIcon name="system" size="hero" state="running" label="Live local system" /><small>LIVE / LOCAL</small></div></section>
    <section className="metric-grid"><Metric icon="health" label="System health" value={health?.status === "healthy" ? "Healthy" : health ? "Degraded" : "—"} detail={`${healthyChecks}/${health ? Object.keys(health.checks).length : 0} checks`} state={stateFor(health?.status ?? "neutral")} /><Metric icon="agents" label="Agent council" value={String(detectedCount).padStart(2, "0")} detail={`${runningAgents} ready to run`} state="active" /><Metric icon="tasks" label="Task board" value={String(completedTasks).padStart(2, "0")} detail={`${tasks.length} tracked tasks`} state="active" /><Metric icon="database" label="Local authority" value={health?.checks.database?.healthy ? "SQLite" : "—"} detail="Offline-capable store" state="active" /></section>
    <section className="bento-grid"><div className="panel glass-surface agents-panel"><PanelHeader eyebrow="AGENT COUNCIL" title="Local agent registry" icon="agents" action={<button className="text-button" onClick={onScan}>Scan <ChevronRight size={13} /></button>} /><div className="agent-cards">{agents.length === 0 && <EmptyState icon="agents" text={loading ? "Loading registry" : "Scan the local environment to populate the council"} />}{agents.slice(0, 6).map((agent) => <AgentCard key={agent.id} agent={agent} />)}</div></div><div className="panel glass-surface mission-panel"><PanelHeader eyebrow="ACTIVE MISSION" title="Execution pulse" icon="workflow" /><div className="mission-core"><div className="progress-orb"><span>{tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0}%</span><small>complete</small></div><div><strong>{tasks.find((task) => task.status === "running")?.title ?? "Awaiting a mission"}</strong><p>{tasks.length ? "Shared task board is connected to the local backend." : "Create a task or launch a team to start coordinated work."}</p></div></div><div className="mini-steps"><span className="done" /><span className={tasks.length ? "active" : ""} /><span /><span /><span /></div><div className="mission-foot"><span><StatusBeacon state={connection === "open" ? "active" : "warning"} /> {connection === "open" ? "WebSocket synced" : "Reconnecting"}</span><span className="mono">{system?.platform ?? "local"} / {system?.arch ?? "runtime"}</span></div></div><div className="panel glass-surface task-panel"><PanelHeader eyebrow="SHARED TASK BOARD" title="Queue pressure" icon="tasks" action={<span className="panel-count">{tasks.length.toString().padStart(2, "0")}</span>} /><div className="task-columns"><TaskColumn label="READY" items={tasks.filter((task) => task.status === "queued")} /><TaskColumn label="RUNNING" items={tasks.filter((task) => task.status === "running")} /><TaskColumn label="DONE" items={tasks.filter((task) => task.status === "completed")} /></div></div><div className="panel glass-surface events-panel"><PanelHeader eyebrow="LIVE TELEMETRY" title="Event feed" icon="network" action={<span className="stream-state"><StatusBeacon state={connection === "open" ? "active" : "warning"} />{connection}</span>} /><div className="event-list">{events.length === 0 && <EmptyState icon="network" text="Listening for backend events" />}{events.slice(0, 6).map((event, index) => <div className="event-row" key={`${event.at}-${index}`}><span className="event-time">{formatTime(event.at)}</span><ThreeDIcon name={event.type.startsWith("agent") ? "agents" : event.type.startsWith("task") ? "tasks" : "network"} size="inline" state={stateFor(event.type.includes("error") ? "error" : "active")} /><code>{event.type}</code><span className="event-payload">{JSON.stringify(event.payload)}</span></div>)}</div></div></section>
  </>;
}

function ModuleView({ module, agents, tasks, events, health, onScan, scanning }: { module: ModuleName; agents: AgentRecord[]; tasks: TaskRecord[]; events: EventEnvelope[]; health: HealthResponse | null; onScan: () => void; scanning: boolean }) { const item = navigation.find((entry) => entry.id === module)!; return <section className="module-view glass-surface"><div className="module-title"><ThreeDIcon name={item.icon} size="feature" state="active" /><div><span className="eyebrow accent">LIVE CONTRACT / {item.label.toUpperCase()}</span><h2>{item.label} <em>surface</em></h2><p>{item.detail} connected to the UTHARNESS backend.</p></div>{module === "agents" && <button className="primary-button pressed-control" onClick={onScan} disabled={scanning}><ThreeDIcon name="agents" size="inline" state="active" />{scanning ? "Scanning" : "Scan now"}</button>}</div><div className="module-stats"><MiniStat label="Registered" value={module === "agents" ? agents.length : module === "tasks" ? tasks.length : events.length} /><MiniStat label="Healthy checks" value={health ? Object.values(health.checks).filter((check) => check.healthy).length : 0} /><MiniStat label="Authority" value="LOCAL" /></div><div className="module-note"><ThreeDIcon name="system" size="module" state="active" /><div><strong>Backend contract online</strong><p>This shell reads durable state from SQLite through REST and listens for live state transitions through the WebSocket event envelope. The module keeps its data source visible instead of simulating state.</p></div></div></section>; }
function Metric({ icon, label, value, detail, state }: { icon: ThreeDIconName; label: string; value: string; detail: string; state: ThreeDIconState }) { return <div className="metric-card glass-surface"><ThreeDIcon name={icon} size="module" state={state} /><div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-detail">{detail}</span></div></div>; }
function PanelHeader({ eyebrow, title, icon, action }: { eyebrow: string; title: string; icon: ThreeDIconName; action?: ReactNode }) { return <div className="panel-heading"><div className="panel-heading-left"><ThreeDIcon name={icon} size="compact" state="active" /><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div></div>{action}</div>; }
function AgentCard({ agent }: { agent: AgentRecord }) { return <article className="agent-card pressed-control"><div className="agent-card-top"><ThreeDIcon name="agents" size="feature" state={stateFor(agent.status)} /><span className={`pill ${statusClass(agent.status)}`}>{agent.status}</span></div><strong>{agent.name}</strong><span className="mono">{agent.executable}</span><div className="agent-card-meta"><span>{agent.version ?? "version unknown"}</span><span>{agent.kind}</span></div></article>; }
function TaskColumn({ label, items }: { label: string; items: TaskRecord[] }) { return <div className="task-column"><span className="column-label">{label}<b>{items.length}</b></span>{items.slice(0, 3).map((task) => <div className="task-chip" key={task.id}><span>{task.title}</span><small>P{task.priority}</small></div>)}{items.length === 0 && <span className="column-empty">—</span>}</div>; }
function MiniStat({ label, value }: { label: string; value: string | number }) { return <div><span className="eyebrow">{label}</span><strong>{value}</strong></div>; }
function EmptyState({ icon, text }: { icon: ThreeDIconName; text: string }) { return <div className="empty-state"><ThreeDIcon name={icon} size="feature" state="neutral" /><span>{text}</span></div>; }
function FolderIcon() { return <ThreeDIcon name="memory" size="inline" state="active" />; }
function ThemeToggle({ theme, onToggle }: { theme: ThemeName; onToggle: () => void }) { return <button className={`theme-toggle pressed-control ${theme}`} onClick={onToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}><span className="theme-track"><span className="theme-knob">{theme === "dark" ? <Moon size={13} /> : <Sun size={13} />}</span></span><span className="theme-label">{theme}</span></button>; }
function CommandPalette({ query, onQuery, onClose, onCommand }: { query: string; onQuery: (value: string) => void; onClose: () => void; onCommand: (command: string) => void }) { const actions = [{ id: "refresh", label: "Refresh telemetry", icon: "health" as ThreeDIconName, shortcut: "R" }, { id: "scan", label: "Scan local agents", icon: "agents" as ThreeDIconName, shortcut: "A" }, { id: "theme", label: "Toggle theme", icon: "system" as ThreeDIconName, shortcut: "T" }, ...navigation.filter((item) => item.id !== "overview").map((item) => ({ id: item.id, label: `Open ${item.label}`, icon: item.icon, shortcut: "" }))]; const filtered = actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase())); return <div className="palette-backdrop" onMouseDown={onClose}><div className="command-palette glass-surface" onMouseDown={(event) => event.stopPropagation()}><div className="palette-header"><Search size={17} /><input autoFocus value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search modules, actions, agents…" /><button className="icon-button" onClick={onClose} aria-label="Close command palette"><X size={16} /></button></div><div className="palette-list">{filtered.map((action) => <button key={action.id} className="palette-item" onClick={() => onCommand(action.id)}><ThreeDIcon name={action.icon} size="compact" state="active" /><span>{action.label}</span>{action.shortcut && <kbd>{action.shortcut}</kbd>}</button>)}{filtered.length === 0 && <div className="palette-empty">No matching commands</div>}</div><div className="palette-footer"><span><Command size={12} /> Navigate with Ctrl+K</span><span>Esc to close</span></div></div></div>; }
function AmbientMesh() { return <div className="ambient-mesh" aria-hidden="true"><span className="ambient-glow glow-one" /><span className="ambient-glow glow-two" /><span className="ambient-grid" /></div>; }
