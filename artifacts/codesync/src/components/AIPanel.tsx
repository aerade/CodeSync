import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RotateCcw, Clock, ChevronDown } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Issue {
  line?: number | null;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ToolCallInfo {
  name: string;
  args: Record<string, string>;
  result: { success?: boolean; name?: string; error?: string };
}

interface Snapshot {
  id: string;
  fileId: string;
  roomId: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
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

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, { bg: string; color: string; label: string }> = {
    error: { bg: "rgba(255,123,114,0.12)", color: "#FF7B72", label: "Ошибка" },
    warning: { bg: "rgba(242,204,96,0.12)", color: "#F2CC60", label: "Предупреждение" },
    info: { bg: "rgba(88,166,255,0.12)", color: "#58A6FF", label: "Инфо" },
  };
  const s = colors[severity] ?? colors.info;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}>
      {s.label}
    </span>
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
                    <span key={k}>
                      {k > 0 && <br />}
                      {line}
                    </span>
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

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  return `${Math.floor(diff / 86400)} дн. назад`;
}

export function AIPanel({ roomId, fileId, fileContent, language, fileName, onFilesChanged, onContentRestored, onShowAiDiff, onClearAiDiff }: Props) {
  const [activeTab, setActiveTab] = useState<"review" | "chat" | "history">("chat");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const prevFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading, toolCalls]);

  useEffect(() => {
    if (fileId !== prevFileIdRef.current) {
      prevFileIdRef.current = fileId;
      setPreviewSnapshotId(null);
      setSnapshots([]);
      setHistoryError(null);
      onClearAiDiff?.();
    }
  }, [fileId, onClearAiDiff]);

  const fetchSnapshots = useCallback(async () => {
    if (!fileId || !roomId) return;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const headers: Record<string, string> = {};
      const guestToken = localStorage.getItem("codesync_guest_token");
      if (guestToken) headers["x-guest-token"] = guestToken;
      const resp = await fetch(`${basePath}/api/rooms/${roomId}/files/${fileId}/snapshots`, { headers });
      if (!resp.ok) throw new Error(`Ошибка ${resp.status}`);
      const data = await resp.json() as Snapshot[];
      setSnapshots(data);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Ошибка загрузки истории");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [fileId, roomId]);

  useEffect(() => {
    if (activeTab === "history" && fileId) {
      void fetchSnapshots();
    }
  }, [activeTab, fileId, fetchSnapshots]);

  function getHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const guestToken = localStorage.getItem("codesync_guest_token");
    if (guestToken) h["x-guest-token"] = guestToken;
    return h;
  }

  async function runReview() {
    if (!fileContent || isReviewing) return;
    setIsReviewing(true);
    setIssues([]);
    setReviewError(null);
    setHasReviewed(false);
    setActiveTab("review");

    try {
      const resp = await fetch(`${basePath}/api/ai/review`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ code: fileContent, language, roomId, fileId }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Ошибка сервера: ${resp.status}${errText ? ` — ${errText}` : ""}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            const parsed = JSON.parse(data) as { issues?: unknown[]; error?: string };
            if (parsed.error) {
              setReviewError(parsed.error);
            } else if (Array.isArray(parsed.issues)) {
              setIssues(parsed.issues as Issue[]);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка ревью. Попробуйте ещё раз.";
      setReviewError(msg);
      console.error("Review error:", err);
    } finally {
      setIsReviewing(false);
      setHasReviewed(true);
    }
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
            const parsed = JSON.parse(data) as { content?: string; error?: string; toolCall?: ToolCallInfo };

            if (parsed.toolCall) {
              setToolCalls((prev) => [...prev, parsed.toolCall!]);
              onFilesChanged?.();
              if (parsed.toolCall.name === "edit_file" && parsed.toolCall.result?.success && parsed.toolCall.args?.fileId === fileId) {
                editedFileId = parsed.toolCall.args.fileId;
                editedNewContent = parsed.toolCall.args.content ?? null;
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

      if (!addedAssistant && assistantContent === "") {
        const lastToolCalls = toolCalls;
        if (lastToolCalls.length === 0) {
          setMessages((prev) => [...prev, { role: "assistant", content: "Готово!" }]);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Произошла ошибка. Попробуйте ещё раз.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  async function restoreSnapshot(snapshotId: string) {
    if (!fileId || isRestoring) return;
    setIsRestoring(true);
    try {
      const resp = await fetch(`${basePath}/api/rooms/${roomId}/files/${fileId}/snapshots/${snapshotId}/restore`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!resp.ok) throw new Error(`Ошибка ${resp.status}`);
      const data = await resp.json() as { content: string };
      onContentRestored?.(data.content);
      onFilesChanged?.();
      onClearAiDiff?.();
      setPreviewSnapshotId(null);
      await fetchSnapshots();
    } catch (err) {
      console.error("Restore error:", err);
    } finally {
      setIsRestoring(false);
    }
  }

  const TABS = [
    { id: "chat" as const, label: "Чат с AI" },
    { id: "review" as const, label: "Ревью" },
    { id: "history" as const, label: "История" },
  ];

  const previewSnapshot = previewSnapshotId ? snapshots.find((s) => s.id === previewSnapshotId) : null;

  return (
    <div className="flex flex-col h-full" style={{ background: "#1C2128" }}>
      {/* Tabs */}
      <div className="flex items-center" style={{ borderBottom: "1px solid #30363D", flexShrink: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className="px-3 py-2 text-xs font-medium transition-colors relative"
            style={{
              color: activeTab === tab.id ? "#E6EDF3" : "#8B949E",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-ai-${tab.id}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="ai-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: "#58A6FF" }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "review" ? (
          <motion.div
            key="review"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full overflow-hidden"
          >
            <div className="p-3 flex items-center gap-2" style={{ borderBottom: "1px solid #30363D", flexShrink: 0 }}>
              <span className="text-xs" style={{ color: "#8B949E" }}>{fileName || "Файл не выбран"}</span>
              <Button
                size="sm"
                onClick={() => { void runReview(); }}
                disabled={!fileContent || isReviewing}
                style={{ marginLeft: "auto", background: "#58A6FF", color: "#0D1117", fontWeight: 600, fontSize: 11 }}
                data-testid="btn-run-review"
              >
                {isReviewing ? "Анализ..." : "Запустить ревью"}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isReviewing && (
                <div className="flex items-center gap-2 p-3 text-xs" style={{ color: "#8B949E" }}>
                  <TypingDots />
                  <span>Анализирую код...</span>
                </div>
              )}

              {!isReviewing && reviewError && (
                <div className="p-3 rounded mx-2 mt-2 text-xs" style={{ background: "rgba(255,123,114,0.1)", border: "1px solid rgba(255,123,114,0.3)", color: "#FF7B72" }}>
                  {reviewError}
                </div>
              )}

              {!isReviewing && !reviewError && issues.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs" style={{ color: "#8B949E" }}>
                    {hasReviewed
                      ? "Проблем не обнаружено — код выглядит хорошо!"
                      : fileContent
                      ? "Нажмите «Запустить ревью»"
                      : "Откройте файл для ревью"}
                  </p>
                </div>
              )}

              {!isReviewing && issues.length > 0 && (
                <div className="flex flex-col gap-2">
                  <AnimatePresence>
                    {issues.map((issue, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-2.5 rounded"
                        style={{ background: "#0D1117", border: "1px solid #30363D" }}
                        data-testid={`issue-${i}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge severity={issue.severity} />
                          {issue.line && (
                            <span className="text-xs font-mono" style={{ color: "#8B949E" }}>Строка {issue.line}</span>
                          )}
                        </div>
                        <p className="text-xs mb-1" style={{ color: "#E6EDF3" }}>{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-xs" style={{ color: "#8B949E" }}>{issue.suggestion}</p>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        ) : activeTab === "chat" ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {messages.length === 0 && toolCalls.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm font-medium mb-1" style={{ color: "#E6EDF3" }}>CodeSync AI</p>
                  <p className="text-xs" style={{ color: "#8B949E" }}>Задайте вопрос по коду или попросите создать/изменить файл</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div
                        className="w-5 h-5 rounded mr-2 mt-0.5 flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ background: "linear-gradient(135deg, #58A6FF, #3FB950)", color: "#0D1117", fontSize: 8 }}
                      >
                        AI
                      </div>
                    )}
                    <div
                      className="max-w-[85%] rounded-lg px-3 py-2 text-xs ai-prose"
                      style={{
                        background: msg.role === "user" ? "rgba(88,166,255,0.15)" : "#0D1117",
                        border: `1px solid ${msg.role === "user" ? "rgba(88,166,255,0.3)" : "#30363D"}`,
                        color: "#E6EDF3",
                        lineHeight: 1.6,
                      }}
                    >
                      <SafeMarkdown text={msg.content} />
                    </div>
                  </div>
                </div>
              ))}

              {toolCalls.map((tc, i) => (
                <ToolCallBadge key={`tc-${i}`} toolCall={tc} />
              ))}

              {isChatLoading && (
                <div className="flex justify-start">
                  <div
                    className="w-5 h-5 rounded mr-2 mt-0.5 flex-shrink-0 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #58A6FF, #3FB950)", fontSize: 8, fontWeight: 700, color: "#0D1117" }}
                  >
                    AI
                  </div>
                  <div className="px-3 py-2 rounded-lg" style={{ background: "#0D1117", border: "1px solid #30363D" }}>
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-2 flex gap-2" style={{ borderTop: "1px solid #30363D", flexShrink: 0 }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
                placeholder="Спросите что угодно или попросите создать файл..."
                rows={2}
                className="flex-1 resize-none text-xs rounded px-2 py-1.5 outline-none"
                style={{
                  background: "#0D1117",
                  border: "1px solid #30363D",
                  color: "#E6EDF3",
                  fontFamily: "Inter, sans-serif",
                }}
                data-testid="input-chat"
              />
              <Button
                size="sm"
                onClick={() => { void sendChat(); }}
                disabled={!chatInput.trim() || isChatLoading}
                style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600, alignSelf: "center", fontSize: 11 }}
                data-testid="btn-send-chat"
              >
                Отправить
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* History header */}
            <div className="p-3 flex items-center gap-2" style={{ borderBottom: "1px solid #30363D", flexShrink: 0 }}>
              <Clock size={13} style={{ color: "#8B949E" }} />
              <span className="text-xs" style={{ color: "#8B949E" }}>{fileName || "Файл не выбран"}</span>
              <Button
                size="sm"
                onClick={() => { void fetchSnapshots(); }}
                disabled={isLoadingHistory || !fileId}
                style={{ marginLeft: "auto", background: "#21262D", color: "#8B949E", fontWeight: 600, fontSize: 11, border: "1px solid #30363D" }}
              >
                ↻
              </Button>
            </div>

            {/* Preview banner */}
            {previewSnapshot && (
              <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(88,166,255,0.08)", borderBottom: "1px solid rgba(88,166,255,0.2)", flexShrink: 0 }}>
                <span className="text-xs flex-1" style={{ color: "#58A6FF" }}>
                  Просмотр: {previewSnapshot.authorName} · {relativeTime(previewSnapshot.createdAt)}
                </span>
                <button
                  className="text-xs"
                  style={{ color: "#8B949E", background: "none", border: "none", cursor: "pointer" }}
                  onClick={() => {
                    setPreviewSnapshotId(null);
                    onClearAiDiff?.();
                  }}
                >
                  ✕
                </button>
                <Button
                  size="sm"
                  onClick={() => { void restoreSnapshot(previewSnapshot.id); }}
                  disabled={isRestoring}
                  style={{ background: "#3FB950", color: "#0D1117", fontWeight: 600, fontSize: 11 }}
                >
                  {isRestoring ? "..." : "Восстановить"}
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {isLoadingHistory && (
                <div className="flex items-center justify-center py-8 text-xs" style={{ color: "#8B949E" }}>
                  <TypingDots />
                </div>
              )}

              {!isLoadingHistory && historyError && (
                <div className="p-3 m-2 rounded text-xs" style={{ background: "rgba(255,123,114,0.1)", border: "1px solid rgba(255,123,114,0.3)", color: "#FF7B72" }}>
                  {historyError}
                </div>
              )}

              {!isLoadingHistory && !historyError && !fileId && (
                <div className="text-center py-8">
                  <p className="text-xs" style={{ color: "#8B949E" }}>Выберите файл для просмотра истории</p>
                </div>
              )}

              {!isLoadingHistory && !historyError && fileId && snapshots.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs" style={{ color: "#8B949E" }}>История изменений пуста</p>
                  <p className="text-xs mt-1" style={{ color: "#30363D" }}>Снимки сохраняются при каждом изменении файла</p>
                </div>
              )}

              {!isLoadingHistory && snapshots.length > 0 && (
                <div className="p-2 flex flex-col gap-1.5">
                  {snapshots.map((snapshot, i) => {
                    const isActive = previewSnapshotId === snapshot.id;
                    const isAI = snapshot.authorName.startsWith("AI");
                    return (
                      <motion.div
                        key={snapshot.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded p-2"
                        style={{
                          background: isActive ? "rgba(88,166,255,0.08)" : "#0D1117",
                          border: `1px solid ${isActive ? "rgba(88,166,255,0.4)" : "#30363D"}`,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          if (isActive) {
                            setPreviewSnapshotId(null);
                            onClearAiDiff?.();
                          } else {
                            setPreviewSnapshotId(snapshot.id);
                            onShowAiDiff?.(snapshot.content, fileContent);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{
                              background: isAI ? "linear-gradient(135deg, #58A6FF, #3FB950)" : "#30363D",
                              color: isAI ? "#0D1117" : "#8B949E",
                              fontSize: 7,
                            }}
                          >
                            {isAI ? "AI" : snapshot.authorName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 justify-between">
                              <span className="text-xs font-medium truncate" style={{ color: "#E6EDF3" }}>
                                {snapshot.authorName}
                              </span>
                              <span className="text-xs flex-shrink-0" style={{ color: "#8B949E" }}>
                                {relativeTime(snapshot.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs truncate mt-0.5" style={{ color: "#8B949E", fontFamily: "JetBrains Mono, monospace" }}>
                              {snapshot.content.slice(0, 60).replace(/\n/g, " ↵ ")}…
                            </p>
                          </div>
                          <ChevronDown
                            size={12}
                            style={{ color: "#8B949E", flexShrink: 0, transform: isActive ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                          />
                        </div>

                        {isActive && (
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <pre
                              className="text-xs rounded p-2 overflow-x-auto"
                              style={{
                                background: "#0D1117",
                                border: "1px solid #30363D",
                                color: "#8B949E",
                                fontFamily: "JetBrains Mono, monospace",
                                maxHeight: 200,
                                overflowY: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                              }}
                            >
                              {snapshot.content.slice(0, 500)}{snapshot.content.length > 500 ? "…" : ""}
                            </pre>
                            <Button
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => { void restoreSnapshot(snapshot.id); }}
                              disabled={isRestoring}
                              style={{ background: "#3FB950", color: "#0D1117", fontWeight: 600, fontSize: 11 }}
                            >
                              <RotateCcw size={11} className="mr-1" />
                              {isRestoring ? "Восстановление..." : "Восстановить эту версию"}
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
