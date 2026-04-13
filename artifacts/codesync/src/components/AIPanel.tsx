import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Clock, ChevronDown } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Issue {
  line?: number | null;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
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

interface FileEntry {
  id: string;
  name: string;
  language: string;
  content: string;
}

interface Props {
  roomId: string;
  fileId: string | null;
  fileContent: string;
  language: string;
  fileName: string;
  files?: FileEntry[];
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

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  return `${Math.floor(diff / 86400)} дн. назад`;
}

export function AIPanel({ roomId, fileId, fileContent, language, fileName, files = [], onContentRestored, onShowAiDiff, onClearAiDiff }: Props) {
  const [activeTab, setActiveTab] = useState<"review" | "history">("review");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewScope, setReviewScope] = useState<"current" | "all">("all");

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [previewSnapshotId, setPreviewSnapshotId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const prevFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (fileId !== prevFileIdRef.current) {
      prevFileIdRef.current = fileId;
      setPreviewSnapshotId(null);
      setSnapshots([]);
      setHistoryError(null);
      onClearAiDiff?.();
    }
  }, [fileId, onClearAiDiff]);

  function getHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const guestToken = localStorage.getItem("codesync_guest_token");
    if (guestToken) h["x-guest-token"] = guestToken;
    return h;
  }

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
    if (activeTab === "history" && fileId) void fetchSnapshots();
  }, [activeTab, fileId, fetchSnapshots]);

  async function runReview() {
    const isGlobal = reviewScope === "all" && files.length > 0;
    const hasContent = isGlobal ? files.some((f) => f.content?.trim()) : !!fileContent;
    if (!hasContent || isReviewing) return;

    setIsReviewing(true);
    setIssues([]);
    setReviewError(null);
    setHasReviewed(false);

    try {
      let body: Record<string, unknown>;

      if (isGlobal) {
        const allCode = files
          .filter((f) => !["image"].includes(f.language) && f.content)
          .map((f) => `=== ${f.name} (${f.language}) ===\n${f.content}`)
          .join("\n\n");
        body = { code: allCode, language: "mixed", roomId, globalReview: true };
      } else {
        body = { code: fileContent, language, roomId, fileId };
      }

      const resp = await fetch(`${basePath}/api/ai/review`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
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
            if (parsed.error) setReviewError(parsed.error);
            else if (Array.isArray(parsed.issues)) setIssues(parsed.issues as Issue[]);
          } catch (_) {}
        }
      }
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Ошибка ревью.");
    } finally {
      setIsReviewing(false);
      setHasReviewed(true);
    }
  }

  async function restoreSnapshot(snapshotId: string) {
    if (!fileId || isRestoring) return;
    setIsRestoring(true);
    try {
      const resp = await fetch(`${basePath}/api/rooms/${roomId}/files/${fileId}/snapshots/${snapshotId}/restore`, {
        method: "POST", headers: getHeaders(),
      });
      if (!resp.ok) throw new Error(`Ошибка ${resp.status}`);
      const data = await resp.json() as { content: string };
      onContentRestored?.(data.content);
      onClearAiDiff?.();
      setPreviewSnapshotId(null);
      await fetchSnapshots();
    } catch (err) {
      console.error("Restore error:", err);
    } finally {
      setIsRestoring(false);
    }
  }

  const previewSnapshot = previewSnapshotId ? snapshots.find((s) => s.id === previewSnapshotId) : null;

  const TABS = [
    { id: "review" as const, label: "Ревью" },
    { id: "history" as const, label: "История" },
  ];

  const nonFolderFiles = files.filter((f) => !["image"].includes(f.language));

  return (
    <div className="flex flex-col h-full" style={{ background: "#0e0e0e", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div className="px-3 py-2">
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>
            Инструменты
          </span>
        </div>
        <div className="flex" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 text-xs font-medium relative transition-colors"
              style={{
                color: activeTab === tab.id ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="panel-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: "rgba(255,255,255,0.4)" }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "review" ? (
          <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col h-full overflow-hidden">
            {/* Action bar */}
            <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              {/* Scope toggle */}
              <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: 2, gap: 1 }}>
                {(["all", "current"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setReviewScope(s)}
                    style={{
                      padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 500,
                      background: reviewScope === s ? "rgba(255,255,255,0.1)" : "transparent",
                      color: reviewScope === s ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)",
                      border: "none", cursor: "pointer", transition: "all 0.12s",
                    }}
                  >
                    {s === "all" ? `Все (${nonFolderFiles.length})` : "Текущий"}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { void runReview(); }}
                disabled={(reviewScope === "current" && !fileContent) || isReviewing}
                className="ml-auto text-xs px-3 py-1 rounded-lg font-medium transition-all"
                style={{
                  background: isReviewing ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                  color: isReviewing ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: isReviewing ? "default" : "pointer", flexShrink: 0,
                }}
                data-testid="btn-run-review"
              >
                {isReviewing ? "Анализ..." : "Запустить"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isReviewing && (
                <div className="flex items-center gap-2 p-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <TypingDots />
                  <span>Анализирую код...</span>
                </div>
              )}
              {!isReviewing && reviewError && (
                <div className="p-3 rounded mx-1 mt-2 text-xs" style={{ background: "rgba(255,123,114,0.08)", border: "1px solid rgba(255,123,114,0.2)", color: "#FF7B72" }}>
                  {reviewError}
                </div>
              )}
              {!isReviewing && !reviewError && issues.length === 0 && (
                <div className="text-center py-8 px-3">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {hasReviewed ? "✓ Проблем не обнаружено" : "Нажмите «Запустить» для анализа кода"}
                  </p>
                </div>
              )}
              {!isReviewing && issues.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <AnimatePresence>
                    {issues.map((issue, i) => (
                      <motion.div
                        key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="p-2.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                        data-testid={`issue-${i}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <SeverityBadge severity={issue.severity} />
                          {issue.line && (
                            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                              Строка {issue.line}
                            </span>
                          )}
                        </div>
                        <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{issue.suggestion}</p>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              <Clock size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
              <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{fileName || "Файл не выбран"}</span>
              <button
                onClick={() => { void fetchSnapshots(); }}
                disabled={isLoadingHistory || !fileId}
                style={{ marginLeft: "auto", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "3px 8px", fontSize: 11, cursor: isLoadingHistory || !fileId ? "default" : "pointer", flexShrink: 0 }}
              >
                ↻
              </button>
            </div>

            {previewSnapshot && (
              <div className="px-3 py-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
                <span className="text-xs flex-1 truncate" style={{ color: "rgba(255,255,255,0.5)" }}>Просмотр: {previewSnapshot.authorName}</span>
                <button style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}
                  onClick={() => { setPreviewSnapshotId(null); onClearAiDiff?.(); }}>✕</button>
                <button
                  onClick={() => { void restoreSnapshot(previewSnapshot.id); }}
                  disabled={isRestoring}
                  style={{ background: "rgba(63,185,80,0.15)", color: "#3FB950", border: "1px solid rgba(63,185,80,0.3)", cursor: isRestoring ? "default" : "pointer", padding: "3px 10px", borderRadius: 7, fontSize: 11, flexShrink: 0 }}
                >
                  {isRestoring ? "..." : "Вернуть"}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {isLoadingHistory && (
                <div className="flex items-center justify-center py-8 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <TypingDots />
                </div>
              )}
              {!isLoadingHistory && historyError && (
                <div className="p-3 m-2 rounded-lg text-xs" style={{ background: "rgba(255,123,114,0.08)", border: "1px solid rgba(255,123,114,0.2)", color: "#FF7B72" }}>
                  {historyError}
                </div>
              )}
              {!isLoadingHistory && !historyError && !fileId && (
                <div className="text-center py-8 px-3">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Выберите файл</p>
                </div>
              )}
              {!isLoadingHistory && !historyError && fileId && snapshots.length === 0 && (
                <div className="text-center py-8 px-3">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>История пуста</p>
                </div>
              )}
              {!isLoadingHistory && snapshots.length > 0 && (
                <div className="p-2 flex flex-col gap-1">
                  {snapshots.map((snapshot, i) => {
                    const isActive = previewSnapshotId === snapshot.id;
                    const isAI = snapshot.authorName.startsWith("AI");
                    return (
                      <motion.div
                        key={snapshot.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-lg px-2 py-1.5"
                        style={{
                          background: isActive ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          if (isActive) { setPreviewSnapshotId(null); onClearAiDiff?.(); }
                          else { setPreviewSnapshotId(snapshot.id); onShowAiDiff?.(snapshot.content, fileContent); }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{
                              background: isAI ? "linear-gradient(135deg, #58A6FF, #3FB950)" : "rgba(255,255,255,0.08)",
                              color: isAI ? "#0D1117" : "rgba(255,255,255,0.5)",
                              fontSize: 8,
                            }}
                          >
                            {isAI ? "AI" : snapshot.authorName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 justify-between">
                              <span className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{snapshot.authorName}</span>
                              <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>{relativeTime(snapshot.createdAt)}</span>
                            </div>
                            <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "JetBrains Mono, monospace" }}>
                              {snapshot.content.slice(0, 50).replace(/\n/g, " ")}
                            </p>
                          </div>
                          <ChevronDown size={11} style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0, transform: isActive ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                        </div>
                        {isActive && (
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <pre className="text-xs rounded-md p-2 overflow-x-auto"
                              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", fontFamily: "JetBrains Mono, monospace", maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                              {snapshot.content.slice(0, 400)}{snapshot.content.length > 400 ? "…" : ""}
                            </pre>
                            <button
                              className="w-full mt-2 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                              onClick={() => { void restoreSnapshot(snapshot.id); }}
                              disabled={isRestoring}
                              style={{ background: "rgba(63,185,80,0.1)", color: "#3FB950", border: "1px solid rgba(63,185,80,0.25)", cursor: isRestoring ? "default" : "pointer" }}
                            >
                              <RotateCcw size={10} />
                              {isRestoring ? "Восстановление..." : "Восстановить"}
                            </button>
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
