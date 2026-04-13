import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ToolCallInfo {
  name: string;
  args: Record<string, string>;
  result: { success?: boolean; name?: string; error?: string };
}

interface Props {
  roomId: string;
  fileId: string | null;
  fileContent: string;
  language: string;
  fileName: string;
  onFilesChanged?: () => void;
  onContentRestored?: (content: string) => void;
  onShowAiDiff?: (oldContent: string, newContent: string) => void;
  onClearAiDiff?: () => void;
  onFileStream?: (fileId: string | null, fileName: string | null, content: string) => void;
}

function playDoneSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.13);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.13 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.32);
      osc.start(now + i * 0.13);
      osc.stop(now + i * 0.13 + 0.32);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch (_) {}
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  );
}

function ToolCallBadge({ toolCall }: { toolCall: ToolCallInfo }) {
  const labels: Record<string, string> = {
    create_file: "Создал файл",
    edit_file: "Отредактировал файл",
    delete_file: "Удалил файл",
  };
  const label = labels[toolCall.name] ?? toolCall.name;
  const ok = toolCall.result?.success;
  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded text-xs my-1"
      style={{
        background: ok ? "rgba(63, 185, 80, 0.1)" : "rgba(255, 123, 114, 0.1)",
        border: `1px solid ${ok ? "rgba(63, 185, 80, 0.3)" : "rgba(255, 123, 114, 0.3)"}`,
        color: ok ? "#3FB950" : "#FF7B72",
      }}
    >
      <span>{ok ? "✓" : "✗"}</span>
      <span>{label}: {toolCall.result?.name ?? toolCall.args?.name ?? toolCall.args?.fileId ?? ""}</span>
    </div>
  );
}

function SafeMarkdown({ text }: { text: string }) {
  const parts: Array<{ type: "code" | "inline-code" | "text"; content: string }> = [];
  const codeBlockRegex = /```(?:\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: match[1] ?? "" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }
  return (
    <div>
      {parts.map((part, i) => {
        if (part.type === "code") {
          return (
            <pre key={i} className="rounded p-2 my-1 overflow-x-auto text-xs" style={{ background: "#0D1117", border: "1px solid #30363D", fontFamily: "JetBrains Mono, monospace" }}>
              <code>{part.content.trimEnd()}</code>
            </pre>
          );
        }
        const segments = part.content.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {segments.map((seg, j) => {
              if (seg.startsWith("`") && seg.endsWith("`")) {
                return (
                  <code key={j} className="px-1 rounded text-xs" style={{ background: "#0D1117", color: "#79C0FF", fontFamily: "JetBrains Mono, monospace" }}>
                    {seg.slice(1, -1)}
                  </code>
                );
              }
              return (
                <span key={j}>
                  {seg.split("\n").map((line, k) => (
                    <span key={k}>{k > 0 && <br />}{line}</span>
                  ))}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

export function AIChatFloat({
  roomId, fileId, fileContent, language, fileName,
  onFilesChanged, onContentRestored, onShowAiDiff, onClearAiDiff, onFileStream,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading, toolCalls]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  function showToast(text: string, ok: boolean) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, ok });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  function getHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const guestToken = localStorage.getItem("codesync_guest_token");
    if (guestToken) h["x-guest-token"] = guestToken;
    return h;
  }

  async function sendChat() {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);
    onClearAiDiff?.();

    const allMessages = [...messages, { role: "user" as const, content: userMsg }];
    const contentBeforeEdit = fileContent;

    try {
      const resp = await fetch(`${basePath}/api/ai/chat`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          messages: allMessages,
          context: fileContent,
          language,
          roomId,
          fileId,
        }),
      });

      if (!resp.ok) throw new Error("Chat failed");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let addedAssistant = false;
      let editedFileId: string | null = null;
      let editedNewContent: string | null = null;
      let hadToolCalls = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data) as {
              content?: string;
              error?: string;
              toolCall?: ToolCallInfo;
              fileStream?: { toolName: string; fileId?: string; fileName?: string; content: string; done?: boolean };
            };

            if (parsed.fileStream) {
              const fs = parsed.fileStream;
              onFileStream?.(fs.fileId ?? null, fs.fileName ?? null, fs.content);
            }

            if (parsed.toolCall) {
              hadToolCalls = true;
              const tc = parsed.toolCall;
              const labels: Record<string, string> = {
                create_file: "Создал файл",
                edit_file: "Отредактировал файл",
                delete_file: "Удалил файл",
              };
              const label = `${labels[tc.name] ?? tc.name}${tc.result?.name ? `: ${tc.result.name}` : ""}`;
              showToast(label, !!tc.result?.success);
              onFilesChanged?.();
              setToolCalls((prev) => [...prev, tc]);
              if (tc.name === "edit_file" && tc.result?.success && tc.args?.fileId === fileId) {
                editedFileId = tc.args.fileId;
                editedNewContent = tc.args.content ?? null;
              }
            }

            if (parsed.content) {
              if (!addedAssistant) {
                setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
                addedAssistant = true;
              }
              assistantContent += parsed.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch (_) {}
        }
      }

      if (editedFileId && editedNewContent !== null && fileId === editedFileId) {
        onContentRestored?.(editedNewContent);
        onShowAiDiff?.(contentBeforeEdit, editedNewContent);
      }

      if (!addedAssistant && assistantContent === "" && !hadToolCalls) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Готово!" }]);
      }

      playDoneSound();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Произошла ошибка. Попробуйте ещё раз.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendChat();
    }
  }

  const panel = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ai-chat-panel"
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{
            position: "fixed",
            bottom: 72,
            left: "50%",
            transform: "translateX(-50%)",
            width: 440,
            maxWidth: "calc(100vw - 32px)",
            height: 520,
            background: "rgba(10,10,10,0.96)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(88,166,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9000,
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Glow top */}
          <div style={{
            position: "absolute",
            top: 0,
            left: "20%",
            right: "20%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.6), rgba(63,185,80,0.4), transparent)",
            pointerEvents: "none",
          }} />

          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "linear-gradient(135deg, #58A6FF, #3FB950)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 800,
              color: "#0D1117",
            }}>
              AI
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E6EDF3" }}>CodeSync AI</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fileName || "Файл не выбран"}</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setToolCalls([]); }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 11, padding: "2px 6px", borderRadius: 6 }}
                  title="Очистить чат"
                >
                  Очистить
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && toolCalls.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{ textAlign: "center", paddingTop: 40 }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(88,166,255,0.2), rgba(63,185,80,0.2))",
                  border: "1px solid rgba(88,166,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px",
                  fontSize: 20,
                }}>
                  ✦
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#E6EDF3", marginBottom: 6 }}>CodeSync AI</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                  Задайте вопрос по коду или попросите<br/>создать и изменить файлы
                </p>
              </motion.div>
            )}

            {toolCalls.length > 0 && (
              <div>
                {toolCalls.map((tc, i) => <ToolCallBadge key={i} toolCall={tc} />)}
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8 }}>
                  {msg.role === "assistant" && (
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: "linear-gradient(135deg, #58A6FF, #3FB950)",
                      color: "#0D1117",
                      fontSize: 7,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      AI
                    </div>
                  )}
                  <div
                    className="ai-prose"
                    style={{
                      maxWidth: "83%",
                      borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "4px 12px 12px 12px",
                      padding: "8px 12px",
                      fontSize: 12,
                      lineHeight: 1.65,
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, rgba(88,166,255,0.18), rgba(88,166,255,0.1))"
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${msg.role === "user" ? "rgba(88,166,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                      color: "#E6EDF3",
                    }}
                  >
                    <SafeMarkdown text={msg.content} />
                  </div>
                </div>
              </motion.div>
            ))}

            {isChatLoading && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #58A6FF, #3FB950)",
                  color: "#0D1117",
                  fontSize: 7,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  AI
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "4px 12px 12px 12px",
                  padding: "8px 12px",
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 14px 14px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{
              display: "flex",
              gap: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "8px 10px",
              transition: "border-color 0.2s",
            }}>
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Спросить AI... (Enter для отправки)"
                rows={1}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#E6EDF3",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  resize: "none",
                  lineHeight: 1.5,
                  maxHeight: 120,
                  overflowY: "auto",
                }}
                disabled={isChatLoading}
              />
              <motion.button
                onClick={() => void sendChat()}
                disabled={!chatInput.trim() || isChatLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: chatInput.trim() && !isChatLoading
                    ? "linear-gradient(135deg, #58A6FF, #3FB950)"
                    : "rgba(255,255,255,0.06)",
                  border: "none",
                  cursor: chatInput.trim() && !isChatLoading ? "pointer" : "default",
                  color: chatInput.trim() && !isChatLoading ? "#0D1117" : "rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  flexShrink: 0,
                  alignSelf: "flex-end",
                  transition: "background 0.2s",
                }}
              >
                ↑
              </motion.button>
            </div>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6, textAlign: "center" }}>
              Enter — отправить · Shift+Enter — новая строка
            </p>
          </div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                key="chat-toast"
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                style={{
                  position: "absolute",
                  top: 54,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: toast.ok ? "rgba(63,185,80,0.15)" : "rgba(255,123,114,0.15)",
                  border: `1px solid ${toast.ok ? "rgba(63,185,80,0.4)" : "rgba(255,123,114,0.4)"}`,
                  color: toast.ok ? "#3FB950" : "#FF7B72",
                  borderRadius: 8,
                  padding: "5px 12px",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  zIndex: 10,
                }}
              >
                {toast.ok ? "✓ " : "✗ "}{toast.text}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const trigger = (
    <motion.button
      onClick={() => setIsOpen((o) => !o)}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        height: 44,
        paddingLeft: 18,
        paddingRight: 18,
        borderRadius: 22,
        background: isOpen
          ? "rgba(255,255,255,0.08)"
          : "linear-gradient(135deg, rgba(88,166,255,0.9), rgba(63,185,80,0.9))",
        border: isOpen
          ? "1px solid rgba(255,255,255,0.15)"
          : "1px solid transparent",
        color: isOpen ? "rgba(255,255,255,0.7)" : "#0D1117",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: 8,
        zIndex: 8999,
        boxShadow: isOpen
          ? "none"
          : "0 8px 32px rgba(88,166,255,0.35), 0 2px 8px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
        transition: "background 0.25s, box-shadow 0.25s",
      }}
    >
      {!isOpen && (
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ width: 7, height: 7, borderRadius: "50%", background: "#0D1117", display: "inline-block" }}
        />
      )}
      {isOpen ? "× Закрыть AI" : "✦ Чат с AI"}
      {!isOpen && isChatLoading && (
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <div className="typing-dot" style={{ background: "#0D1117" }} />
          <div className="typing-dot" style={{ background: "#0D1117", animationDelay: "0.2s" }} />
        </div>
      )}
    </motion.button>
  );

  return (
    <>
      {ReactDOM.createPortal(trigger, document.body)}
      {ReactDOM.createPortal(panel, document.body)}
    </>
  );
}
