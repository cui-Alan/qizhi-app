"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
let mainWindow = null;
let tray = null;
const isDev = !electron_1.app.isPackaged;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: "企智 QiZhi",
        backgroundColor: "#fafafa",
        titleBarStyle: "hiddenInset",
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (isDev) {
        mainWindow.loadURL("http://localhost:3000");
        mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    else {
        mainWindow.loadFile(node_path_1.default.join(__dirname, "../out/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
    mainWindow.on("close", (e) => {
        // Minimize to tray instead of closing
        if (tray) {
            e.preventDefault();
            mainWindow?.hide();
        }
    });
}
function createTray() {
    const iconPath = isDev
        ? node_path_1.default.join(__dirname, "../public/icon.png")
        : node_path_1.default.join(__dirname, "../out/icon.png");
    try {
        const icon = electron_1.nativeImage.createFromPath(iconPath);
        const resizedIcon = icon.resize({ width: 16, height: 16 });
        tray = new electron_1.Tray(resizedIcon);
    }
    catch {
        // Fallback: use empty image
        tray = new electron_1.Tray(electron_1.nativeImage.createEmpty());
    }
    const contextMenu = electron_1.Menu.buildFromTemplate([
        { label: "打开企智", click: () => mainWindow?.show() },
        { type: "separator" },
        { label: "退出企智", click: () => { tray?.destroy(); electron_1.app.quit(); } },
    ]);
    tray.setToolTip("企智 QiZhi");
    tray.setContextMenu(contextMenu);
    tray.on("double-click", () => mainWindow?.show());
}
function registerShortcuts() {
    electron_1.globalShortcut.register("CmdOrCtrl+Shift+Q", () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    createTray();
    registerShortcuts();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
        else
            mainWindow?.show();
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
electron_1.app.on("will-quit", () => {
    electron_1.globalShortcut.unregisterAll();
});
