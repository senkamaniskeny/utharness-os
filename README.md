# UTHARNESS OS

UTHARNESS OS is a free, open-source, local-first operating environment for coordinating installed AI agents. The repository is intentionally backend-first: the authoritative application state lives in local SQLite, agent processes are launched only through registered adapters, and REST/WebSocket contracts are implemented before the full desktop and web frontends.

## Current release

Version `0.1.0` provides a working Fastify backend, SQLite migrations, agent discovery, adapter contracts, process-backed sessions, task execution, team coordination, workflow DAG execution, model/provider/MCP registries, memory, permissions, approvals, audit events, a CLI, and a compact setup TUI. The desktop and web directories are scaffolded for the next phase and do not pretend to be complete clients.

## Quick start

```bash
pnpm install
pnpm backend
# in another terminal
pnpm cli doctor
pnpm cli agents scan
pnpm test
pnpm typecheck
pnpm build
```

The server binds to `127.0.0.1:4317` by default and stores state in `./data/utharness.sqlite`. Set `UTHARNESS_DB`, `UTHARNESS_HOST`, and `UTHARNESS_PORT` to override local defaults. Remote binding requires an explicit `UTHARNESS_ALLOW_REMOTE=1` opt-in and should be placed behind an authenticated reverse proxy before any non-local use.

## Backend contracts

REST endpoints are rooted at `/api`, and the event stream is available at `ws://127.0.0.1:4317/ws`. A concise route and event reference is in [API.md](API.md). Every mutating route validates input with Zod, writes authoritative state to SQLite, and emits an event where the domain operation is observable.

## Security posture

The default posture is local-only access, strict request validation, rate limiting, no arbitrary shell execution, explicit process permission checks, audit logging for permission changes, bounded request bodies, secret-safe environment merging, and SQLite foreign-key enforcement. See [SECURITY.md](SECURITY.md) before enabling remote access or registering an agent with elevated capabilities.

## Repository structure

| Area | Purpose |
| --- | --- |
| `apps/backend` | Fastify REST/WebSocket server and domain services |
| `apps/cli` | `utharness` command-line client |
| `apps/tui` | Interactive setup and diagnostics surface |
| `packages/*` | Planned reusable domain packages, scaffolded for extraction as contracts stabilize |
| `integrations/*` | Adapter-specific integration slots |
| `migrations` | Human-readable migration notes and future migration assets |
| `.github/workflows` | CI, security, release, and publishing automation |

## License

UTHARNESS OS is released under the MIT License. See [LICENSE](LICENSE).
