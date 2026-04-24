import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Bot, User, MessageSquare, FileSearch, History, Trash2, RefreshCw } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { apiFetch, getApiBase } from "@/lib/apiConfig";
import { desktop } from "@/lib/desktopBridge";
import type { AiHistoryMessage, AiHistoryRole } from "@/lib/desktopBridge";
import { log } from "@/lib/logger";
import { cn } from "@/lib/utils";

type ChatMsg = { id: string; role: AiHistoryRole; content: string; streaming?: boolean };
type Mode = "chat" | "review" | "history";

const REVIEW_SYSTEM_PROMPT =
  "Ты — старший ревьюер кода. Сделай краткое ревью переданного файла: " +
  "перечисли потенциальные баги, проблемы безопасности, узкие места производительности, " +
  "и предложи 2-3 конкретных улучшения. Отвечай на русском, маркированными списками.";

export function AIPanel() {
  const { tabs, activeTabId, toggleRightPanel, currentProject, rightPanelView, showRightPanel } = useWorkspace();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [mode, setMode] = useState<Mode>("chat");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AiHistoryMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Снимок видимости панели для notifyDone (Context-стор не даёт getState).
  const visibilityRef = useRef({ showRightPanel, rightPanelView });
  useEffect(() => {
    visibilityRef.current = { showRightPanel, rightPanelView };
  }, [showRightPanel, rightPanelView]);

  const scope = currentProject?.id ?? "global";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const persist = useCallback(
    (role: AiHistoryRole, content: string) => {
      desktop().db.appendAiMessage(scope, role, content).catch((err) => {
        log.warn("ai", "Не удалось сохранить сообщение в локальной истории", err);
      });
    },
    [scope],
  );

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await desktop().db.listAiMessages(scope, 200);
      setHistory(list);
    } catch (err) {
      log.error("ai", "Не удалось загрузить историю ИИ", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (mode === "history") {
      refreshHistory();
    }
  }, [mode, refreshHistory]);

  const clearHistory = useCallback(async () => {
    if (!window.confirm("Очистить локальную историю ИИ для этого проекта?")) return;
    try {
      await desktop().db.clearAiHistory(scope);
      setHistory([]);
    } catch (err) {
      log.error("ai", "Не удалось очистить историю", err);
    }
  }, [scope]);

  // Универсальный stream-запрос. Возвращает финальный текст ответа.
  const streamRequest = async (
    payloadMessages: Array<{ role: AiHistoryRole; content: string }>,
    aiMsgId: string,
    contextOverride?: string,
  ): Promise<string> => {
    const res = await apiFetch(`/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: payloadMessages,
        roomId: currentProject?.cloudRoomId,
        context: contextOverride ?? activeTab?.content?.slice(0, 4000) ?? "",
      }),
    });
    if (res.status === 401) {
      throw new Error("Требуется вход в облачный аккаунт CodeSync для использования ИИ.");
    }
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const ev of events) {
        for (const line of ev.split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim());
            const chunk = json.text ?? json.delta ?? json.content ?? "";
            if (chunk) {
              acc += chunk;
              setMessages((prev) =>
                prev.map((m) => (m.id === aiMsgId ? { ...m, content: m.content + chunk } : m)),
              );
            }
          } catch (parseErr) {
            log.debug("ai", "Не удалось разобрать SSE-строку", parseErr);
          }
        }
      }
    }
    return acc;
  };

  // Отправляем нативное уведомление, если панель ИИ скрыта или окно не в фокусе —
  // это требование «уведомлений о завершении длительных операций».
  const notifyDone = (preview: string) => {
    const snap = visibilityRef.current;
    const panelHidden = !snap.showRightPanel || snap.rightPanelView !== "ai";
    const docHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
    if (!panelHidden && !docHidden) return;
    const body = preview.replace(/\s+/g, " ").trim().slice(0, 140) || "Запрос обработан.";
    try {
      desktop().notify("ИИ завершил ответ", body);
    } catch (err) {
      log.debug("ai", "notify failed", err);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    const aiMsg: ChatMsg = { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setSending(true);
    persist("user", text);

    try {
      const payload = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];
      const final = await streamRequest(payload, aiMsg.id);
      persist("assistant", final);
      notifyDone(final);
    } catch (err) {
      log.error("ai", "Запрос к /ai/chat провалился", err);
      const baseHint = await getApiBase().catch(() => "/api");
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsg.id ? {
          ...m,
          content: `Не удалось получить ответ: ${String(err)}. Проверьте, что API-сервер доступен по ${baseHint} (можно изменить в Настройках).`,
          streaming: false,
        } : m)),
      );
    } finally {
      setMessages((prev) => prev.map((m) => (m.id === aiMsg.id ? { ...m, streaming: false } : m)));
      setSending(false);
    }
  };

  const runReview = async () => {
    if (sending) return;
    if (!activeTab || !activeTab.content) {
      setMessages((prev) => prev.concat({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Откройте файл в редакторе, чтобы запросить ревью.",
      }));
      return;
    }
    const fileName = activeTab.fileName;
    const userPrompt = `Сделай ревью файла \`${fileName}\`. Содержимое прикреплено как контекст.`;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: userPrompt };
    const aiMsg: ChatMsg = { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setSending(true);
    persist("user", `[ревью] ${fileName}`);
    try {
      const payload = [
        { role: "system" as const, content: REVIEW_SYSTEM_PROMPT },
        { role: "user" as const, content: userPrompt },
      ];
      const final = await streamRequest(payload, aiMsg.id, activeTab.content.slice(0, 8000));
      persist("assistant", final);
      notifyDone(`Ревью ${fileName} готово`);
    } catch (err) {
      log.error("ai", "Ревью провалилось", err);
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsg.id ? {
          ...m,
          content: `Не удалось получить ревью: ${String(err)}.`,
          streaming: false,
        } : m)),
      );
    } finally {
      setMessages((prev) => prev.map((m) => (m.id === aiMsg.id ? { ...m, streaming: false } : m)));
      setSending(false);
    }
  };

  const TabBtn = ({ id, icon: Icon, label }: { id: Mode; icon: typeof MessageSquare; label: string }) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className={cn(
        "flex items-center gap-1.5 h-7 px-2.5 rounded text-[11.5px] font-medium tracking-wide uppercase",
        mode === id
          ? "bg-[#1F1F23] text-zinc-100 border border-white/10"
          : "text-zinc-500 hover:text-zinc-300 border border-transparent",
      )}
      data-testid={`ai-mode-${id}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <aside className="w-[380px] shrink-0 bg-[#0F0F11] border-l border-white/5 flex flex-col">
      <div className="flex items-center h-9 px-3 border-b border-white/5">
        <Sparkles className="w-3.5 h-3.5 text-[#A395FF]" />
        <span className="ml-2 text-[12px] font-medium tracking-wider uppercase text-zinc-300">ИИ-помощник</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleRightPanel}
          className="w-6 h-6 grid place-items-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          aria-label="Закрыть"
          data-testid="ai-panel-close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/5">
        <TabBtn id="chat" icon={MessageSquare} label="Чат" />
        <TabBtn id="review" icon={FileSearch} label="Ревью" />
        <TabBtn id="history" icon={History} label="История" />
      </div>

      {mode === "chat" && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-[13px] text-zinc-500 leading-relaxed space-y-2">
                <p>Задайте вопрос, попросите объяснить код или сгенерировать решение.</p>
                <p>
                  Контекст активного файла {activeTab ? <span className="text-zinc-300 font-mono">{activeTab.fileName}</span> : "(нет открытых файлов)"} автоматически прикрепляется к запросам.
                </p>
                <div className="grid grid-cols-1 gap-1.5 mt-3">
                  {[
                    "Объясни этот код",
                    "Найди потенциальные баги",
                    "Преобразуй в TypeScript",
                    "Добавь обработку ошибок",
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="text-left h-8 px-2.5 rounded-md bg-[#18181B] hover:bg-[#1F1F23] border border-white/8 text-zinc-300 text-[12.5px]"
                      data-testid={`ai-suggestion-${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className="flex gap-2.5">
                <div className={cn(
                  "w-6 h-6 rounded-md grid place-items-center shrink-0",
                  m.role === "user" ? "bg-[#1F1F23] text-zinc-300" : "bg-gradient-to-br from-[#A395FF] to-[#6B5BD6] text-[#0E0B22]",
                )}>
                  {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10.5px] text-zinc-500 uppercase tracking-wider mb-0.5">
                    {m.role === "user" ? "Вы" : "ИИ"}
                  </div>
                  <div className="text-[13px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                    {m.content || (m.streaming ? <span className="text-zinc-500">…</span> : "")}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 p-2.5">
            <div className="flex items-end gap-1.5 rounded-lg bg-[#131316] border border-white/8 focus-within:border-white/16 px-2 py-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Спросите ИИ…"
                rows={1}
                className="flex-1 bg-transparent outline-none text-[13px] text-zinc-200 placeholder:text-zinc-500 resize-none max-h-32 leading-snug"
                data-testid="ai-input"
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || !input.trim()}
                className="w-7 h-7 grid place-items-center rounded-md bg-[#A395FF] hover:bg-[#B5A8FF] text-[#0E0B22] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Отправить"
                data-testid="ai-send"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[10.5px] text-zinc-600 mt-1.5 px-1">
              Enter — отправить, Shift+Enter — перенос строки
            </div>
          </div>
        </>
      )}

      {mode === "review" && (
        <div className="flex-1 overflow-auto p-3 space-y-3">
          <div className="text-[13px] text-zinc-400 leading-relaxed space-y-2">
            <p>Запросите автоматическое ревью текущего файла. ИИ проверит баги, безопасность и производительность.</p>
            <p className="text-[12px] text-zinc-500">
              Файл: {activeTab ? <span className="text-zinc-300 font-mono">{activeTab.fileName}</span> : <span className="text-zinc-600">не выбран</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={runReview}
            disabled={sending || !activeTab?.content}
            className="w-full h-9 rounded-md bg-[#A395FF] hover:bg-[#B5A8FF] text-[#0E0B22] text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid="ai-review-run"
          >
            <FileSearch className="w-4 h-4" />
            {sending ? "Генерация ревью…" : "Сделать ревью кода"}
          </button>
          <div className="space-y-3 pt-2">
            {messages.filter((m) => m.role === "assistant" || m.content.startsWith("[ревью]")).slice(-6).map((m) => (
              <div key={m.id} className="rounded-md border border-white/8 bg-[#131316] p-2.5">
                <div className="text-[10.5px] text-zinc-500 uppercase tracking-wider mb-1">
                  {m.role === "user" ? "Запрос" : "Ревью"}
                </div>
                <div className="text-[13px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                  {m.content || (m.streaming ? <span className="text-zinc-500">…</span> : "")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "history" && (
        <>
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5">
            <span className="text-[11px] text-zinc-500 flex-1">Локальный лог по проекту «{currentProject?.name ?? "без проекта"}»</span>
            <button
              type="button"
              onClick={refreshHistory}
              className="h-6 px-1.5 rounded text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-white/5 flex items-center gap-1"
              data-testid="ai-history-refresh"
            >
              <RefreshCw className={cn("w-3 h-3", historyLoading && "animate-spin")} />
              Обновить
            </button>
            <button
              type="button"
              onClick={clearHistory}
              className="h-6 px-1.5 rounded text-[11px] text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 flex items-center gap-1"
              data-testid="ai-history-clear"
            >
              <Trash2 className="w-3 h-3" />
              Очистить
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {history.length === 0 && !historyLoading && (
              <div className="text-[13px] text-zinc-500">История пуста. Отправьте запрос на вкладке «Чат» — он автоматически сохранится здесь.</div>
            )}
            {history.map((m) => (
              <div key={m.id} className="rounded-md border border-white/5 bg-[#131316] p-2">
                <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-zinc-500 mb-1">
                  <span className={cn(m.role === "assistant" ? "text-[#A395FF]" : m.role === "user" ? "text-zinc-300" : "text-amber-300")}>
                    {m.role === "assistant" ? "ИИ" : m.role === "user" ? "Вы" : "Система"}
                  </span>
                  <span className="text-zinc-600">{new Date(m.createdAt).toLocaleString("ru-RU")}</span>
                </div>
                <div className="text-[12.5px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
