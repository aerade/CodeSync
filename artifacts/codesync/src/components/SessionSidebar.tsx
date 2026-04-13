import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Member {
  userId: string;
  username: string;
  color: string;
  isGuest: boolean;
}

export interface RoomChatMessage {
  id: string;
  userId: string;
  username: string;
  color: string;
  content: string;
  imageDataUrl?: string;
  timestamp: number;
}

interface Props {
  members: Member[];
  chatMessages: RoomChatMessage[];
  myUserId: string;
  onSendMessage: (content: string, imageDataUrl?: string) => void;
}

export function SessionSidebar({ members, chatMessages, myUserId, onSendMessage }: Props) {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function handleSend() {
    const msg = chatInput.trim();
    if (!msg) return;
    onSendMessage(msg);
    setChatInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleImageAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Изображение слишком большое (макс. 2МБ)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        onSendMessage(chatInput.trim() || "📷", dataUrl);
        setChatInput("");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#0e0e0e", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Participants header */}
      <div
        className="px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
          Участники
        </span>
      </div>

      {/* Members list */}
      <div style={{ padding: "6px 8px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <AnimatePresence>
          {members.map((member) => (
            <motion.div
              key={member.userId}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              className="flex items-center gap-2 px-2 py-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", marginBottom: 2 }}
              data-testid={`member-${member.userId}`}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={{
                  width: 22, height: 22, borderRadius: 7,
                  background: member.color, color: "#000", fontSize: 8,
                }}
              >
                {member.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
                    {member.username}
                  </span>
                  {member.isGuest && (
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>(гость)</span>
                  )}
                  {member.userId === myUserId && (
                    <span style={{ fontSize: 9, color: "rgba(88,166,255,0.6)" }}>вы</span>
                  )}
                </div>
              </div>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#3FB950", flexShrink: 0 }} />
            </motion.div>
          ))}
        </AnimatePresence>
        {members.length === 0 && (
          <p className="text-xs px-2 py-1" style={{ color: "rgba(255,255,255,0.2)" }}>Нет участников</p>
        )}
      </div>

      {/* Chat header */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>
          Чат
        </span>
      </div>

      {/* Chat messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 4px", display: "flex", flexDirection: "column", gap: 6 }}>
        {chatMessages.length === 0 && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", textAlign: "center", paddingTop: 16 }}>
            Напишите что-нибудь
          </p>
        )}
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => {
            const isMe = msg.userId === myUserId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}
              >
                {!isMe && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2, paddingLeft: 2 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: msg.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#000", fontWeight: 700, flexShrink: 0 }}>
                      {msg.username.slice(0, 1).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{msg.username}</span>
                  </div>
                )}
                <div style={{
                  maxWidth: "90%",
                  background: isMe ? "rgba(88,166,255,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isMe ? "rgba(88,166,255,0.2)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: isMe ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                  padding: "5px 9px",
                }}>
                  {msg.imageDataUrl && (
                    <img
                      src={msg.imageDataUrl}
                      alt="вложение"
                      style={{ maxWidth: "100%", borderRadius: 6, marginBottom: msg.content && msg.content !== "📷" ? 4 : 0, display: "block" }}
                    />
                  )}
                  {msg.content && msg.content !== "📷" && (
                    <p style={{ fontSize: 11, color: "#E6EDF3", lineHeight: 1.5, wordBreak: "break-word", margin: 0 }}>
                      {msg.content}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2, paddingLeft: isMe ? 0 : 2, paddingRight: isMe ? 2 : 0 }}>
                  {formatTime(msg.timestamp)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div style={{ padding: "6px 8px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleImageAttach} />
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Прикрепить изображение"
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer", color: "rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение..."
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "5px 8px",
              fontSize: 11, color: "#E6EDF3", outline: "none",
              fontFamily: "Inter, sans-serif",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!chatInput.trim()}
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: chatInput.trim() ? "rgba(88,166,255,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${chatInput.trim() ? "rgba(88,166,255,0.3)" : "rgba(255,255,255,0.06)"}`,
              cursor: chatInput.trim() ? "pointer" : "default",
              color: chatInput.trim() ? "#58A6FF" : "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
