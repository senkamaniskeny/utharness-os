# Getting started with UTHARNESS OS

UTHARNESS OS is a free, open-source, local-first operating environment for coordinating AI agents that are installed on your computer. The default deployment keeps state in SQLite, binds the backend to the loopback interface, and does not require a cloud account. This tutorial takes a new operator from a clean checkout to a working local dashboard, then introduces the main workflows and the checks used when contributing changes.

## What you will build

By the end of this guide, you will have a local UTHARNESS backend running on `127.0.0.1:4317`, a React operations dashboard connected to its REST and WebSocket contracts, and a local agent registry that can discover trusted executables. You will also know how to start a CLI or TUI session, install an allowlisted catalog tool, launch a PTY-backed agent chat, and run the repository’s quality gates.

> UTHARNESS OS is a local control plane. It can launch and observe processes on the machine where the backend runs, so treat the backend as a privileged local service and read [SECURITY.md](../SECURITY.md) before exposing it beyond localhost.

## Prerequisites

Install the following before cloning the repository. The workspace declares Node.js 22 or newer and pnpm 11.21.0 as its package-manager baseline. Git is required to clone the source repository and is also checked by the backend health endpoint.

| Requirement      | Minimum or recommended version | Verification     |
| ---------------- | ------------------------------ | ---------------- |
| Node.js          | 22 or newer                    | `node --version` |
| pnpm             | 11.21.0                        | `pnpm --version` |
| Git              | A recent release               | `git --version`  |
| Operating system | Linux, macOS, or Windows       | —                |

If pnpm is not installed, enable the version managed by Corepack where available, or install pnpm using the official instructions. Verify both Node.js and pnpm before continuing.

## Install from source

Clone the public repository and install the workspace lockfile exactly as committed:

```bash
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install --frozen-lockfile
```

The `--frozen-lockfile` flag prevents the package manager from silently changing `pnpm-lock.yaml`. If you are actively changing dependencies, use `pnpm install` on your feature branch and commit the resulting lockfile changes deliberately.

## Start the backend and dashboard

Open two terminals in the repository root. In the first terminal, start the backend development server:

```bash
pnpm backend
```

The server listens on `http://127.0.0.1:4317` and exposes its event stream at `ws://127.0.0.1:4317/ws`. It creates the local SQLite database at `./data/utharness.sqlite` unless `UTHARNESS_DB` is set.

In the second terminal, start the Vite development server:

```bash
pnpm web
```

Open the URL printed by Vite, normally [http://127.0.0.1:5173](http://127.0.0.1:5173). The browser client reads durable data from the REST API and listens for live events over WebSocket. Keep the backend terminal running while using the dashboard.

To confirm that the backend is healthy without opening the browser, run:

```bash
curl http://127.0.0.1:4317/api/health
```

A healthy response contains `"status":"healthy"` and reports the state of Node.js, SQLite, WebSocket support, agent discovery, permissions, and related local services.

## First run in the dashboard

### Discover local agents

Open **Agents** from the sidebar and select **Detect installed**. Discovery checks the executable paths known to the local agent adapters and persists the result in SQLite. If you install an agent after the first scan, run discovery again or use the CLI command shown below.

The catalog distinguishes directly launchable local CLIs from editors, frameworks, services, and hosted tools. A detected CLI can be selected and opened through a PTY-backed chat session. A catalog entry that is not directly launchable remains useful as an official setup reference.

### Install or set up a catalog tool

For allowlisted npm or Python tools, select **Install**. The dashboard shows a bounded installation output surface and receives queued, started, output, and completion events through the local WebSocket stream. The installation service accepts only catalog entries with approved package metadata; it does not execute arbitrary commands supplied by the browser.

For tools that require their own official process, select **Setup guide**. The guide shows the publisher, capabilities, installer mode, official notes, documentation, source repository, and an official site link. Follow the vendor’s instructions, then run **Detect installed** again when the executable is available locally.

### Open a local agent chat

Select a detected CLI tool and configure the **Working directory**. You may optionally enter an assigned model string and a first message. Use **Open selected chat** or the card’s **Open chat** action. UTHARNESS creates a persisted session and launches the registered adapter through `node-pty` when available, with a child-process fallback where PTY support is unavailable.

The live chat surface renders agent output after removing terminal control sequences so ANSI escape codes do not appear as raw text. Use **Stop** in the chat header to terminate the session cleanly. Session history remains available from the **Sessions** module until the local database is removed.

## Use the main workflows

UTHARNESS organizes local operations into modules. The following table describes the normal path through each surface.

| Module               | Typical action                                                             | What is persisted                                          |
| -------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Agents               | Detect, install, select, and chat with local tools                         | Agent metadata, selected tool, installation jobs, sessions |
| Tasks                | Create work, move it from queued to running, and complete or retry it      | Task title, description, priority, status, timestamps      |
| Teams                | Create an agent council, assign members, send mailbox messages, and run it | Team definitions, members, messages, run status            |
| Workflows            | Select tasks as ordered steps and run the resulting graph                  | Workflow definition and run history                        |
| Memory               | Store scoped key/value context for local workflows                         | Scope, key, value, timestamps                              |
| MCP                  | Register local or remote tool-control endpoints                            | Transport, endpoint or command, enabled state              |
| Models and Providers | Register model names and provider endpoints                                | Provider and model metadata                                |
| Permissions          | Create allow or deny rules and review approval requests                    | Rules, approval state, audit records                       |
| Terminal             | Open and manage PTY-backed local terminal sessions                         | Terminal session metadata and output events                |
| Audit                | Review observable state changes and security events                        | Event envelopes and audit log rows                         |

The backend is authoritative for these records. The dashboard refreshes REST data after mutating operations and uses WebSocket events for live telemetry, so a reconnect or browser refresh does not make the browser’s in-memory state authoritative.

## CLI and TUI usage

The workspace CLI uses the same local backend contracts as the dashboard. With the backend running, these commands provide quick diagnostics and discovery:

```bash
pnpm cli --help
pnpm cli --version
pnpm cli doctor
pnpm cli status
pnpm cli config
pnpm cli agents
pnpm cli agents scan
pnpm cli tasks
pnpm cli team
pnpm cli models
pnpm cli mcp
pnpm cli workflows
```

To exercise the actual installable executable outside the workspace, build and pack the CLI, then install the generated tarball into a global npm prefix:

```bash
pnpm build
mkdir -p artifacts
pnpm --filter @utharness/cli pack --pack-destination artifacts
npm install --global ./artifacts/utharness-cli-0.1.0.tgz
utharness-os --help
utharness-os --version
utharness-os status
```

The package exposes both `utharness-os` and the shorter `utharness` command names. The installed executable uses the same `UTHARNESS_URL` backend target as the workspace command:

```bash
UTHARNESS_URL=http://127.0.0.1:4317 utharness-os doctor
UTHARNESS_URL=http://127.0.0.1:4317 utharness-os agents scan
```

On PowerShell, set the variable for the current shell with `$env:UTHARNESS_URL = "http://127.0.0.1:4317"` before running the command. The `config` command reports backend, WebSocket, database, and runtime settings but deliberately omits secret values.

The interactive setup and diagnostics surface is available with:

```bash
pnpm tui
```

The CLI targets `http://127.0.0.1:4317` by default. To use a different local backend port, set `UTHARNESS_URL` for the command:

```bash
UTHARNESS_URL=http://127.0.0.1:4591 pnpm cli doctor
```

## Electron desktop shell

The Electron wrapper loads the same React renderer and uses a hardened `BrowserWindow` with context isolation, sandboxing, and disabled Node integration. For development, keep the backend running and launch the desktop package’s combined development command:

```bash
pnpm --filter @utharness/desktop dev
```

For a production-like local launch, build the workspace and then start Electron:

```bash
pnpm build
pnpm desktop
```

When Electron should load a separate Vite development URL, set `UTHARNESS_WEB_URL` before starting the desktop process.

## Local configuration

All configuration is environment-based so a local operator can keep separate databases and ports without editing source files.

| Variable                 | Default                   | Use                                                                                                            |
| ------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `UTHARNESS_DB`           | `./data/utharness.sqlite` | SQLite database path; use `:memory:` for deterministic test processes                                          |
| `UTHARNESS_HOST`         | `127.0.0.1`               | Backend bind host                                                                                              |
| `UTHARNESS_PORT`         | `4317`                    | Backend HTTP and WebSocket port                                                                                |
| `UTHARNESS_RATE_LIMIT`   | `120` per minute          | Local API rate-limit maximum                                                                                   |
| `UTHARNESS_URL`          | `http://127.0.0.1:4317`   | CLI backend target                                                                                             |
| `VITE_UTHARNESS_API_URL` | loopback backend          | REST URL baked into a Vite build                                                                               |
| `VITE_UTHARNESS_WS_URL`  | loopback `/ws`            | WebSocket URL baked into a Vite build                                                                          |
| `UTHARNESS_WEB_URL`      | packaged renderer         | Electron development renderer URL                                                                              |
| `UTHARNESS_ALLOW_REMOTE` | unset                     | Explicit opt-in for non-loopback requests; avoid unless protected by an authenticated, encrypted reverse proxy |

For example, run an isolated backend database on another local port:

```bash
UTHARNESS_DB=/tmp/utharness-dev.sqlite UTHARNESS_PORT=4591 pnpm backend
```

If the frontend is built against that backend, provide matching Vite variables during the build:

```bash
VITE_UTHARNESS_API_URL=http://127.0.0.1:4591 \
VITE_UTHARNESS_WS_URL=ws://127.0.0.1:4591/ws \
pnpm --filter @utharness/web build
```

## Troubleshooting

If the dashboard shows the backend as offline, check that `pnpm backend` is still running, then call `/api/health` directly. Confirm that the Vite API and WebSocket variables point to the same backend port and that no second process is occupying the configured port.

If discovery returns fewer agents than expected, install the vendor’s official executable first, ensure it is on the PATH visible to the backend process, and run **Detect installed** or `pnpm cli agents scan` again. UTHARNESS does not claim that a catalog entry is installed merely because it exists in the catalog.

If an interactive session fails, check that the configured working directory exists, that the executable can be started by the backend user, and that the agent’s own authentication or API-key setup is complete. A failed session should appear in the **Sessions** or **Audit** surfaces and in the event feed.

If an installation job fails, open the job’s bounded output in the Agents surface, confirm the package manager is available, and retry only from the catalog’s own **Install** control. Do not paste shell commands into the installation API; the backend intentionally rejects arbitrary installer metadata.

## Validate a checkout before contributing

Run the full repository checks from the root:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

The repository also includes a live multi-agent regression script and a committed agent-selector smoke test. They require a running backend for their live checks; see the scripts and CI workflow for their environment variables and fixture lifecycle.

Before opening a pull request, review the diff, confirm there are no generated databases or secrets, and use a feature branch rather than committing directly to `main`. Read [CONTRIBUTING.md](../CONTRIBUTING.md) when that document is available in your checkout, and consult [API.md](../API.md), [docs/FRONTEND.md](FRONTEND.md), and [SECURITY.md](../SECURITY.md) for contract and security details.

## References

[1]: https://nodejs.org/en/download Node.js downloads and release information
[2]: https://pnpm.io/installation pnpm installation documentation
[3]: https://git-scm.com/book/en/v2 Git documentation
[4]: https://github.com/senkamaniskeny/utharness-os UTHARNESS OS GitHub repository
