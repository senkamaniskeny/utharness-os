/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("utharnessDesktop", {
  getPlatform: () => ipcRenderer.invoke("utharness:platform"),
});
