import { app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, dialog, shell } from "electron";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "企智 QiZhi",
    backgroundColor: "#fafafa",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../out/index.html"));
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
    ? path.join(__dirname, "../public/icon.png")
    : path.join(__dirname, "../out/icon.png");

  try {
    const icon = nativeImage.createFromPath(iconPath);
    const resizedIcon = icon.resize({ width: 16, height: 16 });
    tray = new Tray(resizedIcon);
  } catch {
    // Fallback: use empty image
    tray = new Tray(nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: "打开企智", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "退出企智", click: () => { tray?.destroy(); app.quit(); } },
  ]);

  tray.setToolTip("企智 QiZhi");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => mainWindow?.show());
}

function registerShortcuts() {
  globalShortcut.register("CmdOrCtrl+Shift+Q", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerShortcuts();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
