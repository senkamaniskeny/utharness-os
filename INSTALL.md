# Installation

UTHARNESS OS requires Node.js 22 or newer and pnpm. The complete command-by-command guide for npm, npx, pnpm, pnpx, Yarn, Bun, bunx, Deno, uv, uvx, pip, pipx, Python, Cargo, Homebrew, apt, Nix, Volta, mise, fnm, nvm, Corepack, Rush, Lerna, cnpm, curl, and Git is in [docs/INSTALL_METHODS.md](docs/INSTALL_METHODS.md). The verified source installation is:

```bash
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install
pnpm backend
```

The default data directory is `./data`. For a deterministic test database, set `UTHARNESS_DB=:memory:` in a test process. The CLI uses `UTHARNESS_URL` when it needs to target a non-default local port.

The backend is intentionally localhost-only. Do not set `UTHARNESS_ALLOW_REMOTE=1` unless the service is protected by an authenticated, encrypted, and rate-limited reverse proxy with an explicit threat model. Agent executables should be installed and trusted by the local operator before discovery is run.

The npm package name and command name are different: `@utharness/cli` provides the `utharness-os` and `utharness` binaries. If `npm view @utharness/cli version` returns a version, npm-compatible package managers can install that CLI package; otherwise use the Git source path or the local tarball procedure in [docs/INSTALL_METHODS.md](docs/INSTALL_METHODS.md). This repository does not currently claim native PyPI, Cargo, Homebrew, apt, or Nix packages.
