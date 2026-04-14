import { useRef, useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface Member {
  userId: string;
  username: string;
  color: string;
  isGuest: boolean;
}

export interface ChatFileAttachment {
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
}

export interface ChatReplyInfo {
  id: string;
  username: string;
  content: string;
}

export interface RoomChatMessage {
  id: string;
  userId: string;
  username: string;
  color: string;
  content: string;
  imageDataUrl?: string;
  fileAttachment?: ChatFileAttachment;
  replyTo?: ChatReplyInfo;
  edited?: boolean;
  timestamp: number;
}

interface Props {
  members: Member[];
  chatMessages: RoomChatMessage[];
  myUserId: string;
  onSendMessage: (content: string, imageDataUrl?: string, fileAttachment?: ChatFileAttachment, replyTo?: ChatReplyInfo) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "📦";
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("typescript")) return "📝";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📎";
}

interface ContextMenuState {
  x: number;
  y: number;
  message: RoomChatMessage;
}

export function SessionSidebar({ members, chatMessages, myUserId, onSendMessage, onEditMessage, onDeleteMessage }: Props) {
  const [chatInput, setChatInput] = useState("");
  const [replyTo, setReplyTo] = useState<ChatReplyInfo | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Close context menu on click outside or Escape
  useEffect(() => {
    if (!contextMenu) return;
    function onClose(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setContextMenu(null);
    }
    document.addEventListener("mousedown", onClose);
    document.addEventListener("keydown", onClose);
    return () => {
      document.removeEventListener("mousedown", onClose);
      document.removeEventListener("keydown", onClose);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingMessageId]);

  function handleSend() {
    const msg = chatInput.trim();
    if (!msg) return;
    if (editingMessageId) {
      onEditMessage(editingMessageId, msg);
      setEditingMessageId(null);
      setEditingContent("");
      setChatInput("");
      return;
    }
    onSendMessage(msg, undefined, undefined, replyTo ?? undefined);
    setChatInput("");
    setReplyTo(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setReplyTo(null);
      setEditingMessageId(null);
      setChatInput("");
    }
  }

  const handleFileAttach = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Файл слишком большой (макс. 5 МБ)");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      if (file.type.startsWith("image/")) {
        onSendMessage(chatInput.trim() || file.name, dataUrl, undefined, replyTo ?? undefined);
      } else {
        const attachment: ChatFileAttachment = {
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
        };
        onSendMessage(chatInput.trim() || file.name, undefined, attachment, replyTo ?? undefined);
      }
      setChatInput("");
      setReplyTo(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [chatInput, replyTo, onSendMessage]);

  function startReply(msg: RoomChatMessage) {
    setReplyTo({ id: msg.id, username: msg.username, content: msg.content });
    setEditingMessageId(null);
    setEditingContent("");
    setChatInput("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function startEdit(msg: RoomChatMessage) {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
    setChatInput(msg.content);
    setReplyTo(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleCopy(msg: RoomChatMessage) {
    void navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function handleDelete(msg: RoomChatMessage) {
    onDeleteMessage(msg.id);
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#0e0e0e", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Participants header */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
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
                style={{ width: 22, height: 22, borderRadius: 7, background: member.color, color: "#000", fontSize: 8 }}
              >
                {member.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>
                    {member.username}
                  </span>
                  {member.isGuest && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>(гость)</span>}
                  {member.userId === myUserId && <span style={{ fontSize: 9, color: "rgba(88,166,255,0.6)" }}>вы</span>}
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
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 4px", display: "flex", flexDirection: "column", gap: 4 }}>
        {chatMessages.length === 0 && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", textAlign: "center", paddingTop: 16 }}>
            Напишите что-нибудь
          </p>
        )}
        <AnimatePresence initial={false}>
          {chatMessages.map((msg) => {
            const isMe = msg.userId === myUserId;
            const isCopied = copiedId === msg.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", position: "relative" }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const x = Math.min(e.clientX, window.innerWidth - 160);
                  const y = Math.min(e.clientY, window.innerHeight - (isMe ? 130 : 100));
                  setContextMenu({ x, y, message: msg });
                }}
              >
                {/* Username (for others) */}
                {!isMe && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2, paddingLeft: 2 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: msg.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#000", fontWeight: 700, flexShrink: 0 }}>
                      {msg.username.slice(0, 1).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{msg.username}</span>
                  </div>
                )}

                {/* Reply preview */}
                {msg.replyTo && (
                  <div style={{
                    maxWidth: "88%",
                    borderLeft: `2px solid ${isMe ? "#58A6FF" : "rgba(255,255,255,0.3)"}`,
                    paddingLeft: 6,
                    marginBottom: 2,
                    opacity: 0.6,
                  }}>
                    <span style={{ fontSize: 9, color: "#58A6FF", fontWeight: 600 }}>{msg.replyTo.username}</span>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                      {msg.replyTo.content}
                    </p>
                  </div>
                )}

                {/* Bubble */}
                <div style={{
                  maxWidth: "90%",
                  background: isMe ? "rgba(88,166,255,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isMe ? "rgba(88,166,255,0.2)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: isMe ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                  padding: "5px 9px",
                }}>
                  {/* Image */}
                  {msg.imageDataUrl && (
                    <img
                      src={msg.imageDataUrl}
                      alt="вложение"
                      style={{ maxWidth: "100%", borderRadius: 6, marginBottom: msg.content && msg.content !== msg.imageDataUrl ? 4 : 0, display: "block" }}
                    />
                  )}

                  {/* File attachment */}
                  {msg.fileAttachment && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(255,255,255,0.06)", borderRadius: 8,
                      padding: "6px 8px", marginBottom: msg.content && msg.content !== msg.fileAttachment.name ? 4 : 0,
                    }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{getFileIcon(msg.fileAttachment.mimeType)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {msg.fileAttachment.name}
                        </p>
                        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", margin: 0 }}>
                          {formatSize(msg.fileAttachment.size)}
                        </p>
                      </div>
                      <a
                        href={msg.fileAttachment.dataUrl}
                        download={msg.fileAttachment.name}
                        onClick={(e) => e.stopPropagation()}
                        title="Скачать"
                        style={{
                          color: "#58A6FF", lineHeight: 0, flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, borderRadius: 6,
                          background: "rgba(88,166,255,0.1)",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 11L3 6h3V1h4v5h3L8 11zM1 13h14v2H1v-2z"/>
                        </svg>
                      </a>
                    </div>
                  )}

                  {/* Text content */}
                  {msg.content && msg.content !== (msg.fileAttachment?.name) && (
                    <p style={{ fontSize: 11, color: "#E6EDF3", lineHeight: 1.5, wordBreak: "break-word", margin: 0 }}>
                      {msg.content}
                    </p>
                  )}
                </div>

                {/* Timestamp + edited */}
                <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2, paddingLeft: isMe ? 0 : 2, paddingRight: isMe ? 2 : 0 }}>
                  {isCopied && (
                    <span style={{ fontSize: 9, color: "#3FB950" }}>Скопировано!</span>
                  )}
                  {msg.edited && (
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>ред.</span>
                  )}
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* Reply indicator */}
      {replyTo && (
        <div style={{
          padding: "4px 8px", flexShrink: 0,
          background: "rgba(88,166,255,0.05)",
          borderTop: "1px solid rgba(88,166,255,0.15)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, color: "#58A6FF", margin: 0, fontWeight: 600 }}>↩ {replyTo.username}</p>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {replyTo.content}
            </p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, lineHeight: 1, padding: 2 }}
          >×</button>
        </div>
      )}

      {/* Edit indicator */}
      {editingMessageId && (
        <div style={{
          padding: "4px 8px", flexShrink: 0,
          background: "rgba(242,204,96,0.05)",
          borderTop: "1px solid rgba(242,204,96,0.15)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 9, color: "#F2CC60", margin: 0, fontWeight: 600 }}>✎ Редактирование сообщения</p>
          </div>
          <button
            onClick={() => { setEditingMessageId(null); setEditingContent(""); setChatInput(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, lineHeight: 1, padding: 2 }}
          >×</button>
        </div>
      )}

      {/* Telegram-style right-click context menu */}
      {contextMenu && ReactDOM.createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 99999,
              background: "#0D1117",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
              padding: "4px",
              minWidth: 152,
              backdropFilter: "blur(20px)",
            }}
          >
            {(() => {
              const msg = contextMenu.message;
              const isMe = msg.userId === myUserId;
              const items = [
                {
                  label: "Ответить",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                    </svg>
                  ),
                  color: "#58A6FF",
                  action: () => { startReply(msg); setContextMenu(null); },
                  always: true,
                },
                {
                  label: copiedId === msg.id ? "Скопировано!" : "Копировать",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  ),
                  color: "rgba(255,255,255,0.65)",
                  action: () => { handleCopy(msg); setContextMenu(null); },
                  always: true,
                },
                {
                  label: "Изменить",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                    </svg>
                  ),
                  color: "#F2CC60",
                  action: () => { startEdit(msg); setContextMenu(null); },
                  always: false,
                  ownOnly: true,
                },
                {
                  label: "Удалить",
                  icon: (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  ),
                  color: "#F85149",
                  action: () => { handleDelete(msg); setContextMenu(null); },
                  always: false,
                  ownOnly: true,
                },
              ];
              return (
                <>
                  {items
                    .filter((item) => item.always || (item.ownOnly && isMe))
                    .map((item, i, arr) => (
                      <div key={item.label}>
                        <button
                          onClick={item.action}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 9,
                            padding: "7px 10px", borderRadius: 8, border: "none",
                            background: "transparent", cursor: "pointer", color: item.color,
                            fontSize: 12, fontWeight: 500, textAlign: "left",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget).style.background = "rgba(255,255,255,0.07)"; }}
                          onMouseLeave={(e) => { (e.currentTarget).style.background = "transparent"; }}
                        >
                          <span style={{ opacity: 0.85, flexShrink: 0 }}>{item.icon}</span>
                          {item.label}
                        </button>
                        {i === 1 && isMe && <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 6px" }} />}
                      </div>
                    ))}
                </>
              );
            })()}
          </motion.div>
        </AnimatePresence>,
        document.body,
      )}

      {/* Chat input */}
      <div style={{ padding: "6px 8px 8px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileAttach}
        />
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {/* Attach file button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Прикрепить файл"
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer", color: "rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>

          {/* Input */}
          <input
            ref={inputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={editingMessageId ? "Изменить сообщение..." : "Сообщение..."}
            style={{
              flex: 1,
              background: editingMessageId ? "rgba(242,204,96,0.06)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${editingMessageId ? "rgba(242,204,96,0.2)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8, padding: "5px 8px",
              fontSize: 11, color: "#E6EDF3", outline: "none",
              fontFamily: "Inter, sans-serif",
              transition: "border-color 0.15s",
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!chatInput.trim()}
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: chatInput.trim() ? (editingMessageId ? "rgba(242,204,96,0.2)" : "rgba(88,166,255,0.2)") : "rgba(255,255,255,0.04)",
              border: `1px solid ${chatInput.trim() ? (editingMessageId ? "rgba(242,204,96,0.3)" : "rgba(88,166,255,0.3)") : "rgba(255,255,255,0.06)"}`,
              cursor: chatInput.trim() ? "pointer" : "default",
              color: chatInput.trim() ? (editingMessageId ? "#F2CC60" : "#58A6FF") : "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
          >
            {editingMessageId ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
