# Live E2E Simulation Report

**Run date:** 2026-08-21 20:20 UTC+3  
**Environment:** Node.js 22.13.0, pnpm 11.21.0, Fastify backend on `127.0.0.1:4527`, clean SQLite database at `/tmp/utharness-e2e.sqlite`  
**Result:** **29/29 checks passed**

## Coverage

The simulation opened a WebSocket stream, verified health and system identity, registered and discovered three deterministic fixture agents, created parallel sessions, coordinated a team mailbox and team run, executed a dependency-aware workflow DAG, persisted failed and recovered task states, exercised terminal input/output/resize/close lifecycle, and verified task/event persistence after the workflow. It also confirmed live telemetry for health, agents, sessions, tasks, teams, workflows, and terminal output.

The terminal lifecycle assertion waits for `terminal.exit` and verifies the persisted terminal row is `stopped`. Session cleanup waits for both expected `agent.stopped` events, preventing the test from passing before asynchronous process cleanup completes.

## Event coverage

| Event type | Observed |
| --- | ---: |
| `system.health` | 1 |
| `agent.status` | 1 |
| `session.created` | 2 |
| `agent.output` | 2 |
| `team.created` | 1 |
| `team.message` | 1 |
| `task.created` | 8 |
| `task.running` | 4 |
| `task.completed` | 7 |
| `task.failed` | 1 |
| `team.member.status` | 1 |
| `workflow.started` | 1 |
| `workflow.step` | 3 |
| `workflow.completed` | 1 |
| `terminal.output` | 2 |
| `terminal.exit` | 1 |
| `agent.stopped` | 2 |

## Reproduction

Start the deterministic fixture backend and run the simulation from the repository root:

```bash
UTHARNESS_DB=/tmp/utharness-e2e.sqlite \
UTHARNESS_PORT=4527 \
UTHARNESS_RATE_LIMIT=1000 \
node scripts/e2e-test-server.mjs

E2E_BASE_URL=http://127.0.0.1:4527 pnpm e2e:live
```

The browser verification additionally confirmed that the dashboard remains usable while the backend is unavailable, displays `CLOSED` and `Reconnecting`, and automatically returns to `EVENT STREAM ONLINE`, `WebSocket synced`, and `STREAM OPEN` after the backend restarts with the same database.
