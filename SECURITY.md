# Security policy

UTHARNESS OS is a local process orchestrator. It can launch installed executables, pass environment variables, read and write within operator-selected working directories, and connect to registered providers. Treat the backend as a privileged local service.

The default server binds only to loopback. Requests are rejected from non-loopback addresses unless `UTHARNESS_ALLOW_REMOTE=1` is explicitly set. Request bodies are bounded, mutating inputs are schema-validated, and a rate limiter protects the API. Process startup, input, and termination pass through the permission engine; dangerous actions fail closed when no allow rule exists. Permission changes create audit records, and runtime events are persisted for diagnostics.

Do not place API keys or provider secrets in committed files. Environment variables are merged only for a selected session, and operator-provided process environments should be minimized. Do not register an executable unless its provenance and command-line behavior are trusted. Filesystem boundaries and network policy will be expanded before remote access is considered production-ready.

Electron 39.8.10 currently resolves `extract-zip` 2.0.1, whose upstream advisory has no published npm fix despite the registry audit metadata. UTHARNESS carries a local patch at `patches/extract-zip@2.0.1.patch` that rejects symbolic-link archive entries, closing the relevant traversal behavior. The CI audit ignores only `GHSA-jmr9-qjv8-65gv` and keeps the exception visible in the workflow rather than suppressing the entire audit.

Report vulnerabilities privately through the repository security-advisory mechanism. Do not include live credentials, private workspace contents, or exploit payloads in public issues.
