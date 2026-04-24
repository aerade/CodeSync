import { useCallback, useEffect, useState } from "react";
import { History, X, RotateCcw, User, Clock } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { desktop } from "@/lib/desktopBridge";
import { cn } from "@/lib/utils";

type Snapshot = {
  id: string;
  fileId: string;
  roomId: string;
  content: string;
  authorName: string;
  createdAt: string;
};

/**
 * Панель истории версий для активного облачного файла.
 * Загружает снапшоты с api-server и позволяет восстановить любую версию.
 */
export function HistoryPanel() {
  const { tabs, activeTabId, toggleRightPanel } = useWorkspace();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCloud = !!(activeTab?.cloudRoomId && activeTab?.cloudFileId);

  const fetchSnapshots = useCallback(async () => {
    if (!isCloud || !activeTab) return;
    setLoading(true);
    setError(null);
    try {
      const guestToken = await desktop().db.getSetting("guestToken").catch(() => null);
      const headers: Record<string, string> = {};
      if (guestToken) headers["x-guest-token"] = guestToken;
      const res = await fetch(`/api/rooms/${activeTab.cloudRoomId}/files/${activeTab.cloudFileId}/snapshots`, {
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Snapshot[];
      setSnapshots(data);
    } catch (err) {
      setError(`Не удалось загрузить историю: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab, isCloud]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const restore = async (snapshotId: string) => {
    if (!activeTab?.cloudRoomId || !activeTab?.cloudFileId) return;
    if (!window.confirm("Восстановить эту версию? Текущие изменения будут заменены.")) return;
    setBusyId(snapshotId);
    try {
      const guestToken = await desktop().db.getSetting("guestToken").catch(() => null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (guestToken) headers["x-guest-token"] = guestToken;
      const res = await fetch(
        `/api/rooms/${activeTab.cloudRoomId}/files/${activeTab.cloudFileId}/snapshots/${snapshotId}/restore`,
        { method: "POST", headers, credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchSnapshots();
    } catch (err) {
      setError(`Не удалось восстановить: ${String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <aside className="w-[340px] shrink-0 bg-[#0F0F11] border-l border-white/5 flex flex-col">
      <div className="flex items-center h-9 px-3 border-b border-white/5">
        <History className="w-3.5 h-3.5 text-[#A395FF]" />
        <span className="ml-2 text-[12px] font-medium tracking-wider uppercase text-zinc-300">История версий</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleRightPanel}
          className="w-6 h-6 grid place-items-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          aria-label="Закрыть"
          data-testid="history-panel-close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {!isCloud && (
          <div className="p-4 text-[13px] text-zinc-500 leading-relaxed">
            История версий доступна для файлов из <span className="text-zinc-300">облачной комнаты</span>.
            Откройте файл в комнате CodeSync, чтобы увидеть его снапшоты и восстановить предыдущие состояния.
          </div>
        )}
        {isCloud && loading && (
          <div className="p-4 text-[13px] text-zinc-500">Загрузка истории…</div>
        )}
        {isCloud && error && (
          <div className="p-4 text-[13px] text-[#E26F6F]">{error}</div>
        )}
        {isCloud && !loading && !error && snapshots.length === 0 && (
          <div className="p-4 text-[13px] text-zinc-500">
            Снапшотов ещё нет. Сохраните файл (⌘/Ctrl+S), чтобы создать первый.
          </div>
        )}
        {isCloud && snapshots.map((s) => (
          <div
            key={s.id}
            className="border-b border-white/5 px-3 py-2.5 hover:bg-white/[0.02]"
            data-testid={`history-item-${s.id}`}
          >
            <div className="flex items-center gap-2 text-[12px] text-zinc-400 mb-1">
              <User className="w-3 h-3" />
              <span className="text-zinc-300">{s.authorName}</span>
              <Clock className="w-3 h-3 ml-auto" />
              <span>{new Date(s.createdAt).toLocaleString("ru")}</span>
            </div>
            <pre className="text-[11.5px] font-mono text-zinc-500 line-clamp-3 whitespace-pre-wrap break-all leading-snug max-h-12 overflow-hidden">
              {s.content.slice(0, 200) || "(пустой)"}
            </pre>
            <button
              type="button"
              onClick={() => restore(s.id)}
              disabled={busyId === s.id}
              className={cn(
                "mt-2 h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5",
                "bg-[#18181B] border border-white/10 hover:bg-[#1F1F23] text-zinc-300",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              data-testid={`history-restore-${s.id}`}
            >
              <RotateCcw className="w-3 h-3" />
              {busyId === s.id ? "Восстановление…" : "Восстановить"}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
