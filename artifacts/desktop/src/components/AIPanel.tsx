import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Copy, Check, Play, Sparkles, RotateCcw, Square } from "lucide-react";
import { api } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Props {
  roomId?: string;
  fileId?: string;
  language?: string;
  code?: string;
  onApply?: (code: string) => void;
}

const QUICK_PROMPTS = [
  { label: "Объясни код", icon: "📖" },
  { label: "Найди ошибки", icon: "🔍" },
  { label: "Добавь типы", icon: "🏷️" },
  { label: "Напиши тесты", icon: "🧪" },
  { label: "Оптимизируй", icon: "⚡" },
  { label: "Добавь комментарии", icon: "💬" },
];

export function AIPanel({ roomId, fileId, language, code, onApply }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"chat" | "review">("chat");
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<{
    issues: { line?: number; severity: string; message: string; suggestion?: string }[];
    summary: string;
    suggestions: string[];
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  async function sendMessage(userMsg?: string) {
    const msg = (userMsg ?? input).trim();
    if (!msg || streaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    abortRef.current = new AbortController();

    try {
      await api.aiChat(
        { message: msg, roomId, fileId, codeContext: code, history },
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk } : m)
          );
        },
        abortRef.current.signal
      );
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Произошла ошибка. Попробуйте снова." } : m
          )
        );
      }
    } finally {
      setStreaming(false);
    }
  }

  async function runReview() {
    if (!code || !language || reviewing) return;
    setReviewing(true);
    try {
      const result = await api.aiReview({ code, language, roomId, fileId });
      setReviewResult(result);
    } catch {
      setReviewResult(null);
    } finally {
      setReviewing(false);
    }
  }

  function copyMessage(id: string, content: string) {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  }

  function renderContent(content: string) {
    const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
    return parts.map((part, i) => {
      const codeMatch = part.match(/```([\w]*)\n([\s\S]*?)```/);
      if (codeMatch) {
        const [, lang, snippet] = codeMatch;
        return (
          <div
            key={i}
            className="my-2 rounded-xl overflow-hidden"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div
              className="flex items-center justify-between px-3 py-1.5 border-b"
              style={{ borderColor: "var(--border)", background: "var(--elevated)" }}
            >
              <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
                {lang || "код"}
              </span>
              <div className="flex items-center gap-1">
                {onApply && (
                  <button
                    onClick={() => onApply(snippet)}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-opacity hover:opacity-80"
                    style={{ background: "var(--primary)", color: "#fff" }}
                  >
                    <Play size={8} /> Применить
                  </button>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(snippet)}
                  className="p-1 rounded-md transition-opacity hover:opacity-70"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Copy size={10} />
                </button>
              </div>
            </div>
            <pre
              className="p-3 text-xs overflow-x-auto leading-relaxed"
              style={{ color: "#A9B1D6", fontFamily: "'Geist Mono', monospace" }}
            >
              <code>{snippet}</code>
            </pre>
          </div>
        );
      }
      if (part.trim()) {
        return (
          <p key={i} className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
            {part}
          </p>
        );
      }
      return null;
    });
  }

  const severityColor = (s: string) =>
    s === "error" ? "#EF4444" : s === "warning" ? "#F59E0B" : "var(--primary)";
  const severityLabel = (s: string) =>
    s === "error" ? "ошибка" : s === "warning" ? "предупреждение" : "инфо";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7C6FF7, #9B8FFB)" }}
          >
            <Sparkles size={10} color="#fff" />
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            ИИ-помощник
          </span>
        </div>
        <div
          className="flex gap-0.5 p-0.5 rounded-lg"
          style={{ background: "var(--elevated)" }}
        >
          {(["chat", "review"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
              style={{
                background: mode === m ? "var(--primary)" : "transparent",
                color: mode === m ? "#fff" : "var(--muted-foreground)",
                boxShadow: mode === m ? "0 1px 4px rgba(124,111,247,0.3)" : "none",
              }}
            >
              {m === "chat" ? "Чат" : "Проверка"}
            </button>
          ))}
        </div>
      </div>

      {mode === "chat" ? (
        <>
          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-6">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(124,111,247,0.12), rgba(124,111,247,0.06))",
                    border: "1px solid rgba(124,111,247,0.2)",
                  }}
                >
                  <Bot size={20} style={{ color: "var(--primary)" }} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>
                    Задайте вопрос о коде
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    или выберите быстрое действие:
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 w-full">
                  {QUICK_PROMPTS.map(({ label, icon }) => (
                    <button
                      key={label}
                      onClick={() => sendMessage(label)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-xl text-left transition-all hover:opacity-80 active:scale-95"
                      style={{
                        background: "var(--elevated)",
                        color: "var(--foreground)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span>{icon}</span>
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: msg.role === "assistant"
                        ? "linear-gradient(135deg, #7C6FF7, #9B8FFB)"
                        : "var(--elevated-2)",
                      border: msg.role === "user" ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {msg.role === "assistant"
                      ? <Bot size={11} color="#fff" />
                      : <User size={11} style={{ color: "var(--foreground)" }} />
                    }
                  </div>
                  <div
                    className="flex-1 rounded-xl px-3 py-2.5 group relative max-w-[85%]"
                    style={{
                      background: msg.role === "user"
                        ? "rgba(124,111,247,0.1)"
                        : "var(--elevated)",
                      border: `1px solid ${msg.role === "user" ? "rgba(124,111,247,0.2)" : "var(--border)"}`,
                    }}
                  >
                    {msg.content ? (
                      <>
                        {renderContent(msg.content)}
                        <button
                          onClick={() => copyMessage(msg.id, msg.content)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all"
                          style={{ color: "var(--muted-foreground)", background: "var(--elevated-2)" }}
                        >
                          {copiedId === msg.id
                            ? <Check size={10} style={{ color: "var(--primary)" }} />
                            : <Copy size={10} />
                          }
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 py-0.5">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Input bar */}
          <div
            className="p-2.5 border-t shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="flex items-center gap-1.5 text-xs mb-2 px-1 hover:opacity-70 transition-opacity"
                style={{ color: "var(--muted-foreground)" }}
              >
                <RotateCcw size={9} /> Очистить чат
              </button>
            )}
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{
                background: "var(--elevated)",
                border: "1px solid var(--border)",
                transition: "border-color 0.15s ease",
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Спросить ИИ..."
                rows={1}
                className="flex-1 bg-transparent outline-none resize-none text-xs leading-relaxed"
                style={{ color: "var(--foreground)", maxHeight: "100px" }}
              />
              <button
                onClick={() => streaming ? abortRef.current?.abort() : sendMessage()}
                disabled={!streaming && !input.trim()}
                className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0 transition-all disabled:opacity-40"
                style={{
                  background: streaming ? "rgba(124,111,247,0.15)" : "var(--primary)",
                  color: streaming ? "var(--primary)" : "#fff",
                  boxShadow: !streaming && input.trim() ? "0 2px 8px rgba(124,111,247,0.3)" : "none",
                }}
              >
                {streaming ? <Square size={9} /> : <Send size={10} />}
              </button>
            </div>
            <p className="text-xs mt-1.5 px-1" style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
              Enter — отправить · Shift+Enter — новая строка
            </p>
          </div>
        </>
      ) : (
        /* Review mode */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <button
            onClick={runReview}
            disabled={!code || reviewing}
            className="primary-btn w-full py-2.5 text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {reviewing ? (
              <>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                Анализирую...
              </>
            ) : (
              <><Sparkles size={12} /> Проверить код</>
            )}
          </button>

          {reviewResult && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Summary */}
              <div
                className="rounded-xl p-3"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--foreground)" }}>Итог</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {reviewResult.summary}
                </p>
              </div>

              {/* Issues */}
              {reviewResult.issues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                    Проблемы ({reviewResult.issues.length})
                  </p>
                  {reviewResult.issues.map((issue, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3"
                      style={{ background: "var(--elevated)", border: `1px solid ${severityColor(issue.severity)}30` }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                          style={{
                            background: `${severityColor(issue.severity)}18`,
                            color: severityColor(issue.severity),
                          }}
                        >
                          {severityLabel(issue.severity)}
                        </span>
                        {issue.line && (
                          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            строка {issue.line}
                          </span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: "var(--foreground)" }}>{issue.message}</p>
                      {issue.suggestion && (
                        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                          → {issue.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {reviewResult.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>Предложения</p>
                  {reviewResult.suggestions.map((s, i) => (
                    <div key={i} className="flex gap-2 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                      <span style={{ color: "var(--primary)", flexShrink: 0 }}>→</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
