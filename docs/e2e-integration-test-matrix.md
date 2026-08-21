# UTHARNESS OS end-to-end integration test matrix

This matrix translates the attached continuous-loop specification into executable checks against the real local backend, SQLite database, WebSocket stream, React renderer, and Electron-compatible build output. The test uses an isolated SQLite database and deterministic fixture data so it does not alter the developer’s normal local state.

| Requirement area | End-to-end scenario | Evidence required | Pass condition |
| --- | --- | --- | --- |
| Installation and startup | Frozen workspace install, backend build, frontend build, isolated service startup | Command output, process logs | Services start without compile or startup errors |
| REST health and system | Read health and system contracts from the live backend | HTTP response payloads | Health is healthy and required capability checks are present |
| Agent discovery | Register and scan multiple local-agent fixtures | `/api/agents`, detect response, persisted rows | Agents are visible with identity, runtime, status, and capabilities |
| Multi-agent tasks | Create independent tasks for several agents and advance them through queued, running, completed, and failed states | REST payloads, SQLite rows, event envelopes | State transitions persist and produce corresponding events |
| Team coordination | Create an agent team, assign roles, execute coordinated work, and inspect mailbox delivery | Team, task, mailbox API payloads | Team execution completes and messages are persisted/delivered |
| Workflow DAG | Create dependent workflow nodes and execute them in dependency order | Workflow run payloads and event order | Dependencies are respected and terminal status is correct |
| Terminal integration | Open, input, resize, and close an isolated terminal session | Terminal REST responses and lifecycle events | Session lifecycle succeeds without leaking processes |
| Live telemetry | Connect a WebSocket client while events are generated from tasks, teams, workflows, and terminal operations | Ordered event capture | Events arrive with valid type, payload, and timestamp |
| Frontend hydration | Open the production React preview against the isolated backend | Browser DOM/screenshot and network requests | Health, agents, tasks, and event sections show live data |
| Frontend live updates | Generate events after the page is open | Browser DOM and WebSocket state | Event feed updates and relevant REST state refreshes |
| WebSocket reconnect | Stop and restart the backend while the renderer remains open | Browser state and server logs | Client enters reconnecting/closed state and recovers to open |
| Command palette | Trigger `Ctrl+K`, search, launch a module, close with Escape | Browser DOM and interaction result | Palette is interactive and navigation changes |
| Theme control | Toggle dark/light theme from the UI | DOM theme attribute and visual screenshot | Full shell changes theme without losing runtime data |
| Error handling | Use invalid requests and temporarily unavailable backend | HTTP responses, UI error banner | Errors are explicit, bounded, and recoverable |
| Responsive behavior | Inspect desktop, tablet, and mobile viewport sizes | Browser screenshots and visible controls | Priority content remains usable at 320px, 768px, and desktop widths |
| Quality gates | Typecheck, unit/integration tests, lint, build, package, audit, whitespace | Command output and CI runs | All required local and remote checks pass |
| Publication | Clean tree, synchronized branch, public GitHub status | Git status, remote HEAD, workflow results | Verified changes are committed and pushed |

## Simulation fixtures

The scenario will use three deterministic agent fixtures: Architect, Implementer, and Reviewer. The Architect receives a planning task, the Implementer receives an implementation task dependent on the plan, and the Reviewer receives a validation task dependent on the implementation. A fourth negative-path fixture exercises a failed task and recovery state. The generated telemetry is not presented as production performance data; it is controlled event traffic used only to validate transport, persistence, ordering, and frontend rendering.
