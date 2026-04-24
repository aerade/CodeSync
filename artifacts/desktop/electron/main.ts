/**
 * Главный процесс Electron для CodeSync Desktop.
 *
 * - В режиме разработки (NODE_ENV=development) подключается к Vite dev-серверу.
 * - В продакшене загружает собранные файлы из dist/public.
 * - Регистрирует IPC-обработчики для FS, SQLite и node-pty.
 * - Создаёт нативное меню на русском языке.
 */
import { app, BrowserWindow, ipcMain, shell, Notification, globalShortcut } from "electron";
import * as path from "path";
import * as fs from "fs";
import { registerFsHandlers } from "./ipc/fs";
import { registerDbHandlers } from "./ipc/db";
import { registerPtyHandlers } from "./ipc/pty";
import { buildMenu } from "./menu";

const isDev = process.env.NODE_ENV === "development";
const DEV_URL = process.env.VITE_DEV_URL ?? "http://localhost:5173/desktop/";

let mainWindow: BrowserWindow | null = null;

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
    const indexPath = path.join(__dirname, "..", "dist", "public", "index.html");
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error(`Файл рендерера не найден: ${indexPath}`);
    }
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });
}

function dispatchMenuAction(action: string) {
  mainWindow?.webContents.send("menu:action", action);
}

app.whenReady().then(() => {
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

  // Глобальные хоткеи (работают, даже когда окно не в фокусе)
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
