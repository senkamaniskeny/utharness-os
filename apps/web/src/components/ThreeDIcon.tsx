import type { ReactNode } from "react";
import { Activity, Bot, Boxes, Cpu, Database, FileCode2, Gauge, GitBranch, Layers3, Network, Orbit, ShieldCheck, Sparkles, TerminalSquare, Workflow, Wrench } from "lucide-react";

export type ThreeDIconName = "overview" | "agents" | "sessions" | "tasks" | "teams" | "workflows" | "memory" | "mcp" | "models" | "permissions" | "terminal" | "audit" | "health" | "database" | "network" | "workflow" | "system";
export type ThreeDIconState = "neutral" | "active" | "running" | "warning" | "error" | "disabled";

const glyphs: Record<ThreeDIconName, typeof Activity> = {
  overview: Gauge, agents: Bot, sessions: Orbit, tasks: Boxes, teams: Network, workflows: Workflow, memory: Database, mcp: Wrench, models: Sparkles, permissions: ShieldCheck, terminal: TerminalSquare, audit: FileCode2, health: Activity, database: Database, network: Network, workflow: GitBranch, system: Cpu,
};

export function ThreeDIcon({ name, state = "neutral", size = "module", label }: { name: ThreeDIconName; state?: ThreeDIconState; size?: "inline" | "compact" | "module" | "feature" | "hero"; label?: string }) {
  const Glyph = glyphs[name] ?? Layers3;
  return <span className={`three-d-icon icon-${name} icon-${size} state-${state}`} role={label ? "img" : undefined} aria-label={label}><span className="icon-back" /><span className="icon-face"><Glyph size={size === "hero" ? 34 : size === "feature" ? 25 : size === "module" ? 19 : size === "compact" ? 15 : 13} strokeWidth={1.8} /></span><span className="icon-highlight" /><span className="icon-signal" /></span>;
}

export function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) { return <span className="icon-label"><span className="icon-label-core">{icon}</span>{children}</span>; }

export function StatusBeacon({ state }: { state: ThreeDIconState }) { return <span className={`status-beacon state-${state}`}><span /></span>; }
