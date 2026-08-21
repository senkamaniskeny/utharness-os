import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const baseUrl = process.env.UTHARNESS_URL ?? "http://127.0.0.1:4317";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  console.clear();
  console.log("┌─ UTHARNESS ─┐\n│  ◉ ONLINE   │\n└─────────────┘");
  for (const step of ["Checking system", "Detecting runtimes", "Scanning agents", "Loading database", "Ready"]) { process.stdout.write(`\r${step}...`); await sleep(160); }
  console.log("\n");
  const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json()) as { status: string; checks: Record<string, unknown> };
  console.log(`System: ${health.status}`);
  console.log(Object.entries(health.checks).map(([key, value]) => `${key.padEnd(18)} ${String(value)}`).join("\n"));
  const agents = await fetch(`${baseUrl}/api/agents/detect`, { method: "POST" }).then((r) => r.json()) as { agents: Array<{ name: string; detected: boolean }> };
  console.log("\nDetected Agents");
  agents.agents.forEach((agent, index) => console.log(`[${agent.detected ? "x" : " "}] ${index + 1}. ${agent.name}`));
  const rl = createInterface({ input, output });
  await rl.question("\nPress Enter to exit. ");
  rl.close();
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
