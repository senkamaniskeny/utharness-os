# Installation

UTHARNESS OS requires Node.js 22 or newer and pnpm. Clone the repository, install dependencies, and run the backend from the repository root:

```bash
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install
pnpm backend
```

The default data directory is `./data`. For a deterministic test database, set `UTHARNESS_DB=:memory:` in a test process. The CLI uses `UTHARNESS_URL` when it needs to target a non-default local port.

The backend is intentionally localhost-only. Do not set `UTHARNESS_ALLOW_REMOTE=1` unless the service is protected by an authenticated, encrypted, and rate-limited reverse proxy with an explicit threat model. Agent executables should be installed and trusted by the local operator before discovery is run.
