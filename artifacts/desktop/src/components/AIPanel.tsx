import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, Bot, User } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { desktop } from "@/lib/desktopBridge";
import { cn } from "@/lib/utils";

type ChatMsg = { id: string; role: "user" | "assistant"; content: string; streaming?: boolean };

const API_BASE = "/api";

export function AIPanel() {
  const { tabs, activeTabId, toggleRightPanel, currentProject } = useWorkspace();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    const aiMsg: ChatMsg = { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setSending(true);

    try {
      // Контракт api-server: либо message (строка), либо messages (массив).
      // Передаём всю историю + новое сообщение пользователя.
      const messagesPayload = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      // Попытка прикрепить гостевой токен, если он сохранён локально.
      const guestToken = await desktop().db.getSetting("guestToken").catch(() => null);
      if (guestToken) headers["x-guest-token"] = guestToken;

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          messages: messagesPayload,
          roomId: currentProject?.cloudRoomId,
          context: activeTab?.content?.slice(0, 4000) ?? "",
        }),
      });
      if (res.status === 401) {
        throw new Error("Требуется вход в облачный аккаунт CodeSync для использования ИИ-чата.");
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const lines = ev.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              try {
                const json = JSON.parse(line.slice(5).trim());
                const chunk = json.text ?? json.delta ?? json.content ?? "";
                if (chunk) {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === aiMsg.id ? { ...m, content: m.content + chunk } : m)),
                  );
                }
              } catch {
                /* ignore */
              }
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsg.id ? {
          ...m,
          content: `Не удалось получить ответ: ${String(err)}. Убедитесь, что API-сервер доступен по ${API_BASE}.`,
          streaming: false,
        } : m)),
      );
    } finally {
      setMessages((prev) => prev.map((m) => (m.id === aiMsg.id ? { ...m, streaming: false } : m)));
      setSending(false);
    }
  };

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
          <div key={m.id} className={cn("flex gap-2.5", m.role === "user" ? "" : "")}>
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
    </aside>
  );
}
