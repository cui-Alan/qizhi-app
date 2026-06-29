"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    isElectron: true,
    platform: process.platform,
    getVersion: () => electron_1.ipcRenderer.invoke("get-version"),
    openExternal: (url) => electron_1.ipcRenderer.invoke("open-external", url),
    onDeepLink: (callback) => electron_1.ipcRenderer.on("deep-link", (_event, url) => callback(url)),
});
