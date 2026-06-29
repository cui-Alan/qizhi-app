import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke("get-version"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  onDeepLink: (callback: (url: string) => void) =>
    ipcRenderer.on("deep-link", (_event, url) => callback(url)),
});
