import { useWorkspace } from "@/store/workspace";
import { Wifi, WifiOff, GitBranch, Bell } from "lucide-react";
import { isElectron, desktop } from "@/lib/desktopBridge";

export function StatusBar() {
  const { tabs, activeTabId, currentProject } = useWorkspace();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const native = isElectron();

  const lineCount = activeTab ? activeTab.content.split(/\r?\n/).length : 0;

  return (
    <div className="h-6 bg-[#0F0F11] border-t border-white/5 flex items-center justify-between px-2.5 text-[11.5px] text-zinc-500 select-none">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {native ? (
            <Wifi className="w-3 h-3 text-[#56C271]" />
          ) : (
            <WifiOff className="w-3 h-3 text-zinc-500" />
          )}
          <span>{native ? `${desktop().platform} • v${desktop().appVersion}` : "веб-режим"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3 h-3" />
          <span>main</span>
        </div>
        {currentProject && (
          <span className="truncate max-w-[280px]">{currentProject.name}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {activeTab && (
          <>
            <span className="font-mono">{activeTab.language}</span>
            <span className="font-mono">UTF-8</span>
            <span className="font-mono">LF</span>
            <span className="font-mono">{lineCount} стр.</span>
          </>
        )}
        <button
          type="button"
          className="flex items-center gap-1 hover:text-zinc-200"
          title="Уведомления"
          data-testid="statusbar-notifications"
        >
          <Bell className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
