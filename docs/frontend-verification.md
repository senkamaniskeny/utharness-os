# Frontend verification note

The production Vite preview at `http://127.0.0.1:4173/` was opened in the browser against the local backend at `http://127.0.0.1:4317`. After adding the backend CORS allowlist, the dashboard rendered without a fetch error and displayed `Healthy`, `11/11 checks passing`, `SQLite`, the live `open` event stream state, Linux/x64 runtime metadata, and the configured REST/WebSocket endpoints. The initial failed fetch was traced to the backend’s `origin: false` CORS policy and fixed by allowing the local Vite origins plus the Electron `null` origin.
