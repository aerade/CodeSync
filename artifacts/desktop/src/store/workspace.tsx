import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { desktop, type Project } from "@/lib/desktopBridge";
import { detectLanguage } from "@/lib/utils";
import { nanoid } from "nanoid";

export type OpenTab = {
  id: string;
  filePath: string;     // абсолютный путь
  fileName: string;
  language: string;
  content: string;
  isDirty: boolean;
  scratch?: boolean;    // не привязан к диску
};

type WorkspaceState = {
  currentProject: Project | null;
  recentProjects: Project[];
  tabs: OpenTab[];
  activeTabId: string | null;

  // Видимость панелей
  showLeftSidebar: boolean;
  showRightPanel: boolean;
  showBottomPanel: boolean;
  rightPanelView: "ai" | "review" | "events";
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
  openScratch: (lang?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  saveActiveTab: () => Promise<void>;
  saveTab: (id: string) => Promise<void>;

  toggleLeftSidebar: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setRightPanelView: (v: WorkspaceState["rightPanelView"]) => void;
  setBottomPanelView: (v: WorkspaceState["bottomPanelView"]) => void;
  setActivitySection: (s: WorkspaceState["activitySection"]) => void;
};

type Ctx = WorkspaceState & WorkspaceActions;

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<WorkspaceState["rightPanelView"]>("ai");
  const [bottomPanelView, setBottomPanelView] = useState<WorkspaceState["bottomPanelView"]>("terminal");
  const [activitySection, setActivitySection] = useState<WorkspaceState["activitySection"]>("files");

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

  const value = useMemo<Ctx>(() => ({
    currentProject,
    recentProjects,
    tabs,
    activeTabId,
    showLeftSidebar,
    showRightPanel,
    showBottomPanel,
    rightPanelView,
    bottomPanelView,
    activitySection,
    openProject,
    closeProject,
    refreshRecentProjects,
    addRecentProject,
    removeRecentProject,
    openFile,
    openScratch,
    closeTab,
    setActiveTab,
    updateTabContent,
    saveActiveTab,
    saveTab,
    toggleLeftSidebar: () => setShowLeftSidebar((v) => !v),
    toggleRightPanel: () => setShowRightPanel((v) => !v),
    toggleBottomPanel: () => setShowBottomPanel((v) => !v),
    setRightPanelView,
    setBottomPanelView,
    setActivitySection,
  }), [
    currentProject, recentProjects, tabs, activeTabId,
    showLeftSidebar, showRightPanel, showBottomPanel,
    rightPanelView, bottomPanelView, activitySection,
    openProject, closeProject, refreshRecentProjects,
    addRecentProject, removeRecentProject,
    openFile, openScratch, closeTab, setActiveTab,
    updateTabContent, saveActiveTab, saveTab,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace должен использоваться внутри WorkspaceProvider");
  return ctx;
}
