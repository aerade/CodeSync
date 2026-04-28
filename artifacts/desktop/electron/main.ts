/**
 * Главный процесс Electron для CodeSync Desktop.
 *
 * - В режиме разработки (NODE_ENV=development) подключается к Vite dev-серверу.
 * - В продакшене раздаёт собранные файлы через встроенный HTTP-сервер (не file://)
 *   чтобы аутентификация и WebSocket работали корректно.
 * - Регистрирует IPC-обработчики для FS, SQLite и node-pty.
 * - Регистрирует протокол codesync:// для OAuth deep link.
 * - Создаёт нативное меню на русском языке.
 */
import { app, BrowserWindow, ipcMain, shell, Notification, globalShortcut } from "electron";
import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import { registerFsHandlers } from "./ipc/fs";
import { registerDbHandlers } from "./ipc/db";
import { registerPtyHandlers } from "./ipc/pty";
import { buildMenu } from "./menu";

const isDev = process.env.NODE_ENV === "development";
const DEV_URL = process.env.VITE_DEV_URL ?? "http://localhost:5173/desktop/";

let mainWindow: BrowserWindow | null = null;
let localServerPort: number | null = null;

// ─── Single-instance lock + deep-link (Windows / Linux) ──────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const deepLink = argv.find((a) => a.startsWith("codesync://"));
    if (deepLink) handleDeepLink(deepLink);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── Deep link handler ────────────────────────────────────────────────────────

function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.host === "auth") {
      const token = parsed.searchParams.get("token");
      const error = parsed.searchParams.get("error");
      mainWindow?.webContents.send("auth:oauth-callback", { token, error });
    }
  } catch (err) {
    console.error("Failed to parse deep link:", url, err);
  }
}

// ─── Local HTTP server for production ────────────────────────────────────────

async function startLocalServer(): Promise<number> {
  const distPath = path.join(__dirname, "..", "dist", "public");
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = (req.url ?? "/").split("?")[0];
      if (urlPath.startsWith("/desktop")) urlPath = urlPath.slice("/desktop".length) || "/";
      let filePath = path.join(distPath, urlPath === "/" ? "index.html" : urlPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distPath, "index.html");
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
        ".json": "application/json",
        ".webp": "image/webp",
      };
      res.writeHead(200, { "Content-Type": mime[ext] ?? "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve(addr.port);
    });
    server.on("error", reject);
  });
}

// ─── Create main window ───────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0F0F11",
    title: "CodeSync Desktop",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    titleBarOverlay: process.platform === "win32" ? {
      color: "#0F0F11",
      symbolColor: "#A1A1AA",
      height: 36,
    } : undefined,
    frame: process.platform === "darwin",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.on("maximize", () => mainWindow?.webContents.send("window:maximize-change", true));
  mainWindow.on("unmaximize", () => mainWindow?.webContents.send("window:maximize-change", false));

  if (isDev) {
    mainWindow.loadURL(DEV_URL).catch((err) => {
      console.error(`Не удалось подключиться к dev-серверу ${DEV_URL}:`, err);
    });
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${localServerPort}/desktop/`).catch((err) => {
      console.error("Failed to load from local server:", err);
    });
  }

  // Open all external URLs in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });
}

function dispatchMenuAction(action: string) {
  mainWindow?.webContents.send("menu:action", action);
}

// ─── Register codesync:// protocol before ready ───────────────────────────────

if (!app.isDefaultProtocolClient("codesync")) {
  if (isDev && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("codesync", process.execPath, [path.resolve(process.argv[1] ?? ".")]);
  } else {
    app.setAsDefaultProtocolClient("codesync");
  }
}

// macOS: deep link when app is already running
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!isDev) {
    try {
      localServerPort = await startLocalServer();
      console.log(`Local renderer server started on port ${localServerPort}`);
    } catch (err) {
      console.error("Failed to start local server:", err);
    }
  }

  registerFsHandlers(ipcMain);
  registerDbHandlers(ipcMain, app.getPath("userData"));
  registerPtyHandlers(ipcMain, () => mainWindow?.webContents);

  // Базовые window-команды
  ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);
  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximizeToggle", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on("window:close", () => mainWindow?.close());

  ipcMain.on("shell:openExternal", (_e, url: string) => {
    if (typeof url === "string") shell.openExternal(url).catch(() => {});
  });
  ipcMain.on("shell:showInFolder", (_e, p: string) => {
    if (typeof p === "string") shell.showItemInFolder(p);
  });
  ipcMain.on("system:notify", (_e, payload: { title: string; body?: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title: payload.title, body: payload.body }).show();
    }
  });

  buildMenu(dispatchMenuAction);
  createWindow();

  // Глобальные хоткеи
  const shortcuts: Array<{ accel: string; action: string }> = [
    { accel: "CommandOrControl+Shift+O", action: "open-folder" },
    { accel: "CommandOrControl+Shift+N", action: "new-file" },
    { accel: "CommandOrControl+Shift+T", action: "toggle-terminal" },
    { accel: "CommandOrControl+Shift+I", action: "toggle-ai" },
    { accel: "CommandOrControl+Shift+K", action: "command-palette" },
  ];
  for (const { accel, action } of shortcuts) {
    try {
      globalShortcut.register(accel, () => {
        if (mainWindow?.isMinimized()) mainWindow.restore();
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send("global-shortcut", action);
      });
    } catch (err) {
      console.warn(`Не удалось зарегистрировать глобальный хоткей ${accel}:`, err);
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
