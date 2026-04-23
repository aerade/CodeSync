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

  onOpenSettings: (cb: () => void) => {
    ipcRenderer.on("open-settings", cb);
    return () => ipcRenderer.removeListener("open-settings", cb);
  },

  onServerRestarted: (cb: (data: { apiUrl: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { apiUrl: string }) => cb(data);
    ipcRenderer.on("server-restarted", handler);
    return () => ipcRenderer.removeListener("server-restarted", handler);
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
