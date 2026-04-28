import { useCallback, useEffect, useState } from "react";
import { History, X, RotateCcw, User, Clock, HardDrive, Cloud } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { desktop, type LocalFileVersion } from "@/lib/desktopBridge";
import { apiFetch } from "@/lib/apiConfig";
import { log } from "@/lib/logger";
import { cn } from "@/lib/utils";

type CloudSnapshot = {
  id: string;
  fileId: string;
  roomId: string;
  content: string;
  authorName: string;
  createdAt: string;
};

type LocalEntry = {
  kind: "local";
  id: string;            // строкой для общего key
  numericId: number;
  filePath: string;
  content: string;
  size: number;
  createdAt: number;
};

type CloudEntry = {
  kind: "cloud";
  id: string;
  content: string;
  authorName: string;
  createdAt: number;
};

type Entry = LocalEntry | CloudEntry;

/**
 * Унифицированная панель истории версий.
 *  - Облачные файлы (cloud://room/...) — REST `/snapshots` от api-server.
 *  - Локальные файлы — таблица `file_versions` в локальной SQLite (ipc:db),
 *    наполняемая автоматически при каждом сохранении (см. workspace.saveTab).
 */
export function HistoryPanel() {
  const { tabs, activeTabId, toggleRightPanel, updateTabContent, saveTab } = useWorkspace();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCloud = !!(activeTab?.cloudRoomId && activeTab?.cloudFileId);
  const isLocal = !!(activeTab && !activeTab.scratch && !isCloud);

  const fetchEntries = useCallback(async () => {
    if (!activeTab) { setEntries([]); return; }
    setLoading(true);
    setError(null);
    try {
      if (isCloud) {
        const res = await apiFetch(`/api/rooms/${activeTab.cloudRoomId}/files/${activeTab.cloudFileId}/snapshots`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as CloudSnapshot[];
        setEntries(data.map<Entry>((s) => ({
          kind: "cloud",
          id: s.id,
          content: s.content,
          authorName: s.authorName,
          createdAt: new Date(s.createdAt).getTime(),
        })));
      } else if (isLocal) {
        const list = await desktop().db.listFileVersions(activeTab.filePath);
        setEntries(list.map<Entry>((v: LocalFileVersion) => ({
          kind: "local",
          id: `local_${v.id}`,
          numericId: v.id,
          filePath: v.filePath,
          content: v.content,
          size: v.size,
          createdAt: v.createdAt,
        })));
      } else {
        setEntries([]);
      }
    } catch (err) {
      log.error("history", "fetch", err);
      setError(`Не удалось загрузить историю: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab, isCloud, isLocal]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const restore = async (entry: Entry) => {
    if (!activeTab) return;
    if (!window.confirm("Восстановить эту версию? Текущие изменения будут заменены.")) return;
    setBusyId(entry.id);
    const startedAt = Date.now();
    try {
      if (entry.kind === "cloud" && activeTab.cloudRoomId && activeTab.cloudFileId) {
        const res = await apiFetch(
          `/api/rooms/${activeTab.cloudRoomId}/files/${activeTab.cloudFileId}/snapshots/${entry.id}/restore`,
          { method: "POST", headers: { "Content-Type": "application/json" } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else if (entry.kind === "local") {
        // Локальный restore: подменяем содержимое вкладки и сохраняем.
        updateTabContent(activeTab.id, entry.content);
        await saveTab(activeTab.id);
      }
      await fetchEntries();
      // Уведомление о завершении долгой операции (требование skill desktop):
      // показываем только если процесс занял заметное время или окно вне фокуса.
      const elapsed = Date.now() - startedAt;
      const docHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
      if (elapsed > 1500 || docHidden) {
        try {
          desktop().notify("Версия восстановлена", `${activeTab.fileName} (${new Date(entry.createdAt).toLocaleString("ru-RU")})`);
        } catch (notifyErr) {
          log.debug("history", "notify", notifyErr);
        }
      }
    } catch (err) {
      log.error("history", "restore", err);
      setError(`Не удалось восстановить: ${String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <aside className="w-[340px] shrink-0 bg-[#0F0F11] border-l border-white/5 flex flex-col">
      <div className="flex items-center h-9 px-3 border-b border-white/5">
        <History className="w-3.5 h-3.5 text-[#F97316]" />
        <span className="ml-2 text-[12px] font-medium tracking-wider uppercase text-zinc-300">История версий</span>
        {isCloud && <Cloud className="ml-2 w-3 h-3 text-zinc-500" aria-label="Облачный файл" />}
        {isLocal && <HardDrive className="ml-2 w-3 h-3 text-zinc-500" aria-label="Локальный файл" />}
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
        {!isCloud && !isLocal && (
          <div className="p-4 text-[13px] text-zinc-500 leading-relaxed">
            Откройте файл (локальный или из облачной комнаты), чтобы увидеть историю версий.
          </div>
        )}
        {loading && (
          <div className="p-4 text-[13px] text-zinc-500">Загрузка истории…</div>
        )}
        {error && (
          <div className="p-4 text-[13px] text-[#E26F6F]">{error}</div>
        )}
        {!loading && !error && (isCloud || isLocal) && entries.length === 0 && (
          <div className="p-4 text-[13px] text-zinc-500">
            Версий ещё нет. Сохраните файл (⌘/Ctrl+S), чтобы создать первую.
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="border-b border-white/5 px-3 py-2.5 hover:bg-white/[0.02]"
            data-testid={`history-item-${e.id}`}
          >
            <div className="flex items-center gap-2 text-[12px] text-zinc-400 mb-1">
              {e.kind === "cloud" ? (
                <>
                  <User className="w-3 h-3" />
                  <span className="text-zinc-300">{e.authorName}</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3 h-3" />
                  <span className="text-zinc-300">локально · {e.size} б</span>
                </>
              )}
              <Clock className="w-3 h-3 ml-auto" />
              <span>{new Date(e.createdAt).toLocaleString("ru")}</span>
            </div>
            <pre className="text-[11.5px] font-mono text-zinc-500 line-clamp-3 whitespace-pre-wrap break-all leading-snug max-h-12 overflow-hidden">
              {e.content.slice(0, 200) || "(пустой)"}
            </pre>
            <button
              type="button"
              onClick={() => restore(e)}
              disabled={busyId === e.id}
              className={cn(
                "mt-2 h-7 px-2.5 rounded-md text-[12px] flex items-center gap-1.5",
                "bg-[#18181B] border border-white/10 hover:bg-[#1F1F23] text-zinc-300",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              data-testid={`history-restore-${e.id}`}
            >
              <RotateCcw className="w-3 h-3" />
              {busyId === e.id ? "Восстановление…" : "Восстановить"}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
