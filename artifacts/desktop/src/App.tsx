import { useEffect, useState } from "react";
import { WorkspaceProvider, useWorkspace } from "@/store/workspace";
import { TitleBar } from "@/components/TitleBar";
import { ActivityBar } from "@/components/ActivityBar";
import { SideBar } from "@/components/SideBar";
import { TabsBar } from "@/components/TabsBar";
import { EditorPane } from "@/components/EditorPane";
import { BottomPanel } from "@/components/BottomPanel";
import { AIPanel } from "@/components/AIPanel";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { useHotkeys } from "@/hooks/useHotkeys";
import { desktop } from "@/lib/desktopBridge";

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
  ]);

  // Реакция на действия из нативного меню
  useEffect(() => {
    const off = desktop().onMenuAction((action) => {
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
          break;
      }
    });
    return () => off();
  }, [ws]);

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

        {ws.showRightPanel && <AIPanel />}
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
