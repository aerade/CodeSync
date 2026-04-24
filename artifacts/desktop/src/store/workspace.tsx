import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { desktop, type Project } from "@/lib/desktopBridge";
import { detectLanguage } from "@/lib/utils";
import { nanoid } from "nanoid";

export type OpenTab = {
  id: string;
  filePath: string;     // абсолютный путь / cloud://room/<roomId>/<fileId>
  fileName: string;
  language: string;
  content: string;
  isDirty: boolean;
  scratch?: boolean;    // не привязан к диску
  cloudRoomId?: string; // для облачных файлов
  cloudFileId?: string; // для облачных файлов
};

export type TermSession = {
  id: string;     // локальный uuid
  title: string;
  cwd?: string;
};

type WorkspaceState = {
  currentProject: Project | null;
  recentProjects: Project[];
  tabs: OpenTab[];
  activeTabId: string | null;

  termSessions: TermSession[];
  activeTermId: string | null;

  // Видимость панелей
  showLeftSidebar: boolean;
  showRightPanel: boolean;
  showBottomPanel: boolean;
  rightPanelView: "ai" | "history";
  bottomPanelView: "terminal" | "problems" | "output";
  activitySection: "files" | "search" | "rooms" | "git" | "extensions";
};

type WorkspaceActions = {
  openProject: (project: Project) => Promise<void>;
  closeProject: () => void;
  refreshRecentProjects: () => Promise<void>;
  addRecentProject: (project: Project) => Promise<void>;
  removeRecentProject: (id: string) => Promise<void>;

  openFile: (path: string) => Promise<void>;
  openCloudFile: (roomId: string, fileId: string, name: string, initialContent: string) => void;
  openScratch: (lang?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  saveActiveTab: () => Promise<void>;
  saveTab: (id: string) => Promise<void>;

  // Файловые операции
  createFileAt: (parentDir: string, name: string) => Promise<string | null>;
  createDirAt: (parentDir: string, name: string) => Promise<string | null>;
  renamePath: (oldPath: string, newName: string) => Promise<string | null>;
  deletePath: (path: string) => Promise<void>;
  movePath: (srcPath: string, destDir: string) => Promise<string | null>;

  // Терминал
  newTerminal: () => string;
  closeTerminal: (id: string) => void;
  setActiveTerm: (id: string) => void;

  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setRightPanelView: (v: WorkspaceState["rightPanelView"]) => void;
  setBottomPanelView: (v: WorkspaceState["bottomPanelView"]) => void;
  setActivitySection: (s: WorkspaceState["activitySection"]) => void;

  treeRefreshKey: number;
  refreshTree: () => void;
};

type Ctx = WorkspaceState & WorkspaceActions;

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [termSessions, setTermSessions] = useState<TermSession[]>([]);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);

  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<WorkspaceState["rightPanelView"]>("ai");
  const [bottomPanelView, setBottomPanelView] = useState<WorkspaceState["bottomPanelView"]>("terminal");
  const [activitySection, setActivitySection] = useState<WorkspaceState["activitySection"]>("files");
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);

  const refreshTree = useCallback(() => setTreeRefreshKey((k) => k + 1), []);

  const refreshRecentProjects = useCallback(async () => {
    const list = await desktop().db.listProjects();
    list.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    setRecentProjects(list);
  }, []);

  useEffect(() => {
    refreshRecentProjects();
  }, [refreshRecentProjects]);

  const addRecentProject = useCallback(async (project: Project) => {
    await desktop().db.upsertProject(project);
    await refreshRecentProjects();
  }, [refreshRecentProjects]);

  const removeRecentProject = useCallback(async (id: string) => {
    await desktop().db.removeProject(id);
    await refreshRecentProjects();
  }, [refreshRecentProjects]);

  const openProject = useCallback(async (project: Project) => {
    const updated = { ...project, lastOpenedAt: Date.now() };
    await desktop().db.upsertProject(updated);
    setCurrentProject(updated);
    setTabs([]);
    setActiveTabId(null);
    setTermSessions([]);
    setActiveTermId(null);
    await refreshRecentProjects();
  }, [refreshRecentProjects]);

  const closeProject = useCallback(() => {
    setCurrentProject(null);
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const openFile = useCallback(async (path: string) => {
    const existing = tabs.find((t) => t.filePath === path);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const fileName = path.split(/[\\/]/).pop() ?? path;
    let content = "";
    try {
      content = await desktop().fs.readFile(path);
    } catch (err) {
      console.warn("Не удалось прочитать файл", path, err);
    }
    const tab: OpenTab = {
      id: nanoid(8),
      filePath: path,
      fileName,
      language: detectLanguage(fileName),
      content,
      isDirty: false,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [tabs]);

  const openCloudFile = useCallback((roomId: string, fileId: string, name: string, initialContent: string) => {
    const filePath = `cloud://room/${roomId}/${fileId}`;
    const existing = tabs.find((t) => t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const tab: OpenTab = {
      id: nanoid(8),
      filePath,
      fileName: name,
      language: detectLanguage(name),
      content: initialContent,
      isDirty: false,
      cloudRoomId: roomId,
      cloudFileId: fileId,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [tabs]);

  const openScratch = useCallback((lang: string = "typescript") => {
    const tab: OpenTab = {
      id: nanoid(8),
      filePath: `untitled-${Date.now()}`,
      fileName: `Без названия (${lang})`,
      language: lang,
      content: "",
      isDirty: false,
      scratch: true,
    };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (id === activeTabId) {
        const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null;
        setActiveTabId(fallback?.id ?? null);
      }
      return next;
    });
  }, [activeTabId]);

  const setActiveTab = useCallback((id: string) => setActiveTabId(id), []);

  const updateTabContent = useCallback((id: string, content: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, content, isDirty: !t.scratch } : t)));
  }, []);

  const saveTab = useCallback(async (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab || tab.scratch) return;
    if (tab.cloudRoomId && tab.cloudFileId) {
      // Облачный файл сохраняется автоматически через Yjs; снапшот делаем явно.
      try {
        const guestToken = await desktop().db.getSetting("guestToken").catch(() => null);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (guestToken) headers["x-guest-token"] = guestToken;
        await fetch(`/api/rooms/${tab.cloudRoomId}/files/${tab.cloudFileId}/snapshots`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ content: tab.content }),
        });
        setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isDirty: false } : t)));
      } catch (err) {
        console.error("Снапшот облачного файла не создан", err);
      }
      return;
    }
    try {
      await desktop().fs.writeFile(tab.filePath, tab.content);
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isDirty: false } : t)));
    } catch (err) {
      console.error("Сохранение не удалось", err);
    }
  }, [tabs]);

  const saveActiveTab = useCallback(async () => {
    if (!activeTabId) return;
    await saveTab(activeTabId);
  }, [activeTabId, saveTab]);

  // ---------- Файловые операции ----------
  const createFileAt = useCallback(async (parentDir: string, name: string) => {
    if (!name.trim()) return null;
    const sep = parentDir.includes("\\") ? "\\" : "/";
    const target = `${parentDir.replace(/[\\/]+$/, "")}${sep}${name.trim()}`;
    try {
      await desktop().fs.createFile(target, "");
      refreshTree();
      return target;
    } catch (err) {
      console.error("Не удалось создать файл", err);
      return null;
    }
  }, [refreshTree]);

  const createDirAt = useCallback(async (parentDir: string, name: string) => {
    if (!name.trim()) return null;
    const sep = parentDir.includes("\\") ? "\\" : "/";
    const target = `${parentDir.replace(/[\\/]+$/, "")}${sep}${name.trim()}`;
    try {
      await desktop().fs.createDir(target);
      refreshTree();
      return target;
    } catch (err) {
      console.error("Не удалось создать папку", err);
      return null;
    }
  }, [refreshTree]);

  const renamePath = useCallback(async (oldPath: string, newName: string) => {
    if (!newName.trim()) return null;
    const parts = oldPath.split(/[\\/]/);
    parts.pop();
    const sep = oldPath.includes("\\") ? "\\" : "/";
    const newPath = `${parts.join(sep)}${sep}${newName.trim()}`;
    try {
      await desktop().fs.rename(oldPath, newPath);
      // Обновляем открытые вкладки
      setTabs((prev) => prev.map((t) =>
        t.filePath === oldPath
          ? { ...t, filePath: newPath, fileName: newName.trim(), language: detectLanguage(newName.trim()) }
          : t,
      ));
      refreshTree();
      return newPath;
    } catch (err) {
      console.error("Переименование не удалось", err);
      return null;
    }
  }, [refreshTree]);

  const deletePath = useCallback(async (path: string) => {
    try {
      await desktop().fs.remove(path);
      setTabs((prev) => prev.filter((t) => t.filePath !== path && !t.filePath.startsWith(path + "/") && !t.filePath.startsWith(path + "\\")));
      refreshTree();
    } catch (err) {
      console.error("Удаление не удалось", err);
    }
  }, [refreshTree]);

  const movePath = useCallback(async (srcPath: string, destDir: string) => {
    try {
      const newPath = await desktop().fs.move(srcPath, destDir);
      setTabs((prev) => prev.map((t) => (t.filePath === srcPath ? { ...t, filePath: newPath } : t)));
      refreshTree();
      return newPath;
    } catch (err) {
      console.error("Перемещение не удалось", err);
      return null;
    }
  }, [refreshTree]);

  // ---------- Терминал ----------
  const newTerminal = useCallback(() => {
    const id = nanoid(8);
    const session: TermSession = {
      id,
      title: `Терминал ${termSessions.length + 1}`,
      cwd: currentProject?.type === "local" ? currentProject.path : undefined,
    };
    setTermSessions((prev) => [...prev, session]);
    setActiveTermId(id);
    if (!showBottomPanel) setShowBottomPanel(true);
    setBottomPanelView("terminal");
    return id;
  }, [termSessions.length, currentProject, showBottomPanel]);

  const closeTerminal = useCallback((id: string) => {
    setTermSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = prev.filter((s) => s.id !== id);
      if (id === activeTermId) {
        const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null;
        setActiveTermId(fallback?.id ?? null);
      }
      return next;
    });
  }, [activeTermId]);

  const setActiveTerm = useCallback((id: string) => setActiveTermId(id), []);

  const value = useMemo<Ctx>(() => ({
    currentProject,
    recentProjects,
    tabs,
    activeTabId,
    termSessions,
    activeTermId,
    showLeftSidebar,
    showRightPanel,
    showBottomPanel,
    rightPanelView,
    bottomPanelView,
    activitySection,
    treeRefreshKey,
    refreshTree,
    openProject,
    closeProject,
    refreshRecentProjects,
    addRecentProject,
    removeRecentProject,
    openFile,
    openCloudFile,
    openScratch,
    closeTab,
    setActiveTab,
    updateTabContent,
    saveActiveTab,
    saveTab,
    createFileAt,
    createDirAt,
    renamePath,
    deletePath,
    movePath,
    newTerminal,
    closeTerminal,
    setActiveTerm,
    toggleLeftSidebar: () => setShowLeftSidebar((v) => !v),
    toggleRightPanel: () => setShowRightPanel((v) => !v),
    toggleBottomPanel: () => setShowBottomPanel((v) => !v),
    setRightPanelView,
    setBottomPanelView,
    setActivitySection,
  }), [
    currentProject, recentProjects, tabs, activeTabId,
    termSessions, activeTermId,
    showLeftSidebar, showRightPanel, showBottomPanel,
    rightPanelView, bottomPanelView, activitySection, treeRefreshKey, refreshTree,
    openProject, closeProject, refreshRecentProjects,
    addRecentProject, removeRecentProject,
    openFile, openCloudFile, openScratch, closeTab, setActiveTab,
    updateTabContent, saveActiveTab, saveTab,
    createFileAt, createDirAt, renamePath, deletePath, movePath,
    newTerminal, closeTerminal, setActiveTerm,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace должен использоваться внутри WorkspaceProvider");
  return ctx;
}
