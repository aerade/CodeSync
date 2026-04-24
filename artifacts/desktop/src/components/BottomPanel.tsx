import { useWorkspace } from "@/store/workspace";
import { TerminalView } from "@/components/TerminalView";
import { X, TerminalSquare, AlertCircle, FileOutput } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomPanel() {
  const { bottomPanelView, setBottomPanelView, toggleBottomPanel } = useWorkspace();

  return (
    <div className="h-[260px] shrink-0 bg-[#0F0F11] border-t border-white/5 flex flex-col">
      <div className="flex items-center h-9 border-b border-white/5 px-2 gap-1">
        <PanelTab id="terminal" label="Терминал" icon={TerminalSquare} active={bottomPanelView === "terminal"} onClick={() => setBottomPanelView("terminal")} />
        <PanelTab id="problems" label="Проблемы" icon={AlertCircle} active={bottomPanelView === "problems"} onClick={() => setBottomPanelView("problems")} />
        <PanelTab id="output" label="Вывод" icon={FileOutput} active={bottomPanelView === "output"} onClick={() => setBottomPanelView("output")} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleBottomPanel}
          className="w-6 h-6 grid place-items-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          aria-label="Закрыть панель"
          data-testid="bottom-panel-close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {bottomPanelView === "terminal" && <TerminalView />}
        {bottomPanelView === "problems" && (
          <div className="p-4 text-[13px] text-zinc-500">
            Проблем не обнаружено.
          </div>
        )}
        {bottomPanelView === "output" && (
          <div className="p-4 text-[13px] text-zinc-500 font-mono whitespace-pre-wrap">
            [система] CodeSync Desktop запущен.
          </div>
        )}
      </div>
    </div>
  );
}

function PanelTab({
  id, label, icon: Icon, active, onClick,
}: {
  id: string;
  label: string;
  icon: typeof TerminalSquare;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 flex items-center gap-1.5 text-[12px] rounded-md transition-colors",
        active ? "bg-white/5 text-zinc-200" : "text-zinc-500 hover:text-zinc-200",
      )}
      data-testid={`bottom-tab-${id}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
