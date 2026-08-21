# Architecture

UTHARNESS OS uses a local-first monorepo with a single authoritative backend process in the initial release. Fastify owns HTTP lifecycle and request validation, the event bus owns in-process fan-out, and SQLite owns durable application state. The architecture is intentionally designed so the web, desktop, CLI, and TUI clients consume the same contracts instead of embedding domain logic.

## Runtime flow

```text
Client
  | REST / WebSocket
Fastify API
  | validates and authorizes
Domain services
  | registry, sessions, tasks, teams, workflows, permissions
SQLite + WAL
  |
Local agent processes
```

Agent discovery is adapter-driven. Each registered adapter reports whether its executable is available and exposes a capability list. The session manager is the only service allowed to create a process-backed session; it persists the session before attaching stream handlers, records process state, and emits lifecycle events. The process manager does not expose an arbitrary shell endpoint.

## Domain boundaries

| Boundary | Responsibility | Durable state |
| --- | --- | --- |
| Registry | Known agents and installations | `agents`, `agent_installations`, `agent_capabilities` |
| Runtime | Sessions, process lifecycle, stream messages | `sessions`, `processes`, `messages`, `terminal_sessions` |
| Coordination | Teams, tasks, dependencies, mailbox | `teams`, `team_members`, `tasks`, `task_dependencies`, `mailbox_messages` |
| Automation | Workflow definitions and runs | `workflows`, `workflow_runs`, `checkpoints` |
| Providers | Models and MCP registrations | `models`, `providers`, `mcp_servers` |
| Governance | Permissions, approvals, telemetry, audit | `permissions`, `approval_requests`, `telemetry`, `audit_logs` |
| Context | Memory and user settings | `memory`, `settings`, `skills`, `workspaces` |

## Frontend sequencing

The React and Electron clients are deliberately postponed until the backend contracts are stable. The first frontend milestone should generate typed clients from the REST schemas, subscribe to the WebSocket event envelope, and render live state from the API rather than maintaining a second source of truth.
