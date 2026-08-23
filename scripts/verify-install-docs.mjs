import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  assert(
    existsSync(absolutePath),
    `Missing installation documentation file: ${relativePath}`,
  );
  return readFileSync(absolutePath, "utf8");
}

const matrix = read("docs/INSTALL_METHODS.md");
const executableSnippets = [...matrix.matchAll(/```(?:[^\n]*)\n([\s\S]*?)```/g)]
  .map((match) => match[1])
  .join("\n");
const readme = read("README.md");
const gettingStarted = read("docs/GETTING_STARTED.md");
const install = read("INSTALL.md");

for (const method of [
  "curl",
  "npm",
  "npx",
  "pnpm",
  "pnpx",
  "Yarn",
  "Bun",
  "bunx",
  "Deno",
  "uv",
  "uvx",
  "pip",
  "pipx",
  "Python",
  "Cargo",
  "Homebrew",
  "apt",
  "Nix",
  "Volta",
  "mise",
  "fnm",
  "nvm",
  "Corepack",
  "Rush",
  "Lerna",
  "cnpm",
  "Git",
]) {
  assert(
    matrix.includes(method),
    `Installation matrix is missing requested method: ${method}`,
  );
}

for (const requiredSnippet of [
  "git clone https://github.com/senkamaniskeny/utharness-os.git",
  "pnpm install --frozen-lockfile",
  "pnpm backend",
  "npm install --global @utharness/cli",
  "npx --yes --package @utharness/cli utharness-os --help",
  "pnpm add --global @utharness/cli",
  "bun add --global @utharness/cli",
  "deno run -A --node-modules-dir=auto npm:@utharness/cli/dist/index.js --help",
  "npm view @utharness/cli version",
  "pnpm --filter @utharness/cli pack --pack-destination artifacts",
]) {
  assert(
    matrix.includes(requiredSnippet),
    `Installation matrix is missing required copyable snippet: ${requiredSnippet}`,
  );
}

for (const unsupportedClaim of [
  "pip install utharness-os",
  "cargo install utharness-os",
  "brew install utharness-os",
  "apt install utharness-os",
  "nix profile install utharness-os",
]) {
  assert(
    !executableSnippets.includes(unsupportedClaim),
    `Installation matrix contains an unsupported executable install claim: ${unsupportedClaim}`,
  );
}

assert(
  readme.includes("(docs/INSTALL_METHODS.md)"),
  "README.md does not link to docs/INSTALL_METHODS.md",
);
assert(
  gettingStarted.includes("(INSTALL_METHODS.md)"),
  "docs/GETTING_STARTED.md does not link to INSTALL_METHODS.md",
);
assert(
  install.includes("(docs/INSTALL_METHODS.md)"),
  "INSTALL.md does not link to docs/INSTALL_METHODS.md",
);

assert(
  matrix.includes("no Python package named `utharness-os`"),
  "Python distribution boundary is not documented",
);
assert(
  matrix.includes("No Rust crate is published"),
  "Cargo distribution boundary is not documented",
);
assert(
  matrix.includes("does not contain `rush.json` or a Lerna configuration"),
  "Rush/Lerna configuration boundary is not documented",
);
assert(
  matrix.includes("The npm package may be unavailable"),
  "Package publication contingency is not documented",
);
assert(
  matrix.includes("Keep the backend bound to `127.0.0.1`"),
  "Local security boundary is not documented",
);

console.log(
  JSON.stringify(
    {
      status: "ok",
      checkedMethods: 27,
      checkedDocuments: [
        "README.md",
        "INSTALL.md",
        "docs/GETTING_STARTED.md",
        "docs/INSTALL_METHODS.md",
      ],
      nativeDistributionClaimsRejected: 5,
    },
    null,
    2,
  ),
);
