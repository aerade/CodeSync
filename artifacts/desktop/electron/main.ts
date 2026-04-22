import { app, BrowserWindow, Menu, shell, ipcMain } from "electron";
import * as path from "path";
import * as url from "url";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// Remote API server URL (override via CODESYNC_API_URL env var for self-hosting)
const API_URL = process.env.CODESYNC_API_URL ?? "https://your-codesync-server.com";

// In dev mode, point at the local Vite dev server
const DEV_URL = "http://localhost:21098/desktop/";

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0C0C0E",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    vibrancy: "under-window",
    visualEffectState: "active",
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // __dirname is dist/electron-main/, so go up one level to dist/public/
    win.loadFile(path.join(__dirname, "../public/index.html"));
  }

  win.once("ready-to-show", () => win.show());

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url: href }) => {
    if (href.startsWith("https://") || href.startsWith("http://")) {
      shell.openExternal(href);
    }
    return { action: "deny" };
  });

  return win;
}

function buildMenu(win: BrowserWindow) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "CodeSync",
      submenu: [
        { label: "About CodeSync", role: "about" },
        { type: "separator" },
        { label: "Hide CodeSync", role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { label: "Quit CodeSync", role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" }, { role: "redo" },
        { type: "separator" },
        { role: "cut" }, { role: "copy" }, { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" }, { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ role: "toggleDevTools" as const }] : []),
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => shell.openExternal("https://github.com/your-org/codesync#readme"),
        },
        {
          label: "Report an Issue",
          click: () => shell.openExternal("https://github.com/your-org/codesync/issues"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  const win = createWindow();
  buildMenu(win);

  // macOS: re-create window when dock icon is clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// IPC: expose API base URL to renderer
ipcMain.handle("get-api-url", () => API_URL);
