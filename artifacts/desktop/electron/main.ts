import { app, BrowserWindow, Menu, shell, ipcMain, safeStorage, dialog } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as net from "net";
import * as crypto from "crypto";
import { spawn } from "child_process";
import type { ChildProcess } from "child_process";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const DEV_URL = "http://localhost:21098/desktop/";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let serverPort = 57321;
let serverReady = false;

const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");
const SECRETS_FILE = path.join(app.getPath("userData"), "secrets.json");

interface AppSecrets { jwtSecret: string; internalToken: string; }

function loadOrCreateSecrets(): AppSecrets {
  try {
    if (fs.existsSync(SECRETS_FILE)) {
      const raw = fs.readFileSync(SECRETS_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppSecrets>;
      if (parsed.jwtSecret && parsed.internalToken) {
        return parsed as AppSecrets;
      }
    }
  } catch { /* will recreate */ }
  const secrets: AppSecrets = {
    jwtSecret: crypto.randomBytes(32).toString("hex"),
    internalToken: crypto.randomBytes(32).toString("hex"),
  };
  fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2), "utf8");
  return secrets;
}

const appSecrets = loadOrCreateSecrets();

interface Settings {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  firstRun?: boolean;
}

function loadSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
      const data = JSON.parse(raw) as Settings;
      if (safeStorage.isEncryptionAvailable() && data.openaiApiKey) {
        try { data.openaiApiKey = safeStorage.decryptString(Buffer.from(data.openaiApiKey, "base64")); } catch {}
      }
      if (safeStorage.isEncryptionAvailable() && data.anthropicApiKey) {
        try { data.anthropicApiKey = safeStorage.decryptString(Buffer.from(data.anthropicApiKey, "base64")); } catch {}
      }
      return data;
    }
  } catch {}
  return { firstRun: true };
}

function saveSettings(settings: Settings): void {
  const toSave = { ...settings };
  if (safeStorage.isEncryptionAvailable()) {
    if (toSave.openaiApiKey) {
      toSave.openaiApiKey = safeStorage.encryptString(toSave.openaiApiKey).toString("base64");
    }
    if (toSave.anthropicApiKey) {
      toSave.anthropicApiKey = safeStorage.encryptString(toSave.anthropicApiKey).toString("base64");
    }
  }
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toSave, null, 2), "utf8");
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Could not get free port"));
        }
      });
    });
    server.on("error", reject);
  });
}

function getServerPath(): string {
  if (isDev) {
    return path.join(__dirname, "../../server/dist/server.cjs");
  }
  return path.join(process.resourcesPath, "server", "server.cjs");
}

function getDbPath(): string {
  return path.join(app.getPath("userData"), "codesync.db");
}

async function startServer(reusePort?: number): Promise<void> {
  const settings = loadSettings();
  const serverPath = getServerPath();

  if (!fs.existsSync(serverPath)) {
    if (!isDev) {
      dialog.showErrorBox("Server Error", `Embedded server not found at:\n${serverPath}\n\nPlease reinstall CodeSync.`);
    }
    return;
  }

  // Reuse existing port on restart so frontend API_BASE stays valid
  if (reusePort !== undefined) {
    serverPort = reusePort;
  } else {
    try { serverPort = await getFreePort(); } catch { serverPort = 57321; }
  }

  // Normalize path separators: libsql file: URLs need forward slashes on Windows
  const dbPath = getDbPath().replace(/\\/g, "/");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(serverPort),
    DATABASE_URL: dbPath,
    NODE_ENV: "production",
    JWT_SECRET: appSecrets.jwtSecret,
    INTERNAL_TOKEN: appSecrets.internalToken,
  };

  if (settings.openaiApiKey) env.OPENAI_API_KEY = settings.openaiApiKey;
  if (settings.anthropicApiKey) env.ANTHROPIC_API_KEY = settings.anthropicApiKey;

  const serverDir = path.dirname(serverPath);
  const logPath = path.join(app.getPath("userData"), "server.log");
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  // Use system node.exe (not Electron's bundled Node) so prebuilt native
  // modules like @libsql/win32-x64-msvc load with the correct ABI.
  serverProcess = spawn("node", [serverPath], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    cwd: serverDir,
  });

  serverProcess.stdout?.on("data", (d: Buffer) => {
    const line = d.toString();
    console.log("[server]", line.trim());
    logStream.write(`[OUT] ${line}`);
  });
  serverProcess.stderr?.on("data", (d: Buffer) => {
    const line = d.toString();
    console.error("[server-err]", line.trim());
    logStream.write(`[ERR] ${line}`);
  });

  serverProcess.on("error", (err: Error & { code?: string }) => {
    console.error("[electron] Server process error:", err);
    if (err.code === "ENOENT") {
      dialog.showErrorBox(
        "Сервер не запустился",
        "Node.js не найден в PATH.\n\nУбедитесь, что Node.js установлен и добавлен в PATH,\nзатем перезапустите приложение.",
      );
    }
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && mainWindow) {
      console.warn(`[electron] Server exited with code ${code}`);
    }
    serverProcess = null;
    serverReady = false;
  });

  await waitForServer(serverPort, 30);
  serverReady = true;
  console.log(`[electron] Embedded server ready on port ${serverPort}`);
}

async function waitForServer(port: number, maxAttempts: number): Promise<void> {
  const http = await import("http");
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/api/healthz`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(1000, () => { req.destroy(); resolve(false); });
    });
    if (ok) return;
  }
  throw new Error(`Server did not become ready after ${maxAttempts * 0.5}s`);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0C0C0E",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 12, y: 12 } : undefined,
    icon: path.join(__dirname, "../public/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../public/index.html"));
  }

  // Always open DevTools so errors are visible (remove once stable)
  mainWindow.webContents.openDevTools({ mode: "detach" });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: href }) => {
    if (href.startsWith("https://") || href.startsWith("http://")) {
      shell.openExternal(href);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin" ? [{
      label: "CodeSync",
      submenu: [
        { label: "About CodeSync", role: "about" as const },
        { type: "separator" as const },
        { label: "Settings", accelerator: "Cmd+,", click: () => openSettings() },
        { type: "separator" as const },
        { label: "Quit CodeSync", role: "quit" as const },
      ],
    }] : []),
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const }, { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const }, { role: "copy" as const }, { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" as const }, { role: "forceReload" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const }, { role: "zoomIn" as const }, { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
        { type: "separator" as const },
        { role: "toggleDevTools" as const },
      ],
    },
    {
      label: "Tools",
      submenu: [
        { label: "Settings", accelerator: process.platform === "darwin" ? "Cmd+," : "Ctrl+,", click: () => openSettings() },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openSettings(): void {
  mainWindow?.webContents.send("open-settings");
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle("get-api-url", () => {
  return `http://127.0.0.1:${serverPort}`;
});

ipcMain.on("get-api-url-sync", (event) => {
  event.returnValue = `http://127.0.0.1:${serverPort}`;
});

ipcMain.on("get-internal-token-sync", (event) => {
  event.returnValue = appSecrets.internalToken;
});

ipcMain.handle("get-settings", () => {
  const settings = loadSettings();
  return {
    openaiApiKey: settings.openaiApiKey ?? "",
    anthropicApiKey: settings.anthropicApiKey ?? "",
    firstRun: settings.firstRun ?? false,
  };
});

ipcMain.handle("save-settings", async (_event, settings: { openaiApiKey?: string; anthropicApiKey?: string }) => {
  const current = loadSettings();
  const updated = { ...current, ...settings, firstRun: false };
  saveSettings(updated);

  if (serverProcess && serverProcess.pid) {
    const currentPort = serverPort;
    serverProcess.kill("SIGTERM");
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    await startServer(currentPort);  // reuse same port — keeps frontend API_BASE valid
    mainWindow?.webContents.send("server-restarted", { apiUrl: `http://127.0.0.1:${serverPort}` });
  }

  return { ok: true };
});

ipcMain.handle("get-app-version", () => app.getVersion());

// ─── Auto-Updater ─────────────────────────────────────────────────────────────

async function setupAutoUpdater(): Promise<void> {
  try {
    const { autoUpdater } = await import("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info) => {
      mainWindow?.webContents.send("update-available", {
        version: info.version,
        releaseNotes: info.releaseNotes ?? null,
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      mainWindow?.webContents.send("update-download-progress", {
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      mainWindow?.webContents.send("update-downloaded", {
        version: info.version,
      });
    });

    autoUpdater.on("error", (err) => {
      console.warn("[auto-updater] error:", err?.message ?? err);
    });

    ipcMain.on("install-update", () => {
      autoUpdater.quitAndInstall();
    });

    await autoUpdater.checkForUpdatesAndNotify();
  } catch (err: any) {
    console.warn("[auto-updater] not available:", err?.message ?? err);
  }
}

ipcMain.on("install-update", () => {
  console.warn("[auto-updater] updater not initialized");
});

// Dev-only: allows the renderer to trigger a mock update-available event
// so the release-notes UI can be validated without a real update server.
if (isDev) {
  ipcMain.handle("mock-update-available", () => {
    mainWindow?.webContents.send("update-available", {
      version: "9.9.9",
      releaseNotes:
        "## What's new\n\n- **Improved performance** when loading large rooms\n- Fixed a crash on reconnect\n- Dark mode polish across all dialogs\n\nSee the [full changelog](https://github.com) for details.",
    });
  });
}

// ─── Server background startup (non-blocking) ─────────────────────────────────

async function startServerInBackground(): Promise<void> {
  try {
    await startServer(serverPort);
    serverReady = true;
    mainWindow?.webContents.send("server-ready");
    console.log("[electron] Server ready, signaling renderer");

    // On first run, open settings so user can add API keys
    const settings = loadSettings();
    if (settings.firstRun) {
      setTimeout(() => mainWindow?.webContents.send("open-settings"), 1000);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[electron] Server startup failed:", msg);
    mainWindow?.webContents.send("server-error", {
      message: "Встроенный сервер не запустился. Проверьте логи в папке AppData/Roaming/CodeSync/server.log",
    });
    dialog.showErrorBox(
      "Сервер не запустился",
      `Встроенный сервер не смог запуститься.\n\nОшибка: ${msg}\n\nЛоги: %APPDATA%\\CodeSync\\server.log`,
    );
  }
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Pre-allocate port so preload sees the correct API URL before the server starts
  try { serverPort = await getFreePort(); } catch { serverPort = 57321; }

  // Create window immediately — renderer shows loading screen while server starts
  createWindow();
  buildMenu();

  if (!isDev) setupAutoUpdater();

  // Start the embedded server in the background; signal renderer when ready
  startServerInBackground();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (serverProcess) serverProcess.kill("SIGTERM");
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
});
