import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

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

interface Props {
  roomId: string;
  fileId: string | null;
  fileContent: string;
  language: string;
  fileName: string;
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

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
}

export function AIPanel({ roomId, fileId, fileContent, language, fileName }: Props) {
  const [activeTab, setActiveTab] = useState<"review" | "chat">("chat");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  async function runReview() {
    if (!fileContent || isReviewing) return;
    setIsReviewing(true);
    setIssues([]);
    setActiveTab("review");

    try {
      const resp = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fileContent, language, roomId, fileId }),
      });

      if (!resp.ok) throw new Error("Review failed");

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
            const parsed = JSON.parse(data);
            if (parsed.complete && parsed.issues) {
              setIssues(Array.isArray(parsed.issues) ? parsed.issues : []);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error("Review error:", err);
    } finally {
      setIsReviewing(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);

    const allMessages = [...messages, { role: "user" as const, content: userMsg }];

    try {
      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          roomId,
          fileId,
        }),
      });

      if (!resp.ok) throw new Error("Chat failed");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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
            const parsed = JSON.parse(data);
            if (parsed.content) {
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
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Произошла ошибка. Попробуйте ещё раз." };
        return updated;
      });
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#1C2128" }}>
      {/* Tabs */}
      <div className="flex items-center" style={{ borderBottom: "1px solid #30363D", flexShrink: 0 }}>
        {(["review", "chat"] as const).map((tab) => (
          <button
            key={tab}
            className="px-4 py-2 text-xs font-medium transition-colors relative"
            style={{
              color: activeTab === tab ? "#E6EDF3" : "#8B949E",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => setActiveTab(tab)}
            data-testid={`tab-ai-${tab}`}
          >
            {tab === "review" ? "Ревью кода" : "Чат с AI"}
            {activeTab === tab && (
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
                onClick={runReview}
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

              {!isReviewing && issues.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs" style={{ color: "#8B949E" }}>
                    {fileContent ? "Нажмите «Запустить ревью»" : "Откройте файл для ревью"}
                  </p>
                </div>
              )}

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
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm font-medium mb-1" style={{ color: "#E6EDF3" }}>CodeSync AI</p>
                  <p className="text-xs" style={{ color: "#8B949E" }}>Задайте вопрос по коду или просто поговорите</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                </div>
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
                    sendChat();
                  }
                }}
                placeholder="Спросите что угодно..."
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
                onClick={sendChat}
                disabled={!chatInput.trim() || isChatLoading}
                style={{ background: "#58A6FF", color: "#0D1117", fontWeight: 600, alignSelf: "flex-end", fontSize: 11 }}
                data-testid="btn-send-chat"
              >
                Отправить
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
