# UTHARNESS OS installation methods

UTHARNESS OS is a **Node.js 22+** local-first application. The repository’s canonical source-install contract is Git plus the workspace-managed **pnpm 11.21.0** toolchain. The published CLI package is named `@utharness/cli`, while the installed executable is named `utharness-os` and keeps `utharness` as a compatibility alias. These are different names: `utharness-os` is the command users run, and `@utharness/cli` is the npm package users install.

This page gives a copyable path for each requested installer, package manager, package runner, runtime, and environment manager. It deliberately distinguishes **verified**, **package-publication dependent**, **bootstrap-only**, **experimental**, and **not-native** paths. Do not interpret a wrapper command as proof that a package exists in that ecosystem.

> **Security rule:** UTHARNESS OS launches local processes and stores local state. Keep the backend bound to `127.0.0.1`, review [SECURITY.md](../SECURITY.md), and inspect any downloaded script before executing it. Never paste an arbitrary shell command into the agent installer API.

## Choose the right path

| Method or tool                        | Role                                                            | Status                                      | Recommended action                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Git + Corepack + pnpm                 | Source checkout and monorepo installation                       | **Verified and canonical**                  | Use this when developing UTHARNESS OS or when the npm CLI package is unavailable.                                                  |
| npm, npx, pnpm, pnpx, Yarn, Bun, bunx | Install or run the published `@utharness/cli` package           | **Available when the package is published** | Check `npm view @utharness/cli version` first; use the source fallback if it returns 404.                                          |
| cnpm                                  | npm-compatible registry client                                  | **Community/package-publication dependent** | Use only when `@utharness/cli` is visible through the configured registry.                                                         |
| Deno                                  | Node/npm compatibility runtime                                  | **Experimental**                            | Use only for CLI help/diagnostics after verifying Deno 2 Node/npm compatibility. The backend and Electron paths remain Node-based. |
| curl                                  | Download the GitHub source tarball or bootstrap another manager | **Bootstrap-only**                          | Prefer Git for reproducible history; pin a release or commit when using a tarball.                                                 |
| Python, pip, pipx, uv, uvx            | Python runtimes and Python tool runners                         | **Not native UTHARNESS installers**         | No PyPI package is published. Use these only to verify or bootstrap prerequisites, then follow the Node source path.               |
| Cargo                                 | Rust package manager                                            | **Not native**                              | No Rust crate is published. Use Git plus Node/pnpm instead.                                                                        |
| Homebrew, apt, Nix                    | Operating-system package managers                               | **Bootstrap-only**                          | Install Git and Node.js 22+, then use Corepack/pnpm.                                                                               |
| Volta, mise, fnm, nvm                 | Node.js environment managers                                    | **Bootstrap-only**                          | Provision Node.js 22, enable Corepack, then use the canonical pnpm path.                                                           |
| Corepack                              | Node package-manager dispatcher                                 | **Verified prerequisite path**              | Enable it to activate the workspace-pinned pnpm version.                                                                           |
| Rush, Lerna                           | JavaScript monorepo managers                                    | **Not configured by this repository**       | Do not run `rush install` or `lerna bootstrap`; this repository uses pnpm workspaces and Turborepo.                                |

The repository’s package metadata is the source of truth for the required Node and pnpm baseline. The fresh-install CI workflow validates checkout, frozen-lockfile installation, workspace build, temporary SQLite startup, backend health, and installed CLI behavior on Ubuntu, macOS, and Windows. See [`install-smoke.yml`](../.github/workflows/install-smoke.yml) and [`ci-install-smoke.mjs`](../scripts/ci-install-smoke.mjs).

## Before every installation

### Verify the machine

Run the following checks in a new terminal. The exact versions are intentionally visible so a failed install can be diagnosed without guessing:

```bash
node --version
npm --version
git --version
```

The workspace requires Node.js 22 or newer. If you are installing from source, continue with the package-manager check:

```bash
pnpm --version
```

### Verify a published CLI before using a package runner

The npm package may be unavailable on a development branch or before a release is published. Check first:

```bash
npm view @utharness/cli version
```

If this returns a version, use one of the package paths below. If it returns a 404 or registry error, use the [Git source installation](#git-source-installation-verified) instead.

## npm package paths

The following methods install or execute the published `@utharness/cli` package. They do not install the complete backend/web/Electron monorepo. After the CLI is installed, start a local backend separately or set `UTHARNESS_URL` to an existing local backend.

### npm: global CLI installation

Use this when `npm view @utharness/cli version` succeeds.

```bash
npm install --global @utharness/cli
utharness-os --help
utharness-os --version
utharness-os doctor
```

To use a non-default local backend:

```bash
UTHARNESS_URL=http://127.0.0.1:4317 utharness-os status
```

On PowerShell:

```powershell
$env:UTHARNESS_URL = "http://127.0.0.1:4317"
utharness-os status
```

### npx: one-shot CLI execution

This downloads the package into npx’s cache and runs the named binary without a permanent global installation:

```bash
npx --yes --package @utharness/cli utharness-os --help
npx --yes --package @utharness/cli utharness-os doctor
```

For repeat use, prefer a global installation or a project-local dependency so the version is explicit.

### pnpm: global CLI installation

```bash
pnpm add --global @utharness/cli
utharness-os --help
utharness-os status
```

If pnpm reports that a global binary directory is not configured, follow its printed `pnpm setup` instruction, restart the shell, and repeat the command. A one-shot alternative is:

```bash
pnpm dlx --package @utharness/cli utharness-os --help
```

### pnpx: one-shot CLI execution

`pnpx` is the pnpm package-runner alias. Use the package explicitly so the command name is unambiguous:

```bash
pnpx --package @utharness/cli utharness-os --help
pnpx --package @utharness/cli utharness-os doctor
```

### Yarn: global or project-local execution

Yarn Classic can install the CLI globally:

```bash
yarn global add @utharness/cli
utharness-os --help
utharness-os status
```

For modern Yarn, keep the package project-local and execute its binary through Yarn:

```bash
mkdir utharness-cli-runner
cd utharness-cli-runner
yarn init -2 -y
yarn add @utharness/cli
yarn exec utharness-os --help
yarn exec utharness-os doctor
```

### Bun: global CLI installation

```bash
bun add --global @utharness/cli
utharness-os --help
utharness-os status
```

Bun’s one-shot runner can be used when the package is published:

```bash
bunx --package @utharness/cli utharness-os --help
bunx --package @utharness/cli utharness-os doctor
```

### bunx: one-shot CLI execution

```bash
bunx --yes --package @utharness/cli utharness-os --help
```

If the installed Bun version does not recognize `--yes`, remove that flag; the package remains ephemeral either way:

```bash
bunx --package @utharness/cli utharness-os status
```

### cnpm: npm-compatible client

`cnpm` is not a separate UTHARNESS distribution. It can install the npm package only when the configured cnpm registry exposes `@utharness/cli`:

```bash
cnpm view @utharness/cli version
cnpm install --global @utharness/cli
utharness-os --help
utharness-os doctor
```

If the view command cannot find the package, do not create a fake Python, Rust, or cnpm package. Use the verified Git source installation instead.

### Deno: experimental Node/npm compatibility

The UTHARNESS CLI targets Node.js. Deno 2 can consume npm packages through its Node/npm compatibility layer, but this path is experimental and does not replace Node for the backend, Vite, or Electron. After verifying that the published package exists, try the CLI entry file with explicit permissions:

```bash
deno --version
deno run -A --node-modules-dir=auto npm:@utharness/cli/dist/index.js --help
deno run -A --node-modules-dir=auto npm:@utharness/cli/dist/index.js doctor
```

If your Deno version cannot resolve the package entry file or Node compatibility APIs used by the CLI, install Node.js 22 and use npm, pnpm, or the Git source path. Do not expose the backend remotely to compensate for a runtime mismatch.

## Git source installation (verified)

This is the **recommended path for contributors, unreleased branches, and users who want the complete UTHARNESS OS dashboard and backend**.

### Step 1: Clone the repository

```bash
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
```

To pin a known commit or release after cloning:

```bash
git fetch --tags --force
git checkout main
```

### Step 2: Enable the repository’s package manager

Node.js 22 includes Corepack support. Enable it, then let the `packageManager` field select pnpm 11.21.0:

```bash
corepack enable
pnpm --version
```

### Step 3: Install with the committed lockfile

```bash
pnpm install --frozen-lockfile
```

### Step 4: Start the backend

Use a first terminal:

```bash
pnpm backend
```

The default local backend is `http://127.0.0.1:4317`, the WebSocket stream is `ws://127.0.0.1:4317/ws`, and SQLite state is stored under `./data/utharness.sqlite` unless `UTHARNESS_DB` is set.

### Step 5: Start the dashboard

Use a second terminal in the repository root:

```bash
pnpm web
```

Open the Vite URL printed by the command, normally [http://127.0.0.1:5173](http://127.0.0.1:5173).

### Step 6: Discover and use local agents

In the dashboard, open **Agents**, choose **Detect installed**, select a detected CLI tool, configure its working directory, and choose **Open chat**. The equivalent CLI checks are:

```bash
pnpm cli doctor
pnpm cli agents scan
pnpm cli status
```

### Step 7: Validate the checkout

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## curl installation and download paths

`curl` is a transport tool, not a native UTHARNESS package manager. Use it either to install a Node environment manager or to download a source archive. Git is preferred because it preserves history and supports pinning.

### curl plus GitHub source tarball

This path downloads the public source archive, extracts it, and then uses Corepack/pnpm. Pin a release tag or commit instead of `main` for production deployments.

```bash
set -eu
workdir="${TMPDIR:-/tmp}/utharness-os-source"
rm -rf "$workdir"
mkdir -p "$workdir"
curl -fL https://github.com/senkamaniskeny/utharness-os/archive/refs/heads/main.tar.gz -o "$workdir/utharness-os.tar.gz"
tar -xzf "$workdir/utharness-os.tar.gz" -C "$workdir"
cd "$workdir"/utharness-os-main
corepack enable
pnpm install --frozen-lockfile
pnpm backend
```

### curl plus the Volta installer

This is a prerequisite bootstrap followed by the verified source installation. Inspect remote scripts according to your organization’s policy before executing them:

```bash
curl -fsSL https://get.volta.sh | bash
export VOLTA_HOME="$HOME/.volta"
export PATH="$VOLTA_HOME/bin:$PATH"
volta install node@22
volta install pnpm@11.21.0
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install --frozen-lockfile
pnpm backend
```

## Python, pip, pipx, uv, and uvx

There is **no Python package named `utharness-os` and no PyPI distribution for the UTHARNESS backend or CLI**. The application is Node.js/TypeScript, so these commands must not be presented as if `pip install utharness-os` were supported.

They can still be used to verify a Python-based workstation before following the Node source path:

### Python

```bash
python3 --version
python3 -c "import shutil; print('node:', shutil.which('node')); print('corepack:', shutil.which('corepack'))"
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm backend
```

### pip

`pip` cannot install the Node package. Use it only for Python tooling that your environment separately requires, then install UTHARNESS through Node:

```bash
python3 -m pip --version
python3 -m pip list --format=freeze > /tmp/utharness-python-tools.txt
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm cli doctor
```

### pipx

`pipx` isolates Python applications; it does not provide a UTHARNESS package. The safe compatibility path is:

```bash
pipx --version
pipx list
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm cli status
```

### uv

`uv` manages Python environments and tools. It is not a native installer for this Node repository:

```bash
uv --version
uv python list
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm backend
```

### uvx

`uvx` runs Python tools ephemerally. It cannot run `@utharness/cli` as a Python package. Use it for Python-side workstation checks, then follow the Node path:

```bash
uvx --version
uvx --help | head -n 5
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm cli agents scan
```

## Cargo

No Rust crate is published for UTHARNESS OS. Do not run `cargo install utharness-os`; it would target an unrelated or nonexistent crate. If Rust is part of your workstation toolchain, use Cargo only for your other projects and install UTHARNESS from source:

```bash
cargo --version
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm backend
```

## Operating-system package managers

### Homebrew

Homebrew can provide Git and a versioned Node.js runtime. After installation, use Corepack and pnpm for the repository:

```bash
brew update
brew install git node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
node --version
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm backend
```

If `node@22` is unavailable in your Homebrew channel, install the current supported Node 22 distribution using nvm, fnm, Volta, mise, or the official Node installer instead of silently using an older system Node.

### apt

Ubuntu’s default apt repository may provide a Node version older than the workspace requirement. Use apt for base utilities, then use a Node environment manager for Node 22:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git build-essential
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 22
nvm use 22
corepack enable
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install --frozen-lockfile
pnpm backend
```

### Nix

With flakes enabled, open a shell containing Node.js 22, Git, and curl, then use Corepack/pnpm:

```bash
nix shell nixpkgs#nodejs_22 nixpkgs#git nixpkgs#curl
node --version
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm backend
```

If your Nix channel uses a different Node 22 attribute, search it first:

```bash
nix search nixpkgs nodejs_22
```

## Node.js environment managers

All of these are **environment managers**, not alternate UTHARNESS package formats. Their job is to provide Node.js 22; Corepack then provides the pinned pnpm version.

### Volta

```bash
volta install node@22
volta install pnpm@11.21.0
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install --frozen-lockfile
pnpm backend
```

### mise

```bash
mise --version
mise use --global node@22
mise use --global pnpm@11.21.0
node --version
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install --frozen-lockfile
pnpm backend
```

If your mise registry does not provide pnpm directly, use the Node-provided dispatcher:

```bash
corepack enable
corepack pnpm --version
```

### fnm

```bash
fnm install 22
fnm use 22
corepack enable
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install --frozen-lockfile
pnpm backend
```

### nvm

```bash
nvm install 22
nvm use 22
nvm alias default 22
corepack enable
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
pnpm install --frozen-lockfile
pnpm backend
```

### Corepack

Corepack is the most direct way to activate the version declared by the repository:

```bash
corepack enable
corepack pnpm --version
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack pnpm install --frozen-lockfile
corepack pnpm backend
```

If the local Corepack build does not automatically honor the package-manager field, activate the exact version explicitly:

```bash
corepack prepare pnpm@11.21.0 --activate
pnpm --version
```

## Rush and Lerna

UTHARNESS OS is a pnpm workspace managed with Turborepo. It does not contain `rush.json` or a Lerna configuration, so `rush install`, `lerna bootstrap`, and `lerna add` are not supported installation commands for this repository.

### Rush workstation compatibility

If Rush is installed for other repositories, keep it separate and use the UTHARNESS package contract directly:

```bash
rush --version
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm backend
```

### Lerna workstation compatibility

```bash
lerna --version
git clone https://github.com/senkamaniskeny/utharness-os.git
cd utharness-os
corepack enable
pnpm install --frozen-lockfile
pnpm backend
```

These snippets verify that the surrounding workstation tools exist, but they intentionally do not invoke Rush or Lerna against the UTHARNESS workspace.

## Run the installed CLI against a local backend

Regardless of whether the CLI arrived through npm, npx, pnpm, pnpx, Yarn, Bun, cnpm, or the packed source artifact, the command talks to a local backend. Start the backend from a source checkout:

```bash
cd utharness-os
pnpm backend
```

Then use the installed command in another terminal:

```bash
utharness-os config
utharness-os status
utharness-os doctor
utharness-os agents scan
```

To use a different local port:

```bash
UTHARNESS_URL=http://127.0.0.1:4591 utharness-os status
```

The CLI does not embed or request provider API keys during installation. Agent-specific authentication remains the responsibility of the installed agent tool and local operator.

## Install the CLI from a locally packed artifact

This is the reproducible way to test the actual npm artifact before a public release:

```bash
pnpm install --frozen-lockfile
pnpm build
mkdir -p artifacts
pnpm --filter @utharness/cli pack --pack-destination artifacts
npm install --global ./artifacts/utharness-cli-0.1.0.tgz
utharness-os --help
utharness-os --version
utharness-os status
```

The repository’s CI runs this packed-artifact path in an isolated prefix on Ubuntu, macOS, and Windows. It exercises the installed executable outside the source tree and cleans up the temporary backend process and SQLite database afterward.

## Troubleshooting

| Symptom                                                          | Likely cause                                                                                   | Corrective action                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `node: command not found` or Node is below 22                    | An OS package manager supplied an older Node version or the environment manager is not active  | Run `node --version`, activate nvm/fnm/Volta/mise, or install Node 22 from the official distribution.         |
| `pnpm: command not found`                                        | Corepack is disabled or pnpm’s global bin directory is not on PATH                             | Run `corepack enable`, then `corepack pnpm --version`; for global pnpm, follow `pnpm setup`.                  |
| `npm view @utharness/cli version` returns 404                    | The CLI package is not published to the current registry or the release has not been published | Use the Git source installation or locally packed artifact path.                                              |
| `utharness-os doctor` reports the backend offline                | The backend is not running or `UTHARNESS_URL` points to the wrong port                         | Start `pnpm backend` and set `UTHARNESS_URL=http://127.0.0.1:4317`.                                           |
| Dashboard shows REST/WebSocket offline                           | The Vite build points at another backend port                                                  | Rebuild with matching `VITE_UTHARNESS_API_URL` and `VITE_UTHARNESS_WS_URL` values.                            |
| `pip install utharness-os` or `cargo install utharness-os` fails | No Python package or Rust crate is published                                                   | This is expected; use Node.js plus pnpm, or a published npm CLI package.                                      |
| Windows global command is not found                              | npm’s global bin directory is not on PATH                                                      | Restart the terminal after installation and add the npm global prefix shown by `npm prefix --global` to PATH. |
| Deno cannot run the CLI                                          | Node compatibility or a CLI dependency is unavailable in the selected Deno version             | Use Node.js 22 for the CLI and all backend/web/desktop commands.                                              |

## References

[1]: https://github.com/senkamaniskeny/utharness-os/blob/main/package.json UTHARNESS OS workspace package metadata and scripts
[2]: https://github.com/senkamaniskeny/utharness-os/blob/main/apps/cli/package.json UTHARNESS OS CLI package metadata and binary names
[3]: https://nodejs.org/en/download Node.js downloads
[4]: https://pnpm.io/installation pnpm installation
[5]: https://nodejs.org/api/corepack.html Corepack documentation
[6]: https://docs.npmjs.com/cli/v11/commands/npm-install npm install documentation
[7]: https://docs.npmjs.com/cli/v11/commands/npx npx documentation
[8]: https://yarnpkg.com/ Yarn documentation
[9]: https://bun.sh/docs/install Bun installation and package commands
[10]: https://docs.deno.com/runtime/fundamentals/node/ Deno Node/npm compatibility
[11]: https://docs.astral.sh/uv/ uv documentation
[12]: https://pip.pypa.io/en/stable/ pip documentation
[13]: https://pipx.pypa.io/stable/ pipx documentation
[14]: https://doc.rust-lang.org/cargo/ Cargo documentation
[15]: https://brew.sh/ Homebrew
[16]: https://ubuntu.com/server/docs/package-management/apt apt documentation
[17]: https://nixos.org/download/ Nix installation
[18]: https://docs.volta.sh/ Volta documentation
[19]: https://mise.jdx.dev/ mise documentation
[20]: https://github.com/Schniz/fnm fnm documentation
[21]: https://github.com/nvm-sh/nvm nvm documentation
[22]: https://rushjs.io/ Rush documentation
[23]: https://lerna.js.org/ Lerna documentation
[24]: https://github.com/cnpm/cnpm cnpm documentation
[25]: https://git-scm.com/book/en/v2 Git documentation
[26]: https://curl.se/docs/ curl documentation
[27]: https://github.com/senkamaniskeny/utharness-os/blob/main/.github/workflows/install-smoke.yml Fresh-install CI workflow
[28]: https://github.com/senkamaniskeny/utharness-os/blob/main/scripts/ci-install-smoke.mjs Installed-CLI smoke runner
