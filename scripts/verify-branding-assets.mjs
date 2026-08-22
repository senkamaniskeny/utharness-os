import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredIconNames = [
  "multi_agent_orchestrator",
  "agent_swarm_manager",
  "autonomous_task_planner",
  "goal_objective_manager",
  "task_queue_scheduler",
  "workflow_builder",
  "multi_model_router",
  "cloud_llm_manager",
  "mcp_server_manager",
  "tool_skill_marketplace",
  "memory_manager",
  "knowledge_base_manager",
  "rag_document_search",
  "browser_automation_controller",
  "terminal_command_executor",
  "code_generation_sandbox",
  "voice_input_speech_output",
  "vision_image_understanding",
  "realtime_logs_metrics_diagnostics",
  "security_permissions_audit_center",
  "browser_live_preview",
  "billing",
  "analytics",
  "settings",
  "notifications",
  "security",
  "user_profile",
  "shopping_cart",
  "support",
  "search",
  "bookmarks",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function read(relativePath) {
  const absolutePath = join(root, relativePath);
  assert(existsSync(absolutePath), `Missing branding asset or integration file: ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

for (const name of requiredIconNames) {
  const content = read(`apps/web/src/ui-icons/${name}.svg`);
  assert(/^\s*<svg\b/.test(content), `Icon is not an SVG document: ${name}.svg`);
  assert(/<title\b|aria-label=|aria-labelledby=/.test(content), `Icon lacks accessibility metadata: ${name}.svg`);
}

const mark = read("apps/web/public/branding/utharness-mark.svg");
const favicon = read("apps/web/public/favicon.svg");
assert(mark === favicon, "Legacy favicon must remain an exact copy of the canonical UTHARNESS mark");
assert(read("apps/web/public/branding/utharness-logo.svg").startsWith("<svg"), "Supplied full logo SVG is invalid");
assert(read("apps/web/public/branding/utharness-logo.png").length > 1000, "Supplied full logo PNG is unexpectedly small");
const appIcon = read("apps/desktop/src/main.ts");
assert(appIcon.includes('"../assets/utharness-app-icon.png"'), "Electron BrowserWindow is not wired to the canonical app icon");
assert(read("apps/desktop/assets/utharness-app-icon.png").length > 1000, "Desktop app icon is unexpectedly small");
const webEntry = read("apps/web/index.html");
assert(webEntry.includes('href="/branding/utharness-mark.svg"'), "Web favicon does not use the canonical UTHARNESS mark");
assert(webEntry.includes('content="/branding/utharness-logo.png"'), "Web metadata does not expose the supplied full logo");
const iconComponent = read("apps/web/src/components/ThreeDIcon.tsx");
for (const name of ["analytics", "multi_agent_orchestrator", "workflow_builder", "terminal_command_executor", "security_permissions_audit_center"]) {
  assert(iconComponent.includes(`../ui-icons/${name}.svg`), `Semantic icon mapping missing: ${name}`);
}

console.log(JSON.stringify({ status: "ok", iconCount: requiredIconNames.length, canonicalMark: "apps/web/public/branding/utharness-mark.svg", fullLogo: "apps/web/public/branding/utharness-logo.svg", desktopAppIcon: "apps/desktop/assets/utharness-app-icon.png" }, null, 2));
