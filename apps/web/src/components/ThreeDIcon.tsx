import type { ReactNode } from "react";
import { Activity, Bot, Boxes, Cpu, Database, FileCode2, Gauge, GitBranch, Layers3, Network, Orbit, ShieldCheck, Sparkles, TerminalSquare, Workflow, Wrench } from "lucide-react";

const iconAssets = import.meta.glob("../ui-icons/*.svg", { eager: true, import: "default", query: "?url" }) as Record<string, string>;

export type ThreeDIconName = "overview" | "agents" | "sessions" | "tasks" | "teams" | "workflows" | "memory" | "mcp" | "models" | "permissions" | "terminal" | "audit" | "health" | "database" | "network" | "workflow" | "system";
export type ThreeDIconState = "neutral" | "active" | "running" | "warning" | "error" | "disabled";

const glyphs: Record<ThreeDIconName, typeof Activity> = {
  overview: Gauge, agents: Bot, sessions: Orbit, tasks: Boxes, teams: Network, workflows: Workflow, memory: Database, mcp: Wrench, models: Sparkles, permissions: ShieldCheck, terminal: TerminalSquare, audit: FileCode2, health: Activity, database: Database, network: Network, workflow: GitBranch, system: Cpu,
};
const iconArt: Record<ThreeDIconName, string | undefined> = {
  overview: iconAssets["../ui-icons/analytics.svg"], agents: iconAssets["../ui-icons/multi_agent_orchestrator.svg"], sessions: iconAssets["../ui-icons/realtime_logs_metrics_diagnostics.svg"], tasks: iconAssets["../ui-icons/task_queue_scheduler.svg"], teams: iconAssets["../ui-icons/agent_swarm_manager.svg"], workflows: iconAssets["../ui-icons/workflow_builder.svg"], memory: iconAssets["../ui-icons/memory_manager.svg"], mcp: iconAssets["../ui-icons/mcp_server_manager.svg"], models: iconAssets["../ui-icons/multi_model_router.svg"], permissions: iconAssets["../ui-icons/security_permissions_audit_center.svg"], terminal: iconAssets["../ui-icons/terminal_command_executor.svg"], audit: iconAssets["../ui-icons/security.svg"], health: iconAssets["../ui-icons/analytics.svg"], database: iconAssets["../ui-icons/memory_manager.svg"], network: iconAssets["../ui-icons/realtime_logs_metrics_diagnostics.svg"], workflow: iconAssets["../ui-icons/workflow_builder.svg"], system: iconAssets["../ui-icons/multi_agent_orchestrator.svg"],
};

export function ThreeDIcon({ name, state = "neutral", size = "module", label }: { name: ThreeDIconName; state?: ThreeDIconState; size?: "inline" | "compact" | "module" | "feature" | "hero"; label?: string }) {
  const Glyph = glyphs[name] ?? Layers3;
  const art = size === "inline" ? undefined : iconArt[name];
  const glyphSize = size === "hero" ? 34 : size === "feature" ? 25 : size === "module" ? 19 : size === "compact" ? 15 : 13;
  return <span className={`three-d-icon icon-${name} icon-${size} state-${state}`} role={label ? "img" : undefined} aria-label={label}><span className="icon-back" /><span className={`icon-face ${art ? "icon-face-art" : ""}`}>{art ? <img src={art} alt="" aria-hidden="true" /> : <Glyph size={glyphSize} strokeWidth={1.8} />}</span><span className="icon-highlight" /><span className="icon-signal" /></span>;
}

export function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) { return <span className="icon-label"><span className="icon-label-core">{icon}</span>{children}</span>; }

export function StatusBeacon({ state }: { state: ThreeDIconState }) { return <span className={`status-beacon state-${state}`}><span /></span>; }
