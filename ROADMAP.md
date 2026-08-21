# Roadmap

| Stage | Outcome | Status |
| --- | --- | --- |
| Backend foundation | SQLite authority, Fastify API, WebSocket events, validation, security baseline | Complete for 0.1.0 |
| Agent coverage | Add first-class adapters for additional CLI, HTTP, and library agents with capability probes | Next |
| Runtime hardening | Add PTY backend, filesystem/network policy boundaries, cancellation checkpoints, and crash recovery | Planned |
| Client contracts | Generate typed API clients and lock the event schema | Planned |
| Frontend | Build React web and Electron desktop clients against the real contracts | Planned |
| Distribution | Cross-platform installers, signed releases, and npm packages | Planned |

The project will not claim a full production release until remote-access hardening, cross-platform process behavior, migration rollback strategy, PTY coverage, and frontend contract tests are complete.
