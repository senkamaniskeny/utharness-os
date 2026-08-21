import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
let windowRef: BrowserWindow | undefined;

function createWindow(): void {
  windowRef = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#0b0f14",
    title: "UTHARNESS OS",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.UTHARNESS_WEB_URL;
  if (devUrl) void windowRef.loadURL(devUrl);
  else void windowRef.loadFile(resolve(__dirname, "../../web/dist/index.html"));
  if (process.env.UTHARNESS_DEVTOOLS === "1") windowRef.webContents.openDevTools({ mode: "detach" });
  windowRef.on("closed", () => { windowRef = undefined; });
}

app.whenReady().then(() => {
  ipcMain.handle("utharness:platform", () => ({ platform: process.platform, arch: process.arch, version: app.getVersion() }));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
