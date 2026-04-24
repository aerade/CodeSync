/**
 * Панель настроек — открывается в правой колонке (rightPanelView === "settings").
 * Позволяет задать адрес api-server, имя гостя и просмотреть последние ошибки.
 */
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, X, Save, Eraser, RefreshCw } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { desktop, isElectron } from "@/lib/desktopBridge";
import { getApiBase, setApiBase, invalidateApiConfig, apiFetch } from "@/lib/apiConfig";
import { log } from "@/lib/logger";

export function SettingsPanel() {
  const { toggleRightPanel } = useWorkspace();
  const [apiBase, setApiBaseLocal] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [tail, setTail] = useState(log.tail(40));
  const native = isElectron();

  useEffect(() => {
    (async () => {
      const base = await getApiBase();
      setApiBaseLocal(base);
      const u = await desktop().db.getSetting("guestUsername").catch(() => null);
      if (u) setUsername(u);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setApiBase(apiBase);
      if (username.trim()) await desktop().db.setSetting("guestUsername", username.trim());
      invalidateApiConfig();
      log.info("settings", "Конфигурация сохранена", { apiBase, username });
    } catch (err) {
      log.error("settings", "Не удалось сохранить настройки", err);
    } finally {
      setSaving(false);
    }
  };

  const ping = async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const res = await apiFetch("/api/healthz", { method: "GET" });
      setPingResult(`OK ${res.status}`);
    } catch (err) {
      setPingResult(`Ошибка: ${String(err)}`);
      log.warn("settings", "Ping API не прошёл", err);
    } finally {
      setPinging(false);
    }
  };

  const refreshTail = () => setTail(log.tail(40));

  return (
    <aside className="w-[340px] shrink-0 bg-[#0F0F11] border-l border-white/5 flex flex-col">
      <div className="flex items-center h-9 px-3 border-b border-white/5">
        <SettingsIcon className="w-3.5 h-3.5 text-[#A395FF]" />
        <span className="ml-2 text-[12px] font-medium tracking-wider uppercase text-zinc-300">Настройки</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleRightPanel}
          className="w-6 h-6 grid place-items-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          aria-label="Закрыть"
          data-testid="settings-panel-close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4 text-[13px]">
        <section className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider text-zinc-500">Адрес api-server</label>
          <input
            value={apiBase}
            onChange={(e) => setApiBaseLocal(e.target.value)}
            placeholder="https://your-api.example.com"
            className="w-full h-8 px-2.5 rounded-md bg-[#131316] border border-white/8 text-[13px] focus-ring placeholder:text-zinc-500 font-mono"
            data-testid="settings-api-base"
          />
          <p className="text-[11.5px] text-zinc-500 leading-relaxed">
            Используется для REST/SSE и Yjs WebSocket. Пусто — текущий origin.
          </p>
          <button
            type="button"
            onClick={ping}
            disabled={pinging}
            className="h-7 px-2.5 rounded-md bg-[#18181B] border border-white/10 hover:bg-[#1F1F23] text-zinc-300 text-[12px] flex items-center gap-1.5 disabled:opacity-50"
            data-testid="settings-ping"
          >
            <RefreshCw className={pinging ? "w-3 h-3 animate-spin" : "w-3 h-3"} />
            Проверить соединение
          </button>
          {pingResult && (
            <div className="text-[11.5px] text-zinc-400 font-mono">{pingResult}</div>
          )}
        </section>

        <section className="space-y-1.5">
          <label className="block text-[11px] uppercase tracking-wider text-zinc-500">Имя гостя</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Гость"
            className="w-full h-8 px-2.5 rounded-md bg-[#131316] border border-white/8 text-[13px] focus-ring placeholder:text-zinc-500"
            data-testid="settings-username"
          />
        </section>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full h-8 rounded-md bg-[#A395FF] hover:bg-[#B5A8FF] text-[#0E0B22] font-medium text-[13px] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          data-testid="settings-save"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>

        <section>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500">Журнал ошибок</span>
            <button
              type="button"
              onClick={refreshTail}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              data-testid="settings-refresh-log"
            >
              <RefreshCw className="w-3 h-3" /> Обновить
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-auto rounded-md border border-white/8 bg-[#131316] p-2">
            {tail.length === 0 && (
              <div className="text-[11.5px] text-zinc-600">Пока нет записей.</div>
            )}
            {tail.slice().reverse().map((e) => (
              <div
                key={e.ts + e.context + e.message}
                className="text-[11px] font-mono leading-snug"
                data-testid="settings-log-entry"
              >
                <span className={
                  e.level === "error" ? "text-[#E26F6F]"
                    : e.level === "warn" ? "text-[#E2B96F]"
                      : "text-zinc-500"
                }>
                  [{e.level}]
                </span>{" "}
                <span className="text-zinc-400">[{e.context}]</span>{" "}
                <span className="text-zinc-300">{e.message}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="text-[11.5px] text-zinc-500 leading-relaxed flex items-start gap-1.5">
          <Eraser className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-600" />
          {native
            ? "Настройки сохраняются в локальной SQLite и работают офлайн."
            : "В веб-режиме настройки сохраняются в localStorage браузера."}
        </p>
      </div>
    </aside>
  );
}
