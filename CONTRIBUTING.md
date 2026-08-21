# Contributing

Contributions should preserve the backend-first, local-first design. Start with an issue or discussion for new domain behavior, add or update a focused integration test, and keep API changes documented in `API.md`. New process capabilities must pass through an adapter and the permission engine rather than adding an arbitrary shell route.

Before opening a pull request, run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Commit messages should use the logical prefixes documented in the project roadmap, such as `feat:`, `test:`, `fix:`, `docs:`, and `ci:`.
