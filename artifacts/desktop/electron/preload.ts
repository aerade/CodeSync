import { contextBridge, ipcRenderer } from "electron";

const apiUrl: string = ipcRenderer.sendSync("get-api-url-sync") ?? "http://127.0.0.1:57321";
const internalToken: string = ipcRenderer.sendSync("get-internal-token-sync") ?? "";

// With contextIsolation: true, the ONLY reliable way to share values with the renderer
// is contextBridge.exposeInMainWorld — direct globalThis assignments are invisible to
// the renderer's JavaScript world.
contextBridge.exposeInMainWorld("electronAPI", {
  getApiUrl: (): Promise<string> => ipcRenderer.invoke("get-api-url"),
  getApiUrlSync: (): string => apiUrl,
  getInternalTokenSync: (): string => internalToken,

  getSettings: (): Promise<{ openaiApiKey: string; anthropicApiKey: string; firstRun: boolean }> =>
    ipcRenderer.invoke("get-settings"),

  saveSettings: (settings: { openaiApiKey?: string; anthropicApiKey?: string }): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("save-settings", settings),

  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
  getServerStatus: (): Promise<{ ready: boolean; port: number }> =>
    ipcRenderer.invoke("get-server-status"),

  onOpenSettings: (cb: () => void) => {
    ipcRenderer.on("open-settings", cb);
    return () => ipcRenderer.removeListener("open-settings", cb);
  },

  // Binary encoding helpers: the sandboxed renderer (nodeIntegration: false,
  // sandbox: true) has no Node.js Buffer. The preload runs in a privileged
  // context with full Node.js, so we expose Buffer-based encoding here.
  binaryToBase64: (bytes: number[]): string => Buffer.from(bytes).toString("base64"),
  base64ToBinary: (b64: string): number[] => Array.from(Buffer.from(b64, "base64")),

  onServerReady: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("server-ready", handler);
    return () => ipcRenderer.removeListener("server-ready", handler);
  },

  onServerError: (cb: (data: { message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { message: string }) => cb(data);
    ipcRenderer.on("server-error", handler);
    return () => ipcRenderer.removeListener("server-error", handler);
  },

  onServerRestarted: (cb: (data: { apiUrl: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { apiUrl: string }) => cb(data);
    ipcRenderer.on("server-restarted", handler);
    return () => ipcRenderer.removeListener("server-restarted", handler);
  },

  onUpdateProgress: (cb: (data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => cb(data);
    ipcRenderer.on("update-download-progress", handler);
    return () => ipcRenderer.removeListener("update-download-progress", handler);
  },

  onUpdateAvailable: (cb: (data: { version: string; releaseNotes: string | null }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { version: string; releaseNotes: string | null }) => cb(data);
    ipcRenderer.on("update-available", handler);
    return () => ipcRenderer.removeListener("update-available", handler);
  },

  onUpdateDownloaded: (cb: (data: { version: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { version: string }) => cb(data);
    ipcRenderer.on("update-downloaded", handler);
    return () => ipcRenderer.removeListener("update-downloaded", handler);
  },

  installUpdate: () => ipcRenderer.send("install-update"),

  // Triggers a mock update-available IPC event from the main process so the
  // release-notes UI can be tested end-to-end in the Electron dev environment.
  // The main process only registers the handler when isDev (!app.isPackaged),
  // so this is effectively a no-op in production builds.
  mockUpdateAvailable: () => ipcRenderer.invoke("mock-update-available"),

  platform: process.platform,
  version: process.versions.electron,
  isElectron: true,
});
