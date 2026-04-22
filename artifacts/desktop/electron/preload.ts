import { contextBridge, ipcRenderer } from "electron";

// Expose a safe, minimal API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // Get the configured backend API URL
  getApiUrl: (): Promise<string> => ipcRenderer.invoke("get-api-url"),

  // Platform detection
  platform: process.platform,

  // App version
  version: process.versions.electron,
});
