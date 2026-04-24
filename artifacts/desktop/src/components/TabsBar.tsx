import { X, Circle } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";

export function TabsBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useWorkspace();

  if (tabs.length === 0) return null;

  return (
    <div className="h-9 bg-[#0F0F11] border-b border-white/5 flex items-stretch overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={cn(
              "group flex items-center gap-2 pl-3 pr-2 min-w-0 max-w-[220px] border-r border-white/5 cursor-pointer relative",
              isActive ? "bg-[#18181B] text-zinc-200" : "text-zinc-400 hover:bg-white/[0.02]",
            )}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            {isActive && <span className="absolute left-0 right-0 top-0 h-[1.5px] bg-[#A395FF]" />}
            <span className="text-[12.5px] truncate">{tab.fileName}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              className="ml-auto w-4 h-4 grid place-items-center rounded-sm text-zinc-500 hover:text-zinc-200 hover:bg-white/8 opacity-0 group-hover:opacity-100"
              aria-label="Закрыть вкладку"
              data-testid={`tab-close-${tab.id}`}
            >
              {tab.isDirty ? (
                <Circle className="w-2 h-2 fill-current text-[#A395FF]" />
              ) : (
                <X className="w-3 h-3" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
