# Frontend shell

UTHARNESS OS now includes a React web shell in `apps/web`, an Electron desktop wrapper in `apps/desktop`, and a shared browser-safe client in `packages/frontend-client`.

The React renderer presents a local operations dashboard for backend health, system metadata, agent registrations, task state, and live events. The dashboard loads durable state from the REST API and subscribes to `ws://127.0.0.1:4317/ws` for event updates. Agent and task events trigger a fresh REST read so the interface remains aligned with SQLite rather than treating the event stream as the authoritative store.

The Electron wrapper uses a hardened `BrowserWindow` with `contextIsolation`, `sandbox`, and `nodeIntegration: false`. It loads the Vite renderer from `apps/web/dist` in production and accepts `UTHARNESS_WEB_URL` for development. The preload bridge exposes only a small platform capability query; it does not expose Node.js or arbitrary IPC to the renderer.

## Commands

```bash
pnpm web
pnpm desktop
pnpm --filter @utharness/web build
pnpm --filter @utharness/desktop build
pnpm --filter @utharness/frontend-client test
```

The browser client defaults to the backend loopback address. Vite deployments may override `VITE_UTHARNESS_API_URL` and `VITE_UTHARNESS_WS_URL`; Electron deployments can point the renderer at a development server with `UTHARNESS_WEB_URL`.
