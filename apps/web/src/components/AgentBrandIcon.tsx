import type { CSSProperties } from "react";
import claudeCode from "../agent-icons/claude-code.svg?url";
import codex from "../agent-icons/codex.svg?url";
import geminiCli from "../agent-icons/gemini-cli.svg?url";
import openhands from "../agent-icons/openhands.svg?url";
import cline from "../agent-icons/cline.svg?url";
import goose from "../agent-icons/goose.svg?url";
import opencode from "../agent-icons/opencode.svg?url";
import qwenCode from "../agent-icons/qwen-code.svg?url";
import openai from "../agent-icons/openai.svg?url";
import anthropic from "../agent-icons/anthropic.svg?url";
import google from "../agent-icons/google.svg?url";
import langchain from "../agent-icons/langchain.svg?url";
import crewai from "../agent-icons/crewai.svg?url";
import dify from "../agent-icons/dify.svg?url";

const assets: Record<string, string> = { "claude-code": claudeCode, codex, "gemini-cli": geminiCli, openhands, cline, goose, opencode, "qwen-code": qwenCode, openai, anthropic, google, langchain, crewai, dify };

function initials(value: string): string { return value.split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "?").join("") || "AI"; }

export function AgentBrandIcon({ slug, label, size = "module" }: { slug: string; label: string; size?: "tiny" | "compact" | "module" | "feature" }) {
  const dimension = size === "tiny" ? 18 : size === "compact" ? 26 : size === "feature" ? 52 : 38;
  const url = assets[slug];
  const style = { width: dimension, height: dimension } satisfies CSSProperties;
  const accessibleLabel = url ? `${label} official brand mark` : `${label} neutral brand fallback`;
  return <span className={`agent-brand-icon brand-${size} ${url ? "brand-official" : "brand-fallback"}`} style={style} role="img" aria-label={accessibleLabel} title={url ? `${label} official brand mark` : `${label} brand mark unavailable; neutral fallback`}>
    {url ? <img src={url} alt="" aria-hidden="true" /> : <span aria-hidden="true">{initials(label)}</span>}
  </span>;
}
