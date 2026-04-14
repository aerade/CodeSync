import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactDOM from "react-dom";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const MIN_W = 340;
const MIN_H = 320;
const DEFAULT_W = 480;
const DEFAULT_H = 560;

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
  prefillInput?: string | null;
  onPrefillUsed?: () => void;
  onAiStats?: (stats: Record<string, { added: number; removed: number }>) => void;
}

function playDoneSound() {
  try {
    const settingsRaw = localStorage.getItem("codesync_room_settings");
    const s = settingsRaw ? JSON.parse(settingsRaw) as { soundEnabled?: boolean; soundType?: string } : {};
    if (s.soundEnabled === false) return;
    const type = s.soundType ?? "chime";

    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const vol = 0.15;

    if (type === "chime") {
      [880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.13);
        gain.gain.linearRampToValueAtTime(vol, now + i * 0.13 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.32);
        osc.start(now + i * 0.13); osc.stop(now + i * 0.13 + 0.32);
      });
    } else if (type === "pop") {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
      gain.gain.setValueAtTime(vol * 1.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === "bell") {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "triangle"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + i * 0.09);
        gain.gain.linearRampToValueAtTime(vol, now + i * 0.09 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.4);
        osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.4);
      });
    } else if (type === "soft") {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 660;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * 0.6, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
    setTimeout(() => ctx.close(), 1500);
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
  prefillInput, onPrefillUsed, onAiStats,
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
  const [planMode, setPlanMode] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string; mimeType: string } | null>(null);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [hoveredMsgIdx, setHoveredMsgIdx] = useState<number | null>(null);
  const fileAttachRef = useRef<HTMLInputElement>(null);

  // Panel position and size for drag/resize
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [panelSize, setPanelSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const posInitRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize panel position when first opened
  useEffect(() => {
    if (isOpen && !posInitRef.current) {
      posInitRef.current = true;
      setPanelPos({
        x: Math.max(8, (window.innerWidth - panelSize.w) / 2),
        y: Math.max(8, window.innerHeight - 76 - panelSize.h),
      });
    }
  }, [isOpen, panelSize.w, panelSize.h]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  useEffect(() => {
    if (isOpen && activeTab === "chat") setTimeout(() => inputRef.current?.focus(), 200);
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (prefillInput) {
      setChatInput(prefillInput);
      setIsOpen(true);
      setActiveTab("chat");
      onPrefillUsed?.();
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.selectionStart = inputRef.current.selectionEnd = inputRef.current.value.length;
        }
      }, 250);
    }
  }, [prefillInput]);

  function showFlash(text: string, ok: boolean) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashToast({ text, ok });
    flashTimerRef.current = setTimeout(() => setFlashToast(null), 2500);
  }

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    abortControllerRef.current?.abort();
  }, []);

  // Drag header handler
  const startDrag = useCallback((e: React.PointerEvent) => {
    if (isResizingRef.current) return;
    e.preventDefault();
    isDraggingRef.current = true;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = panelPos.x;
    const startY = panelPos.y;

    document.body.style.cursor = "move";
    document.body.style.userSelect = "none";

    function onMove(ev: PointerEvent) {
      if (!isDraggingRef.current) return;
      setPanelPos({
        x: Math.max(0, Math.min(window.innerWidth - MIN_W, startX + ev.clientX - startMouseX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, startY + ev.clientY - startMouseY)),
      });
    }
    function onUp() {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [panelPos]);

  // Resize SE corner handler
  function startResizeSE(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = panelSize.w;
    const startH = panelSize.h;

    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      if (!isResizingRef.current) return;
      setPanelSize({
        w: Math.max(MIN_W, Math.min(window.innerWidth - panelPos.x - 8, startW + ev.clientX - startX)),
        h: Math.max(MIN_H, Math.min(window.innerHeight - panelPos.y - 8, startH + ev.clientY - startY)),
      });
    }
    function onUp() {
      isResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function getHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const guestToken = localStorage.getItem("codesync_guest_token");
    if (guestToken) h["x-guest-token"] = guestToken;
    return h;
  }

  function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Файл слишком большой (макс. 5 МБ)");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string ?? "";
      setAttachedFile({ name: file.name, content, mimeType: file.type || "text/plain" });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function sendChat() {
    if (!chatInput.trim() || isChatLoading) return;
    let userMsg = chatInput.trim();
    const fileToSend = attachedFile;
    if (fileToSend) {
      userMsg = `[Файл: ${fileToSend.name}]\n\`\`\`\n${fileToSend.content.slice(0, 8000)}\n\`\`\`\n\n${userMsg}`;
      setAttachedFile(null);
    }
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);
    onClearAiDiff?.();

    // Cancel any previous request
    abortControllerRef.current?.abort();
    const abort = new AbortController();
    abortControllerRef.current = abort;

    const allMessages = [...messages, { role: "user" as const, content: userMsg }];
    const contentBeforeEdit = fileContent;

    try {
      const resp = await fetch(`${basePath}/api/ai/chat`, {
        method: "POST",
        headers: getHeaders(),
        signal: abort.signal,
        body: JSON.stringify({
          messages: allMessages,
          context: fileContent,
          language,
          roomId,
          fileId,
          usePlan: planMode,
          // Exclude image files (base64 is huge) and truncate content to keep payload small
          allFiles: files
            .filter((f) => f.language !== "image")
            .map((f) => ({
              id: f.id,
              name: f.name,
              language: f.language,
              content: (f.content ?? "").slice(0, 4000),
            })),
        }),
      });

      if (!resp.ok) {
        let errText = `Ошибка ${resp.status}`;
        try {
          const errData = await resp.json() as { error?: string };
          if (errData.error) errText = errData.error;
        } catch (_) {}
        throw new Error(errText);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";
      let addedAssistant = false;
      let editedFileId: string | null = null;
      let editedNewContent: string | null = null;
      let hadToolCalls = false;

      const opCounts = { create: 0, edit: 0, delete: 0, search: 0, download: 0 };
      const statsAcc: Record<string, { added: number; removed: number }> = {};

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
              onFilesChanged?.();

              if (tc.result?.success) {
                if (tc.name === "create_file") {
                  opCounts.create++;
                  const newContent = (tc.args.content as string | undefined) ?? "";
                  const lineCount = newContent.split("\n").length;
                  const fid = tc.result.fileId ?? tc.result.name ?? "new";
                  statsAcc[fid] = { added: lineCount, removed: 0 };
                } else if (tc.name === "edit_file") {
                  opCounts.edit++;
                  const editedId = (tc.args.fileId as string | undefined) ?? "";
                  const oldFile = files.find((f) => f.id === editedId);
                  const oldLines = (oldFile?.content ?? "").split("\n");
                  const newLines = ((tc.args.content as string | undefined) ?? "").split("\n");
                  let added = 0, removed = 0;
                  newLines.forEach((l, i) => { if (l !== oldLines[i]) added++; });
                  oldLines.forEach((l, i) => { if (l !== newLines[i]) removed++; });
                  if (editedId) statsAcc[editedId] = { added, removed };
                } else if (tc.name === "delete_file") {
                  opCounts.delete++;
                } else if (tc.name === "search_images") {
                  opCounts.search++;
                } else if (tc.name === "download_image") {
                  opCounts.download++;
                }
              } else if (tc.result && !tc.result.success) {
                showFlash(tc.result?.error ?? tc.name, false);
              }

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

      if (Object.keys(statsAcc).length > 0) onAiStats?.(statsAcc);

      if (editedFileId && editedNewContent !== null && fileId === editedFileId) {
        onContentRestored?.(editedNewContent);
        onShowAiDiff?.(contentBeforeEdit, editedNewContent);
      }

      if (!addedAssistant && !hadToolCalls) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Готово!" }]);
      }

      playDoneSound();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
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

  // Flash toast positioned via portal at panel's input area top
  const flashToastEl = flashToast
    ? ReactDOM.createPortal(
        <AnimatePresence>
          {flashToast && (
            <motion.div
              key="flash"
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              style={{
                position: "fixed",
                top: panelPos.y + panelSize.h - 72,
                left: panelPos.x + panelSize.w / 2,
                transform: "translateX(-50%)",
                background: flashToast.ok ? "rgba(22,38,22,0.97)" : "rgba(38,22,22,0.97)",
                border: `1px solid ${flashToast.ok ? "rgba(63,185,80,0.5)" : "rgba(255,123,114,0.5)"}`,
                color: flashToast.ok ? "#3FB950" : "#FF7B72",
                borderRadius: 10, padding: "6px 16px", fontSize: 12,
                whiteSpace: "nowrap", zIndex: 99999, backdropFilter: "blur(12px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                pointerEvents: "none",
              }}
            >
              {flashToast.ok ? "✓ " : "✗ "}{flashToast.text}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )
    : null;

  const panel = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ai-chat-panel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          style={{
            position: "fixed",
            top: panelPos.y,
            left: panelPos.x,
            width: panelSize.w,
            height: panelSize.h,
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
          {/* Top glow */}
          <div style={{
            position: "absolute", top: 0, left: "15%", right: "15%", height: 1,
            background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.5), rgba(63,185,80,0.35), transparent)",
            pointerEvents: "none",
          }} />

          {/* Header — draggable */}
          <div
            onPointerDown={startDrag}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
              cursor: "move",
              userSelect: "none",
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #1a1d29 0%, #0d1117 100%)",
              border: "1px solid rgba(88,166,255,0.35)",
              boxShadow: "0 0 14px rgba(88,166,255,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
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
                {isChatLoading ? "печатает..." : files.length > 0 ? `${files.length} файлов · перетащи панель` : "Глобальный контекст"}
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 2 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
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

            <div
              style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {activeTab === "chat" && messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.28)", fontSize: 11, padding: "2px 6px", borderRadius: 5 }}
                >
                  Очистить
                </button>
              )}
              {isChatLoading && (
                <button
                  onClick={() => { abortControllerRef.current?.abort(); setIsChatLoading(false); }}
                  title="Остановить генерацию"
                  style={{
                    height: 26, padding: "0 10px", borderRadius: 13,
                    background: "linear-gradient(90deg, rgba(255,123,114,0.18), rgba(255,100,90,0.1))",
                    border: "1px solid rgba(255,123,114,0.45)",
                    cursor: "pointer", color: "#FF7B72",
                    display: "flex", alignItems: "center", gap: 5,
                    flexShrink: 0, fontSize: 10, fontWeight: 600,
                    letterSpacing: "0.02em",
                    boxShadow: "0 0 8px rgba(255,123,114,0.15)",
                    animation: "stopPulse 1.8s ease-in-out infinite",
                  }}
                >
                  <span style={{
                    width: 7, height: 7, borderRadius: 2,
                    background: "#FF7B72",
                    display: "inline-block", flexShrink: 0,
                  }} />
                  Стоп
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
                  flexShrink: 0, padding: 0,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ textAlign: "center", paddingTop: 40 }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 16, margin: "0 auto 14px",
                      background: "linear-gradient(135deg, rgba(88,166,255,0.15), rgba(63,185,80,0.1))",
                      border: "1px solid rgba(88,166,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1L9.5 5.5L14 7L9.5 8.5L8 13L6.5 8.5L2 7L6.5 5.5L8 1Z" fill="url(#ai-star-empty)" />
                        <defs>
                          <linearGradient id="ai-star-empty" x1="2" y1="1" x2="14" y2="13">
                            <stop offset="0%" stopColor="#79C0FF"/>
                            <stop offset="100%" stopColor="#56D364"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>CodeSync AI</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
                      Задай вопрос по коду или попроси создать файл
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
                    <div
                      style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8, position: "relative" }}
                      onMouseEnter={() => setHoveredMsgIdx(i)}
                      onMouseLeave={() => setHoveredMsgIdx(null)}
                    >
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
                      <div style={{ maxWidth: "83%", display: "flex", flexDirection: "column", gap: 4, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                        <div
                          className="ai-prose"
                          style={{
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
                        {hoveredMsgIdx === i && (
                          <button
                            onClick={() => {
                              void navigator.clipboard.writeText(msg.content);
                              setCopiedMsgIdx(i);
                              setTimeout(() => setCopiedMsgIdx(null), 1500);
                            }}
                            style={{
                              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 6, padding: "2px 8px", fontSize: 10,
                              color: copiedMsgIdx === i ? "#3FB950" : "rgba(255,255,255,0.4)",
                              cursor: "pointer", transition: "all 0.12s",
                            }}
                          >
                            {copiedMsgIdx === i ? "✓ Скопировано" : "⎘ Копировать"}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {isChatLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 2,
                      background: "#0D1117", border: "1px solid rgba(88,166,255,0.4)",
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

              {/* Input area */}
              <div style={{ padding: "8px 12px 12px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <input
                  ref={fileAttachRef}
                  type="file"
                  accept="text/*,.json,.md,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.cpp,.c,.cs,.rb,.php,.sql,.sh"
                  style={{ display: "none" }}
                  onChange={handleAttachFile}
                />
                {/* Attached file chip */}
                {attachedFile && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                    padding: "4px 8px", borderRadius: 8,
                    background: "rgba(88,166,255,0.08)", border: "1px solid rgba(88,166,255,0.2)",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <span style={{ fontSize: 11, color: "#58A6FF", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachedFile.name}</span>
                    <button onClick={() => setAttachedFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                )}
                {/* Toolbar row */}
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  {/* Attach file button */}
                  <button
                    onClick={() => fileAttachRef.current?.click()}
                    title="Прикрепить файл для AI"
                    style={{
                      height: 28, padding: "0 8px", borderRadius: 8,
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer", color: "rgba(255,255,255,0.4)",
                      display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    <span>Файл</span>
                  </button>
                  {/* Plan mode toggle */}
                  <button
                    onClick={() => setPlanMode((p) => !p)}
                    title={planMode ? "Режим плана включён" : "Включить режим плана"}
                    style={{
                      height: 28, padding: "0 8px", borderRadius: 8,
                      background: planMode ? "rgba(210,168,255,0.12)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${planMode ? "rgba(210,168,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                      cursor: "pointer", color: planMode ? "#D2A8FF" : "rgba(255,255,255,0.4)",
                      display: "flex", alignItems: "center", gap: 4, fontSize: 11,
                      transition: "all 0.15s",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"/>
                      <line x1="8" y1="12" x2="21" y2="12"/>
                      <line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/>
                      <line x1="3" y1="12" x2="3.01" y2="12"/>
                      <line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                    <span>План</span>
                    {planMode && (
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#D2A8FF", display: "inline-block" }} />
                    )}
                  </button>
                </div>
                <div style={{
                  display: "flex", gap: 8,
                  background: isChatLoading ? "rgba(88,166,255,0.04)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isChatLoading ? "rgba(88,166,255,0.2)" : "rgba(255,255,255,0.09)"}`,
                  borderRadius: 12, padding: "8px 10px",
                  transition: "border-color 0.3s, background 0.3s",
                  boxShadow: isChatLoading ? "0 0 0 1px rgba(88,166,255,0.1)" : "none",
                }}>
                  <textarea
                    ref={inputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isChatLoading ? "AI пишет..." : planMode ? "Описать задачу для плана..." : "Спросить AI..."}
                    rows={1}
                    style={{
                      flex: 1, background: "transparent", border: "none", outline: "none",
                      color: isChatLoading ? "rgba(255,255,255,0.3)" : "#E6EDF3",
                      fontSize: 13, fontFamily: "Inter, sans-serif",
                      resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
                    }}
                    disabled={isChatLoading}
                  />
                  <motion.button
                    onClick={() => void sendChat()}
                    disabled={!chatInput.trim() || isChatLoading}
                    whileHover={chatInput.trim() && !isChatLoading ? { scale: 1.08 } : {}}
                    whileTap={chatInput.trim() && !isChatLoading ? { scale: 0.92 } : {}}
                    style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: chatInput.trim() && !isChatLoading
                        ? planMode ? "linear-gradient(135deg, #D2A8FF, #8957e5)" : "linear-gradient(135deg, #58A6FF, #3FB950)"
                        : "rgba(255,255,255,0.06)",
                      border: "none",
                      cursor: chatInput.trim() && !isChatLoading ? "pointer" : "default",
                      color: chatInput.trim() && !isChatLoading ? "#0D1117" : "rgba(255,255,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, alignSelf: "flex-end",
                      transition: "background 0.2s, color 0.2s",
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </motion.button>
                </div>
              </div>
            </>
          ) : (
            /* Images tab */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
                      color: "#E6EDF3", outline: "none", fontFamily: "Inter, sans-serif",
                    }}
                  />
                  <motion.button
                    onClick={() => void searchImages()}
                    disabled={!imageQuery.trim() || isSearchingImages}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: "7px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: "rgba(88,166,255,0.2)", border: "1px solid rgba(88,166,255,0.3)",
                      color: "#58A6FF", cursor: "pointer",
                    }}
                  >
                    {isSearchingImages ? "..." : "Найти"}
                  </motion.button>
                </div>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
                  Поиск через DuckDuckGo · Нажмите + чтобы добавить в проект
                </p>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
                {isSearchingImages && <div style={{ textAlign: "center", paddingTop: 40 }}><TypingDots /></div>}
                {imageError && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, fontSize: 12, background: "rgba(255,123,114,0.08)", border: "1px solid rgba(255,123,114,0.2)", color: "#FF7B72" }}>
                    {imageError}
                  </div>
                )}
                {!isSearchingImages && !imageError && imageResults.length === 0 && (
                  <div style={{ textAlign: "center", paddingTop: 48 }}>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Введите запрос для поиска изображений</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", marginTop: 6 }}>Например: nature, technology, city</p>
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
                        <img src={img.thumb} alt={img.description || "Image"} style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                        <div style={{
                          position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.15s",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0)")}
                        >
                          <button
                            onClick={() => void addImageToProject(img)}
                            style={{
                              background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 6,
                              padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#0D1117", cursor: "pointer", opacity: 0,
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

          {/* SE resize handle */}
          <div
            onMouseDown={startResizeSE}
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: 18, height: 18, cursor: "nwse-resize",
              display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
              padding: "3px",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="rgba(255,255,255,0.2)">
              <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const trigger = (
    <motion.button
      onClick={() => {
        setIsOpen((o) => !o);
      }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      style={{
        position: "fixed",
        bottom: 22,
        left: "calc(50% - 54px)",
        width: 108,
        height: 42,
        borderRadius: 14,
        background: isOpen
          ? "rgba(20,20,26,0.95)"
          : "linear-gradient(135deg, #1a6cf7 0%, #0ea86b 100%)",
        border: isOpen ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.08)",
        color: isOpen ? "rgba(255,255,255,0.6)" : "#fff",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        boxShadow: isOpen ? "none" : "0 4px 24px rgba(26,108,247,0.35), 0 2px 8px rgba(0,0,0,0.3)",
        zIndex: 8999,
        backdropFilter: isOpen ? "blur(12px)" : "none",
        letterSpacing: "0.01em",
        transition: "background 0.2s, box-shadow 0.2s",
      }}
    >
      {isOpen ? (
        <>
          <svg width="13" height="13" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Закрыть
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L9.5 5.5L14 7L9.5 8.5L8 13L6.5 8.5L2 7L6.5 5.5L8 1Z" fill="white" />
          </svg>
          Чат с AI
        </>
      )}
    </motion.button>
  );

  return ReactDOM.createPortal(
    <>
      {trigger}
      {panel}
      {flashToastEl}
    </>,
    document.body,
  );
}
