/**
 * Универсальный мост между React-рендерером и нативным процессом Electron.
 *
 * В нативной сборке методы проксируются через window.desktopAPI (preload).
 * В обычном веб-превью используется fallback на localStorage / fetch / mock.
 * Это позволяет работать в одном проекте и в Electron, и в браузере.
 */

export type FsNode = {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: number;
};

export type Project = {
  id: string;
  name: string;
  path: string;
  type: "local" | "cloud";
  lastOpenedAt: number;
  cloudRoomId?: string;
};

export type LocalFileVersion = {
  id: number;
  filePath: string;
  content: string;
  createdAt: number;
  size: number;
};

export type RecentRoom = {
  id: string;
  inviteCode: string | null;
  title: string;
  lastJoinedAt: number;
};

export type AiHistoryRole = "user" | "assistant" | "system";
export type AiHistoryMessage = {
  id: number;
  scope: string;
  role: AiHistoryRole;
  content: string;
  createdAt: number;
};

export type PtyOptions = {
  cwd?: string;
  cols?: number;
  rows?: number;
  shell?: string;
};

export interface DesktopAPI {
  platform: "darwin" | "win32" | "linux" | "browser";
  isElectron: boolean;
  appVersion: string;

  // Окно
  window: {
    minimize(): void;
    maximizeToggle(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    onMaximizeChange(cb: (isMax: boolean) => void): () => void;
  };

  // Файловая система
  fs: {
    pickDirectory(): Promise<string | null>;
    pickFile(): Promise<string | null>;
    readDir(path: string): Promise<FsNode[]>;
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    createFile(path: string, content?: string): Promise<void>;
    createDir(path: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
    remove(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    homeDir(): Promise<string>;
    move(srcPath: string, destDir: string): Promise<string>;
  };

  // Локальная БД (SQLite)
  db: {
    listProjects(): Promise<Project[]>;
    upsertProject(p: Project): Promise<void>;
    removeProject(id: string): Promise<void>;
    getSetting(key: string): Promise<string | null>;
    setSetting(key: string, value: string): Promise<void>;

    saveFileVersion(filePath: string, content: string): Promise<number | null>;
    listFileVersions(filePath: string): Promise<LocalFileVersion[]>;
    getFileVersion(id: number): Promise<LocalFileVersion | null>;

    listRecentRooms(): Promise<RecentRoom[]>;
    upsertRecentRoom(room: RecentRoom): Promise<void>;

    appendAiMessage(scope: string, role: AiHistoryRole, content: string): Promise<number | null>;
    listAiMessages(scope: string, limit?: number): Promise<AiHistoryMessage[]>;
    clearAiHistory(scope: string): Promise<void>;
  };

  // Терминал (node-pty)
  pty: {
    create(opts: PtyOptions): Promise<string>; // sessionId
    write(sessionId: string, data: string): void;
    resize(sessionId: string, cols: number, rows: number): void;
    kill(sessionId: string): void;
    onData(cb: (sessionId: string, data: string) => void): () => void;
    onExit(cb: (sessionId: string, code: number) => void): () => void;
  };

  // Системные
  shell: {
    openExternal(url: string): void;
    showInFolder(path: string): void;
  };
  notify(title: string, body?: string): void;
  onMenuAction(cb: (action: string) => void): () => void;
  onGlobalShortcut(cb: (action: string) => void): () => void;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}

// ============================================================
// Браузерный fallback
// ============================================================
function makeBrowserBridge(): DesktopAPI {
  const noop = () => {};
  const emptyUnsub = () => noop;

  const subscribers = new Set<(action: string) => void>();
  if (typeof window !== "undefined") {
    (window as Window & { __dispatchMenuAction?: (a: string) => void }).__dispatchMenuAction = (a: string) => {
      subscribers.forEach((cb) => cb(a));
    };
  }

  const ls = typeof localStorage !== "undefined" ? localStorage : null;
  const PROJECTS_KEY = "codesync.desktop.projects";
  const SETTINGS_PREFIX = "codesync.desktop.set:";

  return {
    platform: "browser",
    isElectron: false,
    appVersion: "0.1.0-web",

    window: {
      minimize: noop,
      maximizeToggle: noop,
      close: noop,
      isMaximized: async () => false,
      onMaximizeChange: emptyUnsub,
    },

    fs: {
      pickDirectory: async () => null,
      pickFile: async () => null,
      readDir: async () => [],
      readFile: async (path) => {
        if (!ls) return "";
        return ls.getItem(`codesync.desktop.file:${path}`) ?? "";
      },
      writeFile: async (path, content) => {
        ls?.setItem(`codesync.desktop.file:${path}`, content);
      },
      createFile: async (path, content = "") => {
        ls?.setItem(`codesync.desktop.file:${path}`, content);
      },
      createDir: async () => {},
      rename: async (oldPath, newPath) => {
        if (!ls) return;
        const v = ls.getItem(`codesync.desktop.file:${oldPath}`);
        if (v !== null) {
          ls.setItem(`codesync.desktop.file:${newPath}`, v);
          ls.removeItem(`codesync.desktop.file:${oldPath}`);
        }
      },
      remove: async (path) => {
        ls?.removeItem(`codesync.desktop.file:${path}`);
      },
      exists: async (path) => {
        if (!ls) return false;
        return ls.getItem(`codesync.desktop.file:${path}`) !== null;
      },
      homeDir: async () => "/home/user",
      move: async (srcPath, destDir) => {
        if (!ls) return srcPath;
        const v = ls.getItem(`codesync.desktop.file:${srcPath}`);
        if (v === null) return srcPath;
        const name = srcPath.split(/[\\/]/).pop() ?? srcPath;
        const newPath = `${destDir.replace(/\/$/, "")}/${name}`;
        ls.setItem(`codesync.desktop.file:${newPath}`, v);
        ls.removeItem(`codesync.desktop.file:${srcPath}`);
        return newPath;
      },
    },

    db: {
      listProjects: async () => {
        if (!ls) return [];
        const raw = ls.getItem(PROJECTS_KEY);
        if (!raw) return [];
        try {
          return JSON.parse(raw) as Project[];
        } catch {
          return [];
        }
      },
      upsertProject: async (p) => {
        if (!ls) return;
        const list = JSON.parse(ls.getItem(PROJECTS_KEY) ?? "[]") as Project[];
        const idx = list.findIndex((x) => x.id === p.id);
        if (idx >= 0) list[idx] = p;
        else list.unshift(p);
        ls.setItem(PROJECTS_KEY, JSON.stringify(list.slice(0, 50)));
      },
      removeProject: async (id) => {
        if (!ls) return;
        const list = JSON.parse(ls.getItem(PROJECTS_KEY) ?? "[]") as Project[];
        ls.setItem(PROJECTS_KEY, JSON.stringify(list.filter((x) => x.id !== id)));
      },
      getSetting: async (key) => ls?.getItem(SETTINGS_PREFIX + key) ?? null,
      setSetting: async (key, v) => { ls?.setItem(SETTINGS_PREFIX + key, v ?? ""); },

      saveFileVersion: async (filePath, content) => {
        if (!ls) return null;
        const key = `codesync.desktop.versions:${filePath}`;
        const list = JSON.parse(ls.getItem(key) ?? "[]") as LocalFileVersion[];
        const next: LocalFileVersion = {
          id: Date.now(),
          filePath,
          content,
          createdAt: Date.now(),
          size: content.length,
        };
        list.unshift(next);
        ls.setItem(key, JSON.stringify(list.slice(0, 50)));
        return next.id;
      },
      listFileVersions: async (filePath) => {
        if (!ls) return [];
        const list = JSON.parse(ls.getItem(`codesync.desktop.versions:${filePath}`) ?? "[]");
        return Array.isArray(list) ? (list as LocalFileVersion[]) : [];
      },
      getFileVersion: async (id) => {
        if (!ls) return null;
        const all = Object.keys(ls).filter((k) => k.startsWith("codesync.desktop.versions:"));
        for (const k of all) {
          const list = JSON.parse(ls.getItem(k) ?? "[]") as LocalFileVersion[];
          const found = list.find((v) => v.id === id);
          if (found) return found;
        }
        return null;
      },

      listRecentRooms: async () => {
        if (!ls) return [];
        const list = JSON.parse(ls.getItem("codesync.desktop.recentRooms") ?? "[]");
        return Array.isArray(list) ? (list as RecentRoom[]) : [];
      },
      upsertRecentRoom: async (room) => {
        if (!ls) return;
        const list = JSON.parse(ls.getItem("codesync.desktop.recentRooms") ?? "[]") as RecentRoom[];
        const idx = list.findIndex((r) => r.id === room.id);
        if (idx >= 0) list[idx] = room;
        else list.unshift(room);
        list.sort((a, b) => b.lastJoinedAt - a.lastJoinedAt);
        ls.setItem("codesync.desktop.recentRooms", JSON.stringify(list.slice(0, 20)));
      },

      appendAiMessage: async (scope, role, content) => {
        if (!ls) return null;
        const key = `codesync.desktop.ai:${scope}`;
        const list = JSON.parse(ls.getItem(key) ?? "[]") as AiHistoryMessage[];
        const msg: AiHistoryMessage = { id: Date.now(), scope, role, content, createdAt: Date.now() };
        list.push(msg);
        ls.setItem(key, JSON.stringify(list.slice(-500)));
        return msg.id;
      },
      listAiMessages: async (scope, limit) => {
        if (!ls) return [];
        const list = JSON.parse(ls.getItem(`codesync.desktop.ai:${scope}`) ?? "[]") as AiHistoryMessage[];
        return list.slice(-(limit ?? 200));
      },
      clearAiHistory: async (scope) => {
        ls?.removeItem(`codesync.desktop.ai:${scope}`);
      },
    },

    pty: {
      create: async () => "",
      write: noop,
      resize: noop,
      kill: noop,
      onData: emptyUnsub,
      onExit: emptyUnsub,
    },

    shell: {
      openExternal: (url) => {
        if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
      },
      showInFolder: noop,
    },
    notify: (title, body) => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    },
    onMenuAction: (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    onGlobalShortcut: emptyUnsub,
  };
}

// ============================================================
// Публичный экземпляр
// ============================================================
let bridgeInstance: DesktopAPI | null = null;

export function desktop(): DesktopAPI {
  if (bridgeInstance) return bridgeInstance;
  if (typeof window !== "undefined" && window.desktopAPI) {
    bridgeInstance = window.desktopAPI;
  } else {
    bridgeInstance = makeBrowserBridge();
  }
  return bridgeInstance;
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.desktopAPI?.isElectron;
}
