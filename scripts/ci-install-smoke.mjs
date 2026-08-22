import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const port = Number(process.env.UTHARNESS_SMOKE_PORT ?? 4317);
const baseUrl = `http://127.0.0.1:${port}`;
const database = join(
  tmpdir(),
  `utharness-install-smoke-${process.pid}.sqlite`,
);
const env = {
  ...process.env,
  UTHARNESS_DB: database,
  UTHARNESS_HOST: "127.0.0.1",
  UTHARNESS_PORT: String(port),
  UTHARNESS_URL: baseUrl,
  UTHARNESS_RATE_LIMIT: "1000",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32",
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve({ stdout, stderr })
        : reject(
            new Error(
              `${command} ${args.join(" ")} exited with ${code}\n${stdout}\n${stderr}`,
            ),
          ),
    );
  });
}

async function waitForHealth(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "backend has not started";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return await response.json();
      lastError = `health returned HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}/api/health: ${lastError}`);
}

let server;
let serverOutput = "";
try {
  server = spawn(pnpm, ["backend"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
  });
  server.stdout?.on("data", (chunk) => {
    serverOutput += chunk;
  });
  server.stderr?.on("data", (chunk) => {
    serverOutput += chunk;
  });

  const health = await waitForHealth(baseUrl);
  if (health.status !== "healthy")
    throw new Error(
      `Expected healthy backend, received ${JSON.stringify(health)}`,
    );

  const agentToolsResponse = await fetch(`${baseUrl}/api/agent-tools`);
  if (!agentToolsResponse.ok)
    throw new Error(`Agent catalog returned HTTP ${agentToolsResponse.status}`);
  const agentTools = await agentToolsResponse.json();
  if (!Array.isArray(agentTools.tools) || agentTools.tools.length < 1)
    throw new Error("Agent catalog did not return tools");

  await run(pnpm, ["cli", "doctor"]);
  await run(pnpm, ["cli", "agents", "scan"]);

  console.log(
    JSON.stringify(
      {
        platform: process.platform,
        node: process.version,
        database,
        backend: baseUrl,
        health: health.status,
        catalogTools: agentTools.tools.length,
        cli: "doctor and agents scan passed",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (serverOutput) console.error(`Backend output:\n${serverOutput}`);
  process.exitCode = 1;
} finally {
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (server.exitCode === null && server.signalCode === null) {
      if (process.platform === "win32")
        spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
      else {
        try {
          process.kill(-server.pid, "SIGKILL");
        } catch {
          server.kill("SIGKILL");
        }
      }
    }
  }
}
