import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("utharnessDesktop", {
  getPlatform: (): Promise<{ platform: string; arch: string; version: string }> => ipcRenderer.invoke("utharness:platform"),
});
