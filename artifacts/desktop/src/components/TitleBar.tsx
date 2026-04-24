import { Minus, Square, X, Maximize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { desktop, isElectron } from "@/lib/desktopBridge";
import { cn, modKey } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";

type Props = {
  onOpenCommandPalette: () => void;
};

export function TitleBar({ onOpenCommandPalette }: Props) {
  const [isMax, setIsMax] = useState(false);
  const { currentProject } = useWorkspace();
  const native = isElectron();

  useEffect(() => {
    if (!native) return;
    desktop().window.isMaximized().then(setIsMax);
    const off = desktop().window.onMaximizeChange(setIsMax);
    return () => off();
  }, [native]);

  const showMacButtons = native && desktop().platform === "darwin";

  return (
    <div className="titlebar-drag flex items-center justify-between h-9 px-2 bg-[#0F0F11] border-b border-white/5 select-none">
      {/* left */}
      <div className="flex items-center gap-2 min-w-[120px]">
        {showMacButtons ? (
          <div className="titlebar-no-drag flex items-center gap-1.5 px-1.5">
            <button
              type="button"
              onClick={() => desktop().window.close()}
              className="w-3 h-3 rounded-full bg-[#FF5F57] hover:opacity-80 transition-opacity"
              aria-label="Закрыть"
              data-testid="title-close-mac"
            />
            <button
              type="button"
              onClick={() => desktop().window.minimize()}
              className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:opacity-80 transition-opacity"
              aria-label="Свернуть"
              data-testid="title-minimize-mac"
            />
            <button
              type="button"
              onClick={() => desktop().window.maximizeToggle()}
              className="w-3 h-3 rounded-full bg-[#28C840] hover:opacity-80 transition-opacity"
              aria-label="Развернуть"
              data-testid="title-maximize-mac"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-1.5">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#A395FF] to-[#6B5BD6] grid place-items-center text-[10px] font-bold text-[#0E0B22]">
              C
            </div>
            <span className="text-[13px] font-medium text-zinc-300 tracking-tight">CodeSync</span>
          </div>
        )}
      </div>

      {/* center: project + command palette trigger */}
      <div className="titlebar-no-drag flex-1 flex items-center justify-center gap-2 px-2">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className={cn(
            "group flex items-center gap-2 h-6 px-2.5 rounded-md",
            "bg-[#18181B] border border-white/8 hover:border-white/15 hover:bg-[#1F1F23]",
            "text-[12px] text-zinc-400 transition-colors min-w-[260px] max-w-[420px]",
          )}
          data-testid="title-search"
        >
          <span className="truncate flex-1 text-left">
            {currentProject ? currentProject.name : "Введите команду или путь…"}
          </span>
          <span className="kbd">{modKey()}</span>
          <span className="kbd">K</span>
        </button>
      </div>

      {/* right */}
      <div className="flex items-center gap-1 min-w-[120px] justify-end">
        {native && !showMacButtons && (
          <div className="titlebar-no-drag flex items-center">
            <button
              type="button"
              onClick={() => desktop().window.minimize()}
              className="h-9 w-11 grid place-items-center hover:bg-white/5 text-zinc-400"
              aria-label="Свернуть"
              data-testid="title-minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => desktop().window.maximizeToggle()}
              className="h-9 w-11 grid place-items-center hover:bg-white/5 text-zinc-400"
              aria-label="Развернуть"
              data-testid="title-maximize"
            >
              {isMax ? <Square className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={() => desktop().window.close()}
              className="h-9 w-11 grid place-items-center hover:bg-[#E26F6F] text-zinc-400"
              aria-label="Закрыть"
              data-testid="title-close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!native && (
          <span className="text-[10.5px] text-zinc-500 px-2 uppercase tracking-wider">веб-превью</span>
        )}
      </div>
    </div>
  );
}
