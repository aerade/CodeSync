import { useEffect } from "react";
import { useWorkspace } from "@/store/workspace";
import { TerminalView } from "@/components/TerminalView";
import { X, TerminalSquare, AlertCircle, FileOutput, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomPanel() {
  const {
    bottomPanelView, setBottomPanelView, toggleBottomPanel,
    termSessions, activeTermId, newTerminal, closeTerminal, setActiveTerm,
  } = useWorkspace();

  // Гарантируем хотя бы одну терминальную сессию при первом открытии вкладки терминала.
  useEffect(() => {
    if (bottomPanelView === "terminal" && termSessions.length === 0) {
      newTerminal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomPanelView]);

  const activeTerm = termSessions.find((s) => s.id === activeTermId) ?? termSessions[0] ?? null;

  return (
    <div className="h-[260px] shrink-0 bg-[#0F0F11] border-t border-white/5 flex flex-col">
      <div className="flex items-center h-9 border-b border-white/5 px-2 gap-1">
        <PanelTab id="terminal" label="Терминал" icon={TerminalSquare} active={bottomPanelView === "terminal"} onClick={() => setBottomPanelView("terminal")} />
        <PanelTab id="problems" label="Проблемы" icon={AlertCircle} active={bottomPanelView === "problems"} onClick={() => setBottomPanelView("problems")} />
        <PanelTab id="output" label="Вывод" icon={FileOutput} active={bottomPanelView === "output"} onClick={() => setBottomPanelView("output")} />
        <div className="flex-1" />
        {bottomPanelView === "terminal" && (
          <button
            type="button"
            onClick={() => newTerminal()}
            className="w-6 h-6 grid place-items-center rounded text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            aria-label="Новый терминал"
            title="Новый терминал"
            data-testid="terminal-new"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
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

      {bottomPanelView === "terminal" && termSessions.length > 1 && (
        <div className="flex items-center gap-1 px-2 h-7 border-b border-white/5 overflow-x-auto">
          {termSessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-1 h-6 pl-2 pr-1 rounded text-[11.5px] cursor-pointer",
                s.id === activeTerm?.id ? "bg-white/8 text-zinc-100" : "text-zinc-400 hover:bg-white/5",
              )}
              onClick={() => setActiveTerm(s.id)}
              data-testid={`terminal-tab-${s.id}`}
            >
              <TerminalSquare className="w-3 h-3" />
              <span>{s.title}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); closeTerminal(s.id); }}
                className="ml-1 w-4 h-4 grid place-items-center rounded text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                aria-label="Закрыть терминал"
                data-testid={`terminal-close-${s.id}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        {bottomPanelView === "terminal" && termSessions.map((s) => (
          <div
            key={s.id}
            className="absolute inset-0"
            style={{ visibility: s.id === activeTerm?.id ? "visible" : "hidden" }}
          >
            <TerminalView sessionLocalId={s.id} cwd={s.cwd} />
          </div>
        ))}
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
