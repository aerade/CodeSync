/**
 * Preload-слой: пробрасывает безопасный API в рендер-процесс через contextBridge.
 * Никакого Node API в рендере, только IPC-вызовы.
 */
import { contextBridge, ipcRenderer } from "electron";

const subs: Record<string, Set<(...args: unknown[]) => void>> = {};

function on(channel: string, cb: (...args: unknown[]) => void): () => void {
  if (!subs[channel]) {
    subs[channel] = new Set();
    ipcRenderer.on(channel, (_e, ...args) => {
      subs[channel]?.forEach((fn) => fn(...args));
    });
  }
  subs[channel].add(cb);
  return () => subs[channel].delete(cb);
}

const api = {
  platform: process.platform,
  isElectron: true,
  appVersion: process.env.npm_package_version ?? "0.1.0",

  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximizeToggle: () => ipcRenderer.send("window:maximizeToggle"),
    close: () => ipcRenderer.send("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (cb: (isMax: boolean) => void) => on("window:maximize-change", (v) => cb(Boolean(v))),
  },

  fs: {
    pickDirectory: () => ipcRenderer.invoke("fs:pickDirectory"),
    pickFile: () => ipcRenderer.invoke("fs:pickFile"),
    readDir: (path: string) => ipcRenderer.invoke("fs:readDir", path),
    readFile: (path: string) => ipcRenderer.invoke("fs:readFile", path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke("fs:writeFile", path, content),
    createFile: (path: string, content?: string) => ipcRenderer.invoke("fs:createFile", path, content ?? ""),
    createDir: (path: string) => ipcRenderer.invoke("fs:createDir", path),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke("fs:rename", oldPath, newPath),
    remove: (path: string) => ipcRenderer.invoke("fs:remove", path),
    exists: (path: string) => ipcRenderer.invoke("fs:exists", path),
    homeDir: () => ipcRenderer.invoke("fs:homeDir"),
    move: (srcPath: string, destDir: string) => ipcRenderer.invoke("fs:move", srcPath, destDir),
  },

  db: {
    listProjects: () => ipcRenderer.invoke("db:listProjects"),
    upsertProject: (p: unknown) => ipcRenderer.invoke("db:upsertProject", p),
    removeProject: (id: string) => ipcRenderer.invoke("db:removeProject", id),
    getSetting: (key: string) => ipcRenderer.invoke("db:getSetting", key),
    setSetting: (key: string, value: string) => ipcRenderer.invoke("db:setSetting", key, value),

    saveFileVersion: (filePath: string, content: string) =>
      ipcRenderer.invoke("db:saveFileVersion", filePath, content),
    listFileVersions: (filePath: string) => ipcRenderer.invoke("db:listFileVersions", filePath),
    getFileVersion: (id: number) => ipcRenderer.invoke("db:getFileVersion", id),

    listRecentRooms: () => ipcRenderer.invoke("db:listRecentRooms"),
    upsertRecentRoom: (room: unknown) => ipcRenderer.invoke("db:upsertRecentRoom", room),

    appendAiMessage: (scope: string, role: string, content: string) =>
      ipcRenderer.invoke("db:appendAiMessage", scope, role, content),
    listAiMessages: (scope: string, limit?: number) =>
      ipcRenderer.invoke("db:listAiMessages", scope, limit),
    clearAiHistory: (scope: string) => ipcRenderer.invoke("db:clearAiHistory", scope),
  },

  pty: {
    create: (opts: unknown) => ipcRenderer.invoke("pty:create", opts),
    write: (id: string, data: string) => ipcRenderer.send("pty:write", id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.send("pty:resize", id, cols, rows),
    kill: (id: string) => ipcRenderer.send("pty:kill", id),
    onData: (cb: (id: string, data: string) => void) => on("pty:data", (id, data) => cb(String(id), String(data))),
    onExit: (cb: (id: string, code: number) => void) => on("pty:exit", (id, code) => cb(String(id), Number(code))),
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.send("shell:openExternal", url),
    showInFolder: (path: string) => ipcRenderer.send("shell:showInFolder", path),
  },
  notify: (title: string, body?: string) => ipcRenderer.send("system:notify", { title, body }),
  onMenuAction: (cb: (action: string) => void) => on("menu:action", (a) => cb(String(a))),
  onGlobalShortcut: (cb: (action: string) => void) => on("global-shortcut", (a) => cb(String(a))),
};

contextBridge.exposeInMainWorld("desktopAPI", api);
