/**
 * Чат комнаты — поднимает отдельный WebSocket к коллаборационному серверу
 * (`/ws/rooms/:roomId/files/:fileId?token=...&chat=1`) и обрабатывает протокол:
 *   { type: "chat", message, ... }
 *
 * Хранит локальный буфер сообщений и переотправляет их через ws.send.
 * Подключается либо к открытому файлу комнаты (тогда чат привязан к файлу),
 * либо к специальному room-presence каналу с fileId="__room__"
 * (этот идентификатор поддерживается api-server для room-level чата).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, MessageSquare, X, Users } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { desktop } from "@/lib/desktopBridge";
import { getWsBase, getCollabToken } from "@/lib/apiConfig";
import { log } from "@/lib/logger";

type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  ts: number;
};

type Participant = { id: string; name: string; color: string };

export function ChatPanel() {
  const { tabs, activeTabId, currentProject, toggleRightPanel, showRightPanel, rightPanelView } = useWorkspace();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const roomId = currentProject?.cloudRoomId ?? activeTab?.cloudRoomId;
  const fileId = activeTab?.cloudFileId ?? "__room__";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const usernameRef = useRef("Гость");
  // Снимок видимости панели — нужен внутри `connect`, чтобы решить,
  // показывать ли нативное уведомление о упоминании.
  const visibilityRef = useRef({ showRightPanel, rightPanelView });
  useEffect(() => {
    visibilityRef.current = { showRightPanel, rightPanelView };
  }, [showRightPanel, rightPanelView]);
  // Антиспам-таймер: не более одного уведомления раз в 4 секунды.
  const lastNotifyRef = useRef(0);

  useEffect(() => {
    desktop().db.getSetting("guestUsername").then((n) => { if (n) usernameRef.current = n; }).catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    if (!roomId) return;
    try {
      // api-server отклонит соединение без короткоживущего токена.
      const collab = await getCollabToken();
      if (!collab) {
        log.warn("chat", `Не удалось получить collab-токен для комнаты ${roomId}`);
        setConnected(false);
        return;
      }
      if (collab.username) usernameRef.current = collab.username;
      const wsBase = await getWsBase();
      const url = `${wsBase}/ws/rooms/${roomId}/files/${fileId}?token=${encodeURIComponent(collab.token)}&chat=1`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.addEventListener("open", () => {
        setConnected(true);
        log.info("chat", `WebSocket подключён к комнате ${roomId}`);
        // Подписываемся на список участников через стандартный awareness ping
        try {
          ws.send(JSON.stringify({ type: "join", name: usernameRef.current }));
        } catch (err) {
          log.warn("chat", "Не удалось отправить join", err);
        }
      });
      ws.addEventListener("close", () => {
        setConnected(false);
        log.warn("chat", `WebSocket чата закрыт (room=${roomId})`);
      });
      ws.addEventListener("error", (ev) => {
        log.error("chat", `WebSocket чата вернул ошибку (room=${roomId})`, ev);
      });
      ws.addEventListener("message", (ev) => {
        try {
          if (typeof ev.data !== "string") return;
          const msg = JSON.parse(ev.data) as Record<string, unknown>;
          const t = String(msg.type ?? "");
          if (t === "chat") {
            const incoming: ChatMessage = {
              id: String(msg.messageId ?? msg.id ?? `${Date.now()}_${Math.random()}`),
              authorId: String(msg.authorId ?? msg.userId ?? "?"),
              authorName: String(msg.authorName ?? msg.username ?? "Аноним"),
              text: String(msg.message ?? msg.text ?? ""),
              ts: typeof msg.ts === "number" ? msg.ts : Date.now(),
            };
            setMessages((prev) => prev.concat(incoming));

            // Нативные уведомления для упоминаний @username — требование
            // «уведомления о упоминаниях в чате».
            try {
              const me = usernameRef.current.trim();
              const isSelf = incoming.authorId === "self" || incoming.authorName === me;
              if (!isSelf && me && me !== "Гость") {
                const mentionRe = new RegExp(`(^|\\s)@${me.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\b|$)`, "i");
                if (mentionRe.test(incoming.text)) {
                  const snap = visibilityRef.current;
                  const panelHidden = !snap.showRightPanel || snap.rightPanelView !== "chat";
                  const docHidden = typeof document !== "undefined" && document.visibilityState !== "visible";
                  const now = Date.now();
                  if ((panelHidden || docHidden) && now - lastNotifyRef.current > 4000) {
                    lastNotifyRef.current = now;
                    desktop().notify(
                      `Упоминание в чате (${incoming.authorName})`,
                      incoming.text.replace(/\s+/g, " ").trim().slice(0, 140),
                    );
                  }
                }
              }
            } catch (notifyErr) {
              log.debug("chat", "Не удалось отправить уведомление об упоминании", notifyErr);
            }
          } else if (t === "presence" && Array.isArray(msg.users)) {
            setParticipants(
              (msg.users as Array<Record<string, unknown>>).map((u) => ({
                id: String(u.id ?? "?"),
                name: String(u.name ?? "Аноним"),
                color: String(u.color ?? "#F97316"),
              })),
            );
          }
        } catch (err) {
          log.warn("chat", "Битый ws-фрейм", err);
        }
      });
    } catch (err) {
      log.error("chat", "Не удалось подключить чат", err);
    }
  }, [roomId, fileId]);

  useEffect(() => {
    connect();
    return () => {
      try { wsRef.current?.close(); } catch (err) { log.warn("chat", "close ws", err); }
      wsRef.current = null;
    };
  }, [connect]);

  const send = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      wsRef.current.send(JSON.stringify({
        type: "chat",
        message: text,
        authorName: usernameRef.current,
        ts: Date.now(),
      }));
      setMessages((prev) => prev.concat({
        id: `local_${Date.now()}`,
        authorId: "self",
        authorName: usernameRef.current,
        text,
        ts: Date.now(),
      }));
      setInput("");
    } catch (err) {
      log.error("chat", "Не удалось отправить сообщение", err);
    }
  };

  if (!roomId) {
    return (
      <aside className="w-[340px] shrink-0 bg-[#0F0F11] border-l border-white/5 flex flex-col">
        <div className="flex items-center h-9 px-3 border-b border-white/5">
          <MessageSquare className="w-3.5 h-3.5 text-[#F97316]" />
          <span className="ml-2 text-[12px] font-medium tracking-wider uppercase text-zinc-300">Чат комнаты</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleRightPanel}
            className="w-6 h-6 grid place-items-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            aria-label="Закрыть"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4 text-[13px] text-zinc-500 leading-relaxed">
          Войдите в облачную комнату, чтобы открыть чат и список участников.
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] shrink-0 bg-[#0F0F11] border-l border-white/5 flex flex-col">
      <div className="flex items-center h-9 px-3 border-b border-white/5">
        <MessageSquare className="w-3.5 h-3.5 text-[#F97316]" />
        <span className="ml-2 text-[12px] font-medium tracking-wider uppercase text-zinc-300">Чат комнаты</span>
        <span className={`ml-2 w-1.5 h-1.5 rounded-full ${connected ? "bg-[#56C271]" : "bg-zinc-600"}`} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={toggleRightPanel}
          className="w-6 h-6 grid place-items-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
          aria-label="Закрыть"
          data-testid="chat-panel-close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {participants.length > 0 && (
        <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1.5 text-[11.5px] text-zinc-500">
          <Users className="w-3 h-3" />
          <span>В комнате: {participants.length}</span>
          <div className="flex -space-x-1 ml-1">
            {participants.slice(0, 5).map((p) => (
              <div
                key={p.id}
                title={p.name}
                className="w-4 h-4 rounded-full border border-[#0F0F11]"
                style={{ background: p.color }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-[12.5px] text-zinc-500">Сообщений пока нет.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} data-testid={`chat-msg-${m.id}`}>
            <div className="flex items-baseline gap-1.5 text-[11px] text-zinc-500">
              <span className="text-zinc-300 font-medium">{m.authorName}</span>
              <span>{new Date(m.ts).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="text-[13px] text-zinc-200 whitespace-pre-wrap break-words">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="p-2.5 border-t border-white/5 flex items-center gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Сообщение комнаты"
          className="flex-1 h-8 px-2.5 rounded-md bg-[#131316] border border-white/8 text-[13px] focus-ring placeholder:text-zinc-500"
          data-testid="chat-input"
        />
        <button
          type="button"
          onClick={send}
          disabled={!connected || !input.trim()}
          className="h-8 w-8 grid place-items-center rounded-md bg-[#F97316] hover:bg-[#FB923C] text-[#1C0A00] disabled:opacity-40"
          aria-label="Отправить"
          data-testid="chat-send"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
