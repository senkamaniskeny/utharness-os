# Contributing to UTHARNESS OS

Thank you for contributing to UTHARNESS OS. The project is a backend-first, local-first monorepo. Contributions should preserve the principle that the backend owns durable state and process authority while the web, desktop, CLI, and TUI surfaces consume explicit REST and WebSocket contracts.

## Before you start

Read the [getting-started tutorial](docs/GETTING_STARTED.md), [architecture overview](README.md#architecture-overview), [API reference](API.md), [frontend guide](docs/FRONTEND.md), and [security policy](SECURITY.md). Do not commit secrets, local SQLite databases, generated screenshots, or vendor credentials. Agent executables and setup commands must come from a reviewed official source.

## Development workflow

Create a feature branch from the current `main` branch and install the frozen workspace:

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/short-description
pnpm install --frozen-lockfile
```

Make the smallest coherent change that satisfies the contract. Backend changes should validate input, persist authoritative state, publish an event when the operation is observable, and include integration coverage. Frontend changes should handle loading, empty, error, success, reconnect, and responsive states. Changes that launch processes or modify permissions must preserve the local-first security boundary.

## Required checks

Run these commands from the repository root before opening a pull request:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

When changing live workflows or the dashboard, also run the relevant browser or live regression scripts described in the repository documentation. The `Install smoke` workflow automatically installs the frozen lockfile, builds the workspace, starts a temporary local backend, checks health, and exercises the CLI on fresh Linux, macOS, and Windows hosted runners.

Review the diff and verify that only intended files are staged:

```bash
git diff --check
git status --short
git diff --stat
```

## Pull requests

Use a descriptive title and explain the user-visible behavior, architectural impact, security considerations, and verification performed. Link related issues when applicable. Keep pull requests focused so reviewers can reason about contract changes and failure handling.

The `main` branch is protected. Pull requests require an approving review and the repository’s required CI, tests, lint, typecheck, build, security, and CodeQL checks. Do not force-push or delete `main`.

## Commit and code conventions

Use clear imperative commit subjects such as `feat: add workflow retry controls`, `fix: reject invalid session input`, `docs: clarify local setup`, or `ci: verify fresh installation`. Keep TypeScript strict, prefer existing helpers and types, use the project’s Prettier and ESLint configuration, and avoid adding dependencies when a platform or existing workspace utility is sufficient.

## Reporting issues

Include the operating system, Node.js and pnpm versions, the command that failed, a sanitized error message, and whether the backend was running with default or overridden environment variables. Never include API keys, tokens, private source code, or unredacted environment dumps in an issue or pull request.
