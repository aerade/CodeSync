import { useEffect, useState } from "react";
import { WorkspaceProvider, useWorkspace } from "@/store/workspace";
import { AuthProvider, useAuth } from "@/store/auth";
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
import { SignInScreen } from "@/components/SignInScreen";
import { UpdateNotification } from "@/components/UpdateNotification";
import { useHotkeys } from "@/hooks/useHotkeys";
import { desktop } from "@/lib/desktopBridge";

function Shell() {
  const ws = useWorkspace();
  const { user, loading } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openSettings = () => {
    ws.setRightPanelView("settings");
    if (!ws.showRightPanel) ws.toggleRightPanel();
  };

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
    { combo: "mod+,", handler: openSettings },
  ]);

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
        case "new-file": ws.openScratch("typescript"); break;
        case "save": ws.saveActiveTab(); break;
        case "command-palette": setPaletteOpen(true); break;
        case "toggle-sidebar": ws.toggleLeftSidebar(); break;
        case "toggle-terminal": ws.toggleBottomPanel(); break;
        case "toggle-ai":
          ws.setRightPanelView("ai");
          if (!ws.showRightPanel) ws.toggleRightPanel();
          break;
        case "toggle-history":
          ws.setRightPanelView("history");
          if (!ws.showRightPanel) ws.toggleRightPanel();
          break;
        case "toggle-chat":
          ws.setRightPanelView("chat");
          if (!ws.showRightPanel) ws.toggleRightPanel();
          break;
        case "toggle-settings":
          ws.setRightPanelView("settings");
          if (!ws.showRightPanel) ws.toggleRightPanel();
          break;
        case "help-docs":
          window.open("https://github.com/replit/codesync-desktop#readme", "_blank", "noopener");
          break;
        case "help-about":
          window.alert("CodeSync Desktop\nВерсия 0.1.0 — нативный код-редактор\nLocal-first SQLite + Yjs CRDT.");
          break;
      }
    };
    const off1 = desktop().onMenuAction(handle);
    const off2 = desktop().onGlobalShortcut(handle);
    return () => { off1(); off2(); };
  }, [ws]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#F97316] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

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
      <UpdateNotification />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Shell />
      </WorkspaceProvider>
    </AuthProvider>
  );
}
