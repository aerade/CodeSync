import { contextBridge, ipcRenderer } from "electron";

const apiUrl: string = ipcRenderer.sendSync("get-api-url-sync") ?? "http://127.0.0.1:57321";

// Inject API URL globally before any React code runs
// globalThis in the preload context is the renderer window object
declare global { interface Window { __ELECTRON_API_URL__?: string; } }
(globalThis as unknown as Window).__ELECTRON_API_URL__ = apiUrl;

contextBridge.exposeInMainWorld("electronAPI", {
  getApiUrl: (): Promise<string> => ipcRenderer.invoke("get-api-url"),
  getApiUrlSync: (): string => apiUrl,

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

  platform: process.platform,
  version: process.versions.electron,
  isElectron: true,
});
