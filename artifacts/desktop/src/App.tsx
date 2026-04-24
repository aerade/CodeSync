import { useEffect, useState } from "react";
import { WorkspaceProvider, useWorkspace } from "@/store/workspace";
import { TitleBar } from "@/components/TitleBar";
import { ActivityBar } from "@/components/ActivityBar";
import { SideBar } from "@/components/SideBar";
import { TabsBar } from "@/components/TabsBar";
import { EditorPane } from "@/components/EditorPane";
import { BottomPanel } from "@/components/BottomPanel";
import { AIPanel } from "@/components/AIPanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { useHotkeys } from "@/hooks/useHotkeys";
import { desktop } from "@/lib/desktopBridge";
import { apiFetch, setGuestToken } from "@/lib/apiConfig";
import { log } from "@/lib/logger";

/**
 * Гарантирует наличие гостевой учётной записи: при первом запуске
 * запрашивает имя пользователя и обменивает его на постоянный
 * x-guest-token в локальной БД (через API /api/auth/guest).
 */
async function ensureGuestAuth(): Promise<void> {
  try {
    const existing = await desktop().db.getSetting("guestToken");
    if (existing) return;
    const usernameSaved = await desktop().db.getSetting("guestUsername");
    const username = usernameSaved ?? `Гость_${Math.random().toString(36).slice(2, 7)}`;
    await desktop().db.setSetting("guestUsername", username);

    const res = await apiFetch("/api/auth/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      log.warn("auth", `Гостевая сессия не создана (HTTP ${res.status})`);
      return;
    }
    const data = await res.json() as { token?: string };
    if (data.token) {
      await setGuestToken(data.token);
    }
  } catch (err) {
    log.warn("auth", "Гостевая авторизация недоступна (api-server offline?)", err);
  }
}

function Shell() {
  const ws = useWorkspace();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useHotkeys([
    { combo: "mod+k", handler: () => setPaletteOpen(true) },
    { combo: "mod+shift+p", handler: () => setPaletteOpen(true) },
    { combo: "escape", handler: () => setPaletteOpen(false), preventDefault: false },
    { combo: "mod+s", handler: () => ws.saveActiveTab() },
    { combo: "mod+b", handler: () => ws.toggleLeftSidebar() },
    { combo: "mod+i", handler: () => ws.toggleRightPanel() },
    { combo: "mod+`", handler: () => ws.toggleBottomPanel() },
    { combo: "mod+n", handler: () => ws.openScratch("typescript") },
    { combo: "mod+shift+t", handler: () => ws.newTerminal() },
  ]);

  // Реакция на действия из нативного меню и глобальных хоткеев
  useEffect(() => {
    const handle = (action: string) => {
      switch (action) {
        case "open-folder":
          desktop().fs.pickDirectory().then(async (p) => {
            if (!p) return;
            const project = {
              id: crypto.randomUUID(),
              name: p.split(/[\\/]/).pop() ?? p,
              path: p,
              type: "local" as const,
              lastOpenedAt: Date.now(),
            };
            await ws.addRecentProject(project);
            await ws.openProject(project);
          });
          break;
        case "new-file":
          ws.openScratch("typescript");
          break;
        case "save":
          ws.saveActiveTab();
          break;
        case "command-palette":
          setPaletteOpen(true);
          break;
        case "toggle-sidebar":
          ws.toggleLeftSidebar();
          break;
        case "toggle-terminal":
          ws.toggleBottomPanel();
          break;
        case "toggle-ai":
          ws.toggleRightPanel();
          ws.setRightPanelView("ai");
          break;
        case "toggle-history":
          ws.toggleRightPanel();
          ws.setRightPanelView("history");
          break;
        case "toggle-chat":
          ws.toggleRightPanel();
          ws.setRightPanelView("chat");
          break;
        case "toggle-settings":
          ws.toggleRightPanel();
          ws.setRightPanelView("settings");
          break;
      }
    };
    const off1 = desktop().onMenuAction(handle);
    const off2 = desktop().onGlobalShortcut(handle);
    return () => { off1(); off2(); };
  }, [ws]);

  // Гостевая авторизация при первом запуске
  useEffect(() => {
    ensureGuestAuth();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0F0F11] overflow-hidden">
      <TitleBar onOpenCommandPalette={() => setPaletteOpen(true)} />

      <div className="flex-1 min-h-0 flex">
        <ActivityBar />
        {ws.showLeftSidebar && <SideBar />}

        <main className="flex-1 min-w-0 flex flex-col">
          {ws.currentProject || ws.tabs.length > 0 ? (
            <>
              <TabsBar />
              <div className="flex-1 min-h-0 flex">
                <EditorPane />
              </div>
            </>
          ) : (
            <WelcomeScreen onOpenCommandPalette={() => setPaletteOpen(true)} />
          )}
          {ws.showBottomPanel && <BottomPanel />}
        </main>

        {ws.showRightPanel && ws.rightPanelView === "ai" && <AIPanel />}
        {ws.showRightPanel && ws.rightPanelView === "history" && <HistoryPanel />}
        {ws.showRightPanel && ws.rightPanelView === "chat" && <ChatPanel />}
        {ws.showRightPanel && ws.rightPanelView === "settings" && <SettingsPanel />}
      </div>

      <StatusBar />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
