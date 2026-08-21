# Frontend shell

UTHARNESS OS now includes a React web shell in `apps/web`, an Electron desktop wrapper in `apps/desktop`, and a shared browser-safe client in `packages/frontend-client`.

The React renderer presents a local operations dashboard for backend health, system metadata, agent registrations, task state, and live events. The dashboard loads durable state from the REST API and subscribes to `ws://127.0.0.1:4317/ws` for event updates. Agent and task events trigger a fresh REST read so the interface remains aligned with SQLite rather than treating the event stream as the authoritative store.

The visual layer follows `docs/FRONTEND_DESIGN_DNA.json`: a deep-green local-first foundation, Liquid Glass shells, recessed HUD surfaces, pressed controls, progressive density, and responsive desktop/tablet/mobile layouts. `apps/web/src/components/ThreeDIcon.tsx` provides the shared 3D icon family. Each icon is built from layered CSS faces, back-depth, optical highlights, rim states, and a Lucide glyph core, allowing active, running, warning, error, and disabled states without requiring remote GLB assets or a network-only renderer. This keeps the icon system fast, inspectable, and usable inside the Electron shell.

The Electron wrapper uses a hardened `BrowserWindow` with `contextIsolation`, `sandbox`, and `nodeIntegration: false`. It loads the Vite renderer from `apps/web/dist` in production and accepts `UTHARNESS_WEB_URL` for development. The preload bridge exposes only a small platform capability query; it does not expose Node.js or arbitrary IPC to the renderer.

## Commands

```bash
pnpm web
pnpm desktop
pnpm --filter @utharness/web build
pnpm --filter @utharness/desktop build
pnpm --filter @utharness/frontend-client test
```

The browser client defaults to the backend loopback address. Vite deployments may override `VITE_UTHARNESS_API_URL` and `VITE_UTHARNESS_WS_URL`; Electron deployments can point the renderer at a development server with `UTHARNESS_WEB_URL`. The top bar exposes a command palette through the Search commands control or `Ctrl+K`, and the tactile theme toggle updates the complete shell between dark and light tokens without changing the backend connection.
