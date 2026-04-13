import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const PANEL_W = 480;
const PANEL_H = 560;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
  result: { success?: boolean; name?: string; error?: string; fileId?: string };
}

interface ImageResult {
  id: string;
  thumb: string;
  full: string;
  description: string;
  photographer: string;
}

interface Props {
  roomId: string;
  fileId: string | null;
  fileContent: string;
  language: string;
  fileName: string;
  files?: Array<{ id: string; name: string; language: string; content: string }>;
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

function SafeMarkdown({ text }: { text: string }) {
  const parts: Array<{ type: "code" | "text"; content: string }> = [];
  const codeBlockRegex = /```(?:\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    parts.push({ type: "code", content: match[1] ?? "" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ type: "text", content: text.slice(lastIndex) });
  return (
    <div>
      {parts.map((part, i) => {
        if (part.type === "code") {
          return (
            <pre key={i} className="rounded p-2 my-1 overflow-x-auto text-xs"
              style={{ background: "#0D1117", border: "1px solid #30363D", fontFamily: "JetBrains Mono, monospace" }}>
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
                  <code key={j} className="px-1 rounded text-xs"
                    style={{ background: "#0D1117", color: "#79C0FF", fontFamily: "JetBrains Mono, monospace" }}>
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
  roomId, fileId, fileContent, language, fileName, files = [],
  onFilesChanged, onContentRestored, onShowAiDiff, onClearAiDiff, onFileStream,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [flashToast, setFlashToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "images">("chat");
  const [imageQuery, setImageQuery] = useState("");
  const [imageResults, setImageResults] = useState<ImageResult[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  useEffect(() => {
    if (isOpen && activeTab === "chat") setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen, activeTab]);

  function showFlash(text: string, ok: boolean) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashToast({ text, ok });
    flashTimerRef.current = setTimeout(() => setFlashToast(null), 1500);
  }

  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

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
          allFiles: files.map((f) => ({ id: f.id, name: f.name, language: f.language, content: f.content })),
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
                search_images: "Нашёл изображения",
                download_image: "Скачал изображение",
              };
              const label = `${labels[tc.name] ?? tc.name}${tc.result?.name ? `: ${tc.result.name}` : ""}`;
              showFlash(label, !!tc.result?.success);
              onFilesChanged?.();

              // After create_file succeeds, switch editor to the new file
              if (tc.name === "create_file" && tc.result?.success && tc.result?.fileId) {
                onFileStream?.(tc.result.fileId, tc.result.name ?? null, (tc.args.content as string | undefined) ?? "");
              }

              if (tc.name === "edit_file" && tc.result?.success && tc.args?.fileId === fileId) {
                editedFileId = tc.args.fileId as string;
                editedNewContent = (tc.args.content as string | undefined) ?? null;
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

      if (!addedAssistant && !hadToolCalls) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Готово!" }]);
      }

      playDoneSound();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Произошла ошибка.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  async function searchImages() {
    const q = imageQuery.trim();
    if (!q || isSearchingImages) return;
    setIsSearchingImages(true);
    setImageError(null);
    setImageResults([]);
    try {
      const resp = await fetch(`${basePath}/api/images/search?q=${encodeURIComponent(q)}`, {
        headers: getHeaders(),
      });
      if (!resp.ok) throw new Error(`Ошибка ${resp.status}`);
      const data = await resp.json() as { results?: ImageResult[]; error?: string };
      if (data.error) throw new Error(data.error);
      setImageResults(data.results ?? []);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Ошибка поиска");
    } finally {
      setIsSearchingImages(false);
    }
  }

  async function addImageToProject(img: ImageResult) {
    try {
      const resp = await fetch(`${basePath}/api/images/import`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ roomId, url: img.full, name: `image_${img.id}.jpg` }),
      });
      if (!resp.ok) throw new Error(`Ошибка ${resp.status}`);
      const data = await resp.json() as { name?: string; error?: string };
      if (data.error) throw new Error(data.error);
      showFlash(`Добавил: ${data.name}`, true);
      onFilesChanged?.();
    } catch (err) {
      showFlash(err instanceof Error ? err.message : "Ошибка", false);
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
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          style={{
            position: "fixed",
            bottom: 76,
            left: `calc(50% - ${PANEL_W / 2}px)`,
            width: PANEL_W,
            maxWidth: "calc(100vw - 24px)",
            height: PANEL_H,
            background: "rgba(8,8,10,0.97)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 18,
            boxShadow: "0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(88,166,255,0.07), inset 0 1px 0 rgba(255,255,255,0.07)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9000,
            backdropFilter: "blur(28px)",
          }}
        >
          {/* Glow top line */}
          <div style={{
            position: "absolute", top: 0, left: "15%", right: "15%", height: 1,
            background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.5), rgba(63,185,80,0.35), transparent)",
            pointerEvents: "none",
          }} />

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #1a1d29 0%, #0d1117 100%)",
              border: "1px solid rgba(88,166,255,0.35)",
              boxShadow: "0 0 14px rgba(88,166,255,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L9.5 5.5L14 7L9.5 8.5L8 13L6.5 8.5L2 7L6.5 5.5L8 1Z" fill="url(#ai-star)" />
                <defs>
                  <linearGradient id="ai-star" x1="2" y1="1" x2="14" y2="13">
                    <stop offset="0%" stopColor="#79C0FF"/>
                    <stop offset="100%" stopColor="#56D364"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E6EDF3" }}>CodeSync AI</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {files.length > 0 ? `${files.length} файлов в комнате` : "Глобальный контекст"}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 2 }}>
              {([["chat", "Чат"], ["images", "Изображения"]] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                    background: activeTab === tab ? "rgba(255,255,255,0.1)" : "transparent",
                    color: activeTab === tab ? "#E6EDF3" : "rgba(255,255,255,0.35)",
                    border: "none", cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              {activeTab === "chat" && messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.28)", fontSize: 11, padding: "2px 6px", borderRadius: 5 }}
                >
                  Очистить
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  cursor: "pointer", color: "rgba(255,255,255,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          {activeTab === "chat" ? (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 }}
                    style={{ textAlign: "center", paddingTop: 48 }}
                  >
                    <div style={{
                      width: 52, height: 52, borderRadius: 15, margin: "0 auto 14px",
                      background: "linear-gradient(135deg, rgba(88,166,255,0.18), rgba(63,185,80,0.18))",
                      border: "1px solid rgba(88,166,255,0.18)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                    }}>✦</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#E6EDF3", marginBottom: 6 }}>CodeSync AI</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", lineHeight: 1.7 }}>
                      Задайте вопрос по коду или попросите<br />создать и изменить файлы в комнате
                    </p>
                  </motion.div>
                )}

                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8 }}>
                      {msg.role === "assistant" && (
                        <div style={{
                          width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 2,
                          background: "#0D1117",
                          border: "1px solid rgba(88,166,255,0.4)",
                          boxShadow: "0 0 8px rgba(88,166,255,0.18)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1L9.5 5.5L14 7L9.5 8.5L8 13L6.5 8.5L2 7L6.5 5.5L8 1Z" fill="url(#ai-star-sm)" />
                            <defs>
                              <linearGradient id="ai-star-sm" x1="2" y1="1" x2="14" y2="13">
                                <stop offset="0%" stopColor="#79C0FF"/>
                                <stop offset="100%" stopColor="#56D364"/>
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>
                      )}
                      <div
                        className="ai-prose"
                        style={{
                          maxWidth: "83%",
                          borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "4px 12px 12px 12px",
                          padding: "8px 12px", fontSize: 12, lineHeight: 1.65,
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
                      width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 2,
                      background: "#0D1117",
                      border: "1px solid rgba(88,166,255,0.4)",
                      boxShadow: "0 0 8px rgba(88,166,255,0.18)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1L9.5 5.5L14 7L9.5 8.5L8 13L6.5 8.5L2 7L6.5 5.5L8 1Z" fill="url(#ai-star-ld)" />
                        <defs>
                          <linearGradient id="ai-star-ld" x1="2" y1="1" x2="14" y2="13">
                            <stop offset="0%" stopColor="#79C0FF"/>
                            <stop offset="100%" stopColor="#56D364"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <div style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "4px 12px 12px 12px", padding: "8px 12px",
                    }}>
                      <TypingDots />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "8px 12px 12px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
                {/* Flash toast above input */}
                <AnimatePresence>
                  {flashToast && (
                    <motion.div
                      key="flash"
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      style={{
                        position: "absolute",
                        bottom: "calc(100% - 2px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: flashToast.ok ? "rgba(63,185,80,0.18)" : "rgba(255,123,114,0.18)",
                        border: `1px solid ${flashToast.ok ? "rgba(63,185,80,0.5)" : "rgba(255,123,114,0.5)"}`,
                        color: flashToast.ok ? "#3FB950" : "#FF7B72",
                        borderRadius: 8, padding: "5px 14px", fontSize: 12,
                        whiteSpace: "nowrap", zIndex: 10, backdropFilter: "blur(8px)",
                      }}
                    >
                      {flashToast.ok ? "✓ " : "✗ "}{flashToast.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div style={{
                  display: "flex", gap: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 12, padding: "8px 10px",
                }}>
                  <textarea
                    ref={inputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Спросить AI... (Enter для отправки)"
                    rows={1}
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: "#E6EDF3", fontSize: 13, fontFamily: "Inter, sans-serif",
                      resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
                    }}
                    disabled={isChatLoading}
                  />
                  <motion.button
                    onClick={() => void sendChat()}
                    disabled={!chatInput.trim() || isChatLoading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: chatInput.trim() && !isChatLoading
                        ? "linear-gradient(135deg, #58A6FF, #3FB950)"
                        : "rgba(255,255,255,0.06)",
                      border: "none",
                      cursor: chatInput.trim() && !isChatLoading ? "pointer" : "default",
                      color: chatInput.trim() && !isChatLoading ? "#0D1117" : "rgba(255,255,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, flexShrink: 0, alignSelf: "flex-end",
                      transition: "background 0.2s",
                    }}
                  >
                    ↑
                  </motion.button>
                </div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", marginTop: 5, textAlign: "center" }}>
                  Enter — отправить · Shift+Enter — новая строка
                </p>
              </div>
            </>
          ) : (
            /* Images tab */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Search bar */}
              <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    ref={imageInputRef}
                    value={imageQuery}
                    onChange={(e) => setImageQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void searchImages(); }}
                    placeholder="Найти изображения..."
                    style={{
                      flex: 1, background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      borderRadius: 10, padding: "7px 12px", fontSize: 12,
                      color: "#E6EDF3", outline: "none",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                  <motion.button
                    onClick={() => void searchImages()}
                    disabled={!imageQuery.trim() || isSearchingImages}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: "7px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: "rgba(88,166,255,0.2)",
                      border: "1px solid rgba(88,166,255,0.3)",
                      color: "#58A6FF", cursor: "pointer",
                    }}
                  >
                    {isSearchingImages ? "..." : "Найти"}
                  </motion.button>
                </div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
                  Изображения от Unsplash · Нажмите + чтобы добавить в проект
                </p>
              </div>

              {/* Results */}
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
                {isSearchingImages && (
                  <div style={{ textAlign: "center", paddingTop: 40, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                    <TypingDots />
                  </div>
                )}
                {imageError && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 10, fontSize: 12,
                    background: "rgba(255,123,114,0.08)", border: "1px solid rgba(255,123,114,0.2)",
                    color: "#FF7B72",
                  }}>
                    {imageError}
                  </div>
                )}
                {!isSearchingImages && !imageError && imageResults.length === 0 && (
                  <div style={{ textAlign: "center", paddingTop: 48 }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>🔍</div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Введите запрос для поиска изображений</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", marginTop: 6 }}>
                      Например: nature, technology, city
                    </p>
                  </div>
                )}
                {imageResults.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {imageResults.map((img) => (
                      <motion.div
                        key={img.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ position: "relative", borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
                        whileHover={{ scale: 1.03 }}
                      >
                        <img
                          src={img.thumb}
                          alt={img.description || "Image"}
                          style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }}
                        />
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "rgba(0,0,0,0)",
                          transition: "background 0.15s",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
                        >
                          <button
                            onClick={() => void addImageToProject(img)}
                            style={{
                              background: "rgba(255,255,255,0.9)",
                              border: "none", borderRadius: 6,
                              padding: "4px 10px", fontSize: 11, fontWeight: 700,
                              color: "#0D1117", cursor: "pointer",
                              opacity: 0,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                          >
                            + Добавить
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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
        bottom: 22,
        left: `calc(50% - 54px)`,
        width: 108,
        height: 42,
        borderRadius: 21,
        background: isOpen
          ? "rgba(255,255,255,0.08)"
          : "linear-gradient(135deg, rgba(88,166,255,0.9), rgba(63,185,80,0.9))",
        border: isOpen ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
        color: isOpen ? "rgba(255,255,255,0.7)" : "#0D1117",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        boxShadow: isOpen ? "none" : "0 8px 32px rgba(88,166,255,0.3)",
        zIndex: 8999,
        backdropFilter: isOpen ? "blur(12px)" : "none",
        letterSpacing: "0.01em",
      }}
    >
      <span style={{ fontSize: 14 }}>✦</span>
      Чат с AI
    </motion.button>
  );

  return ReactDOM.createPortal(
    <>
      {trigger}
      {panel}
    </>,
    document.body
  );
}
