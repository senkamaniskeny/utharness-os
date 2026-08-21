# API reference

The backend exposes a local HTTP API at `http://127.0.0.1:4317` and a WebSocket stream at `ws://127.0.0.1:4317/ws`. JSON request bodies are validated with Zod; malformed bodies return `400`.

## System and agents

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Runtime and persistence health checks |
| `GET` | `/api/system` | Process, platform, version, and database metadata |
| `GET` | `/api/agents` | List persisted agent registrations |
| `POST` | `/api/agents/detect` | Run registered adapter discovery and persist results |
| `GET` | `/api/agents/:id` | Read one agent registration |

## Runtime and coordination

| Method | Route | Purpose |
| --- | --- | --- |
| `GET`/`POST` | `/api/sessions` | List or start a permission-checked agent session |
| `GET` | `/api/sessions/:id` | Read a session |
| `POST` | `/api/sessions/:id/input` | Send validated input to a live session |
| `DELETE` | `/api/sessions/:id` | Terminate a live session |
| `GET`/`POST` | `/api/tasks` | List or create tasks |
| `PATCH` | `/api/tasks/:id` | Advance a task status |
| `GET`/`POST` | `/api/teams` | List or create teams |
| `POST` | `/api/teams/:id/run` | Execute queued team tasks |
| `POST` | `/api/teams/:id/messages` | Deliver a mailbox message |
| `GET`/`POST` | `/api/workflows` | List or create workflow definitions |
| `POST` | `/api/workflows/:id/run` | Execute a workflow DAG |

## Registries and governance

The `/api/models`, `/api/providers`, `/api/mcp`, `/api/memory`, `/api/permissions`, `/api/approvals`, `/api/terminal`, `/api/telemetry`, `/api/audit`, and `/api/settings` resources support `GET` listing. Model, provider, MCP, memory, permission, and approval resources have validated write routes where the domain operation is implemented.

## WebSocket envelope

Every event uses the following shape:

```json
{
  "type": "task.completed",
  "payload": { "id": "...", "status": "completed" },
  "at": "2026-08-21T00:00:00.000Z"
}
```

Implemented event families include `agent.*`, `session.*`, `task.*`, `team.*`, `workflow.*`, `security.*`, and the initial `system.health` connection event.
