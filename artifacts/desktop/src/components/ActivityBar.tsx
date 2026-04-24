import { FileText, Search, Users, GitBranch, Settings, Sparkles, TerminalSquare } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { cn } from "@/lib/utils";

type Section = "files" | "search" | "rooms" | "git" | "extensions";

const ITEMS: Array<{ id: Section; label: string; icon: typeof FileText }> = [
  { id: "files", label: "Файлы", icon: FileText },
  { id: "search", label: "Поиск", icon: Search },
  { id: "rooms", label: "Комнаты", icon: Users },
  { id: "git", label: "Контроль версий", icon: GitBranch },
  { id: "extensions", label: "Расширения", icon: Settings },
];

export function ActivityBar() {
  const {
    activitySection, setActivitySection,
    showLeftSidebar, toggleLeftSidebar,
    showRightPanel, toggleRightPanel,
    showBottomPanel, toggleBottomPanel,
  } = useWorkspace();

  return (
    <div className="w-12 shrink-0 bg-[#0F0F11] border-r border-white/5 flex flex-col items-center py-2 gap-1">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activitySection === item.id && showLeftSidebar;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (activitySection === item.id) toggleLeftSidebar();
              else {
                setActivitySection(item.id);
                if (!showLeftSidebar) toggleLeftSidebar();
              }
            }}
            className={cn(
              "relative w-10 h-10 grid place-items-center rounded-md transition-colors group",
              active ? "text-[#A395FF]" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5",
            )}
            title={item.label}
            data-testid={`activity-${item.id}`}
          >
            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-[#A395FF]" />}
            <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
          </button>
        );
      })}

      <div className="flex-1" />

      <button
        type="button"
        onClick={toggleBottomPanel}
        className={cn(
          "w-10 h-10 grid place-items-center rounded-md transition-colors",
          showBottomPanel ? "text-[#A395FF]" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5",
        )}
        title="Терминал"
        data-testid="activity-terminal"
      >
        <TerminalSquare className="w-[18px] h-[18px]" strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={toggleRightPanel}
        className={cn(
          "w-10 h-10 grid place-items-center rounded-md transition-colors",
          showRightPanel ? "text-[#A395FF]" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5",
        )}
        title="ИИ-помощник"
        data-testid="activity-ai"
      >
        <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.6} />
      </button>
    </div>
  );
}
