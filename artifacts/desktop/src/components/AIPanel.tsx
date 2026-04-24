import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Copy, Check, Play, Sparkles, RotateCcw } from "lucide-react";
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
  "Объясни код",
  "Найди ошибки",
  "Добавь типы",
  "Напиши тесты",
  "Оптимизируй",
  "Добавь комментарии",
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

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    abortRef.current = new AbortController();

    try {
      await api.aiChat(
        { message: msg, roomId, fileId, codeContext: code, history },
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
          );
        },
        abortRef.current.signal
      );
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Произошла ошибка. Попробуйте снова." }
              : m
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

  function renderContent(content: string) {
    const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
    return parts.map((part, i) => {
      const codeMatch = part.match(/```([\w]*)\n([\s\S]*?)```/);
      if (codeMatch) {
        const [, lang, codeSnippet] = codeMatch;
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{lang || "код"}</span>
              <div className="flex items-center gap-1">
                {onApply && (
                  <button
                    onClick={() => onApply(codeSnippet)}
                    className="text-xs px-2 py-0.5 rounded flex items-center gap-1 hover:opacity-80"
                    style={{ background: "var(--primary)", color: "#fff" }}
                  >
                    <Play size={9} /> Применить
                  </button>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(codeSnippet)}
                  className="p-1 rounded hover:opacity-70"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Copy size={10} />
                </button>
              </div>
            </div>
            <pre className="p-3 text-xs overflow-x-auto font-mono leading-relaxed" style={{ color: "#A9B1D6" }}>
              <code>{codeSnippet}</code>
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
    s === "error" ? "#EF4444" : s === "warning" ? "#F59E0B" : "#7C6FF7";

  const severityLabel = (s: string) =>
    s === "error" ? "ошибка" : s === "warning" ? "предупреждение" : "инфо";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "var(--primary)" }}>
            <Sparkles size={10} color="#fff" />
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>ИИ-помощник</span>
        </div>
        <div className="flex gap-0.5 p-0.5 rounded-md" style={{ background: "var(--elevated)" }}>
          <button
            onClick={() => setMode("chat")}
            className="px-2 py-0.5 rounded text-xs transition-all"
            style={{
              background: mode === "chat" ? "var(--primary)" : "transparent",
              color: mode === "chat" ? "#fff" : "var(--muted-foreground)",
            }}
          >
            Чат
          </button>
          <button
            onClick={() => setMode("review")}
            className="px-2 py-0.5 rounded text-xs transition-all"
            style={{
              background: mode === "review" ? "var(--primary)" : "transparent",
              color: mode === "review" ? "#fff" : "var(--muted-foreground)",
            }}
          >
            Проверка
          </button>
        </div>
      </div>

      {mode === "chat" ? (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,111,247,0.1)", border: "1px solid rgba(124,111,247,0.2)" }}>
                  <Bot size={18} style={{ color: "var(--primary)" }} />
                </div>
                <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
                  Задайте вопрос о коде
                </p>
                <div className="grid grid-cols-2 gap-1.5 w-full">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-xs px-2 py-1.5 rounded-lg text-left transition-all hover:opacity-80"
                      style={{ background: "var(--elevated)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: msg.role === "assistant" ? "var(--primary)" : "var(--elevated)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {msg.role === "assistant" ? (
                      <Bot size={10} color="#fff" />
                    ) : (
                      <User size={10} style={{ color: "var(--foreground)" }} />
                    )}
                  </div>
                  <div
                    className="flex-1 rounded-xl px-3 py-2 group relative max-w-[85%]"
                    style={{
                      background: msg.role === "user" ? "rgba(124,111,247,0.12)" : "var(--elevated)",
                      border: `1px solid ${msg.role === "user" ? "rgba(124,111,247,0.2)" : "var(--border)"}`,
                    }}
                  >
                    {msg.content ? (
                      <>
                        {renderContent(msg.content)}
                        <button
                          onClick={() => copyMessage(msg.id, msg.content)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {copiedId === msg.id ? <Check size={10} style={{ color: "var(--primary)" }} /> : <Copy size={10} />}
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1 py-0.5">
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

          {/* Input */}
          <div className="p-2 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="flex items-center gap-1 text-xs mb-2 hover:opacity-70"
                style={{ color: "var(--muted-foreground)" }}
              >
                <RotateCcw size={10} /> Очистить чат
              </button>
            )}
            <div className="flex items-end gap-2 rounded-xl px-3 py-2" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Спросить ИИ..."
                rows={1}
                className="flex-1 bg-transparent outline-none resize-none text-xs leading-relaxed"
                style={{ color: "var(--foreground)", maxHeight: "80px" }}
              />
              <button
                onClick={() => streaming ? abortRef.current?.abort() : sendMessage()}
                className="flex items-center justify-center w-6 h-6 rounded-lg shrink-0 transition-all"
                style={{ background: streaming ? "rgba(124,111,247,0.2)" : "var(--primary)", color: streaming ? "var(--primary)" : "#fff" }}
              >
                <Send size={11} />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Review mode */
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <button
            onClick={runReview}
            disabled={!code || reviewing}
            className="w-full py-2 rounded-lg text-xs font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {reviewing ? (
              <>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => <span key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
                Анализирую...
              </>
            ) : (
              <><Sparkles size={12} /> Проверить код</>
            )}
          </button>

          {reviewResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="rounded-lg p-3" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "var(--foreground)" }}>Итог</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{reviewResult.summary}</p>
              </div>

              {reviewResult.issues.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>Проблемы ({reviewResult.issues.length})</p>
                  {reviewResult.issues.map((issue, i) => (
                    <div key={i} className="rounded-lg p-2.5" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs px-1.5 rounded font-medium"
                          style={{ background: `${severityColor(issue.severity)}20`, color: severityColor(issue.severity) }}>
                          {severityLabel(issue.severity)}
                        </span>
                        {issue.line && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>строка {issue.line}</span>}
                      </div>
                      <p className="text-xs" style={{ color: "var(--foreground)" }}>{issue.message}</p>
                      {issue.suggestion && (
                        <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>→ {issue.suggestion}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {reviewResult.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>Предложения</p>
                  {reviewResult.suggestions.map((s, i) => (
                    <div key={i} className="flex gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      <span style={{ color: "var(--primary)" }}>→</span>
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
