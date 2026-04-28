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
  forceClose?: number;
}

const MODELS = [
  { id: "gpt-4.1",          label: "GPT-4.1",       badge: "По умолчанию" },
  { id: "claude-sonnet-4-5",label: "Claude Sonnet",  badge: "Умный" },
  { id: "o3",               label: "o3",             badge: "Рассуждение" },
  { id: "gpt-4o",           label: "GPT-4o",         badge: "Быстрый" },
];

function playDoneSound() {
  try {
    const settingsRaw = localStorage.getItem("codesync_room_settings");
    const s = settingsRaw ? JSON.parse(settingsRaw) as { soundEnabled?: boolean; soundType?: string } : {};
    if (s.soundEnabled === false) return;
    const type = s.soundType ?? "chime";
    if (type === "custom") {
      const customUrl = localStorage.getItem("codesync_custom_sound");
      if (customUrl) {
        const audio = new Audio(customUrl);
        audio.volume = 0.5;
        audio.play().catch(() => {});
      }
      return;
    }
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

type AiContextMenu = { x: number; y: number; idx: number } | null;

function initBtnPos() {
  return {
    x: Math.round(window.innerWidth / 2 - 22),
    y: window.innerHeight - 72,
  };
}

export function AIChatFloat({
  roomId, fileId, fileContent, language, fileName, files = [],
  onFilesChanged, onContentRestored, onShowAiDiff, onClearAiDiff, onFileStream,
  prefillInput, onPrefillUsed, onAiStats, forceClose,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4.1");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string; mimeType: string; imageDataUrl?: string } | null>(null);
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [aiContextMenu, setAiContextMenu] = useState<AiContextMenu>(null);
  const [btnPos, setBtnPos] = useState(initBtnPos);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const btnDraggingRef = useRef(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileAttachRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  }, [messages, isChatLoading]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "instant" });
      setShowScrollBtn(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  useEffect(() => {
    if (prefillInput) {
      setChatInput(prefillInput);
      setIsOpen(true);
      onPrefillUsed?.();
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.selectionStart = inputRef.current.selectionEnd = inputRef.current.value.length;
        }
      }, 250);
    }
  }, [prefillInput]);

  // Close model menu on outside click
  useEffect(() => {
    if (!modelMenuOpen) return;
    function handler(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);

  // Close AI context menu
  useEffect(() => {
    if (!aiContextMenu) return;
    function handler(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setAiContextMenu(null);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [aiContextMenu]);

  useEffect(() => {
    if (forceClose) setIsOpen(false);
  }, [forceClose]);

  const startBtnDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    btnDraggingRef.current = false;
    const startMX = e.clientX, startMY = e.clientY;
    const startX = btnPos.x, startY = btnPos.y;
    let moved = false;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startMX, dy = ev.clientY - startMY;
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      moved = true;
      btnDraggingRef.current = true;
      setBtnPos({
        x: Math.max(0, Math.min(window.innerWidth - 44, startX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 44, startY + dy)),
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setTimeout(() => { btnDraggingRef.current = false; }, 0);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [btnPos]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  function getHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const guestToken = localStorage.getItem("codesync_guest_token");
    if (guestToken) h["x-guest-token"] = guestToken;
    return h;
  }

  function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert("Файл слишком большой (макс. 8 МБ)"); e.target.value = ""; return; }
    const isImage = file.type.startsWith("image/");
    const reader = new FileReader();
    if (isImage) {
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string ?? "";
        setAttachedFile({ name: file.name, content: "", mimeType: file.type, imageDataUrl: dataUrl });
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (ev) => {
        const content = ev.target?.result as string ?? "";
        setAttachedFile({ name: file.name, content, mimeType: file.type || "text/plain" });
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  }

  async function sendChat() {
    const hasText = chatInput.trim().length > 0;
    const hasImage = !!attachedFile?.imageDataUrl;
    if ((!hasText && !hasImage) || isChatLoading) return;
    let userMsg = chatInput.trim() || (hasImage ? "Что на этом изображении?" : "");
    const fileToSend = attachedFile;
    let imageAttachment: { name: string; dataUrl: string } | undefined;
    if (fileToSend) {
      if (fileToSend.imageDataUrl) {
        userMsg = `[📷 ${fileToSend.name}]\n${userMsg}`;
        imageAttachment = { name: fileToSend.name, dataUrl: fileToSend.imageDataUrl };
      } else {
        userMsg = `[Файл: ${fileToSend.name}]\n\`\`\`\n${fileToSend.content.slice(0, 8000)}\n\`\`\`\n\n${userMsg}`;
      }
      setAttachedFile(null);
    }
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsChatLoading(true);
    onClearAiDiff?.();

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
          model: selectedModel,
          allFiles: files
            .filter((f) => f.language !== "image")
            .map((f) => ({ id: f.id, name: f.name, language: f.language, content: (f.content ?? "").slice(0, 4000) })),
          ...(imageAttachment ? { imageAttachment } : {}),
        }),
      });

      if (!resp.ok) {
        let errText = `Ошибка ${resp.status}`;
        try { const d = await resp.json() as { error?: string }; if (d.error) errText = d.error; } catch (_) {}
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
      let hadImageDownloads = false;
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
            if (parsed.error) {
              const rawErr = parsed.error as string;
              // Sanitize: never show raw SQL, stack traces or Drizzle internals to the user
              const isTechnical = /Failed query|select .* from|drizzle|stack trace|at Object\.|\.mjs:/i.test(rawErr);
              const userMsg = isTechnical ? "Произошла внутренняя ошибка. Попробуйте ещё раз." : rawErr;
              setMessages((prev) => [...prev, { role: "assistant", content: `⚠ ${userMsg}` }]);
            }
            if (parsed.fileStream) {
              const fs = parsed.fileStream;
              const isImageFile = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif)$/i.test(fs.fileName ?? "");
              if (!isImageFile) {
                onFileStream?.(fs.fileId ?? null, fs.fileName ?? null, fs.content);
              }
            }
            if (parsed.toolCall) {
              hadToolCalls = true;
              const tc = parsed.toolCall;
              // Only refresh file tree for file-modifying operations, not for searches or reads
              const isReadOnly = tc.name === "search_images" || tc.name === "download_image"
                || tc.name === "web_search" || tc.name === "list_files" || tc.name === "read_file";
              if (!isReadOnly) {
                onFilesChanged?.();
              } else if (tc.name === "download_image" && tc.result?.success) {
                hadImageDownloads = true;
              }
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
                } else if (tc.name === "delete_file") { opCounts.delete++; }
              } else if (tc.result && !tc.result.success && tc.result.error) {
                // Tool errors are returned to AI for self-correction — don't show raw errors to user
                console.warn("[AI tool error]", tc.name, tc.result.error);
              }
              if (tc.name === "create_file" && tc.result?.success && tc.result?.fileId) {
                const createdName = (tc.result.name ?? tc.args.name ?? "") as string;
                const isImageFile = /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|avif)$/i.test(createdName);
                const isEmptyFolder = !createdName.includes(".") && !((tc.args.content as string | undefined) ?? "").trim();
                if (!isImageFile && !isEmptyFolder) {
                  onFileStream?.(tc.result.fileId, createdName, (tc.args.content as string | undefined) ?? "");
                }
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

      // Refresh file tree once at the end if images were downloaded
      if (hadImageDownloads) onFilesChanged?.();
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
      // Auto-exit plan mode after AI responds: plan was shown, now ready to act
      if (planMode) setPlanMode(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendChat();
    }
  }

  function stopGeneration() {
    abortControllerRef.current?.abort();
    setIsChatLoading(false);
  }

  function handleMsgContextMenu(e: React.MouseEvent, idx: number) {
    e.preventDefault();
    setAiContextMenu({ x: e.clientX, y: e.clientY, idx });
  }

  const currentModelLabel = MODELS.find((m) => m.id === selectedModel)?.label ?? selectedModel;

  // Panel position: open above/beside the button, clamped to viewport
  const panelLeft = Math.max(4, Math.min(window.innerWidth - PANEL_W - 4, btnPos.x + 22 - PANEL_W / 2));
  const panelTop = Math.max(4, btnPos.y - PANEL_H - 10);

  // AI message context menu portal
  const aiContextMenuEl = aiContextMenu
    ? ReactDOM.createPortal(
        <div
          style={{
            position: "fixed",
            top: aiContextMenu.y,
            left: aiContextMenu.x,
            zIndex: 99999,
            background: "#161B22",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            minWidth: 160,
            overflow: "hidden",
            padding: "4px",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {[
            {
              label: copiedMsgIdx === aiContextMenu.idx ? "✓ Скопировано" : "Копировать",
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              ),
              action: () => {
                void navigator.clipboard.writeText(messages[aiContextMenu.idx]?.content ?? "");
                setCopiedMsgIdx(aiContextMenu.idx);
                setTimeout(() => setCopiedMsgIdx(null), 1500);
                setAiContextMenu(null);
              },
            },
            ...(messages[aiContextMenu.idx]?.role === "user" ? [{
              label: "Повторить",
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                </svg>
              ),
              action: () => {
                setChatInput(messages[aiContextMenu.idx].content);
                setAiContextMenu(null);
                setTimeout(() => inputRef.current?.focus(), 100);
              },
            }] : []),
            {
              label: "Удалить",
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF7B72" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
              ),
              action: () => {
                setMessages((prev) => prev.filter((_, i) => i !== aiContextMenu.idx));
                setAiContextMenu(null);
              },
              danger: true,
            },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "8px 12px",
                background: "transparent", border: "none", cursor: "pointer",
                color: (item as { danger?: boolean }).danger ? "#FF7B72" : "rgba(255,255,255,0.8)",
                fontSize: 12, borderRadius: 7, textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  const panel = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="ai-chat-panel"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          style={{
            position: "fixed",
            top: panelTop,
            left: panelLeft,
            width: PANEL_W,
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
          {/* Top glow */}
          <div style={{
            position: "absolute", top: 0, left: "15%", right: "15%", height: 1,
            background: "linear-gradient(90deg, transparent, rgba(88,166,255,0.5), rgba(63,185,80,0.35), transparent)",
            pointerEvents: "none",
          }} />

          {/* ── Header ── */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}>
            {/* AI icon */}
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

            {/* Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#E6EDF3" }}>CodeSync AI</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isChatLoading ? "печатает..." : files.length > 0 ? `${files.length} файлов в контексте` : "Глобальный контекст"}
              </div>
            </div>

            {/* Clear history */}
            {messages.length > 0 && !isChatLoading && (
              <button
                onClick={() => setMessages([])}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.28)", fontSize: 11, padding: "2px 6px", borderRadius: 5, flexShrink: 0 }}
              >
                Очистить
              </button>
            )}

            {/* Custom model picker */}
            <div ref={modelMenuRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setModelMenuOpen((v) => !v)}
                style={{
                  height: 26, padding: "0 10px", borderRadius: 7, fontSize: 10, fontWeight: 600,
                  background: modelMenuOpen ? "rgba(88,166,255,0.14)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${modelMenuOpen ? "rgba(88,166,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                  color: modelMenuOpen ? "#79C0FF" : "rgba(255,255,255,0.65)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                  transition: "all 0.15s",
                }}
              >
                <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L9.5 5.5L14 7L9.5 8.5L8 13L6.5 8.5L2 7L6.5 5.5L8 1Z" fill="currentColor"/>
                </svg>
                {currentModelLabel}
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <AnimatePresence>
                {modelMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.12 }}
                    style={{
                      position: "absolute", top: "calc(100% + 6px)", right: 0,
                      background: "#0D1117",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      boxShadow: "0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(88,166,255,0.06)",
                      minWidth: 180, padding: 4, zIndex: 99999,
                    }}
                  >
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          width: "100%", padding: "8px 12px",
                          background: selectedModel === m.id ? "rgba(88,166,255,0.1)" : "transparent",
                          border: "none", borderRadius: 9, cursor: "pointer",
                          textAlign: "left", transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => { if (selectedModel !== m.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={(e) => { if (selectedModel !== m.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 500, color: selectedModel === m.id ? "#79C0FF" : "rgba(255,255,255,0.8)", flex: 1 }}>{m.label}</span>
                        {m.badge && (
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                            background: selectedModel === m.id ? "rgba(88,166,255,0.2)" : "rgba(255,255,255,0.07)",
                            color: selectedModel === m.id ? "#79C0FF" : "rgba(255,255,255,0.35)",
                          }}>{m.badge}</span>
                        )}
                        {selectedModel === m.id && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#79C0FF" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Close */}
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

          {/* ── Messages ── */}
          <div
            ref={msgsContainerRef}
            onScroll={() => {
              const el = msgsContainerRef.current;
              if (!el) return;
              setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
            }}
            style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}
          >
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
                    onContextMenu={(e) => handleMsgContextMenu(e, i)}
                    style={{
                      maxWidth: "83%",
                      borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "4px 12px 12px 12px",
                      padding: "8px 12px", fontSize: 12, lineHeight: 1.65,
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, rgba(88,166,255,0.18), rgba(88,166,255,0.1))"
                        : "rgba(255,255,255,0.04)",
                      border: `1px solid ${msg.role === "user" ? "rgba(88,166,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                      color: "#E6EDF3",
                      cursor: "default",
                      userSelect: "text",
                    }}
                  >
                    <SafeMarkdown text={msg.content} />
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

          {/* Scroll-to-bottom button */}
          {showScrollBtn && (
            <div style={{ position: "absolute", bottom: 78, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
              <button
                onClick={() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollBtn(false); }}
                style={{
                  pointerEvents: "all",
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px 5px 8px",
                  borderRadius: 20,
                  background: "rgba(88,166,255,0.18)",
                  border: "1px solid rgba(88,166,255,0.35)",
                  backdropFilter: "blur(8px)",
                  cursor: "pointer",
                  color: "#58A6FF",
                  fontSize: 12, fontWeight: 500,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(88,166,255,0.28)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(88,166,255,0.18)"; }}
              >
                <svg width="13" height="13" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3L5 6.5L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                прокрути вниз
              </button>
            </div>
          )}

          {/* ── Input area ── */}
          <div style={{ padding: "8px 12px 12px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <input
              ref={fileAttachRef}
              type="file"
              accept="image/*,text/*,.json,.md,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.cpp,.c,.cs,.rb,.php,.sql,.sh"
              style={{ display: "none" }}
              onChange={handleAttachFile}
            />

            {/* Attached file chip */}
            {attachedFile && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                padding: "4px 8px", borderRadius: 8,
                background: attachedFile.imageDataUrl ? "rgba(63,185,80,0.08)" : "rgba(88,166,255,0.08)",
                border: `1px solid ${attachedFile.imageDataUrl ? "rgba(63,185,80,0.25)" : "rgba(88,166,255,0.2)"}`,
              }}>
                {attachedFile.imageDataUrl ? (
                  <img
                    src={attachedFile.imageDataUrl}
                    alt={attachedFile.name}
                    style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                )}
                <span style={{ fontSize: 11, color: attachedFile.imageDataUrl ? "#3FB950" : "#58A6FF", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {attachedFile.imageDataUrl ? "📷 " : ""}{attachedFile.name}
                </span>
                <button onClick={() => setAttachedFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </div>
            )}

            {/* Single big input box */}
            <div style={{
              position: "relative",
              background: isChatLoading ? "rgba(88,166,255,0.04)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isChatLoading ? "rgba(88,166,255,0.2)" : "rgba(255,255,255,0.09)"}`,
              borderRadius: 14,
              transition: "border-color 0.3s, background 0.3s",
              boxShadow: isChatLoading ? "0 0 0 1px rgba(88,166,255,0.1)" : "none",
            }}>
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isChatLoading ? "AI пишет..." : planMode ? "Описать задачу для плана..." : "Спросить AI... (Enter — отправить, Shift+Enter — перенос)"}
                rows={3}
                style={{
                  display: "block",
                  width: "100%",
                  background: "transparent", border: "none", outline: "none",
                  color: isChatLoading ? "rgba(255,255,255,0.3)" : "#E6EDF3",
                  fontSize: 13, fontFamily: "Inter, sans-serif",
                  resize: "none", lineHeight: 1.5,
                  padding: "12px 12px 40px",
                  boxSizing: "border-box",
                  maxHeight: 140, overflowY: "auto",
                }}
                disabled={isChatLoading}
              />

              {/* Bottom bar inside textarea box */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                display: "flex", alignItems: "center",
                padding: "0 8px 8px",
                gap: 4,
                zIndex: 5,
              }}>
                {/* File attach — bottom left */}
                <button
                  onClick={() => fileAttachRef.current?.click()}
                  title="Прикрепить файл или изображение"
                  style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    background: attachedFile?.imageDataUrl ? "rgba(63,185,80,0.12)" : attachedFile ? "rgba(88,166,255,0.12)" : "transparent",
                    border: `1px solid ${attachedFile?.imageDataUrl ? "rgba(63,185,80,0.3)" : attachedFile ? "rgba(88,166,255,0.3)" : "rgba(255,255,255,0.07)"}`,
                    cursor: "pointer",
                    color: attachedFile?.imageDataUrl ? "#3FB950" : attachedFile ? "#58A6FF" : "rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!attachedFile) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; } }}
                  onMouseLeave={(e) => { if (!attachedFile) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; } }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>

                <div style={{ flex: 1 }} />

                {/* Plan button — bottom right, left of send */}
                <button
                  onClick={() => setPlanMode((p) => !p)}
                  title="Режим плана"
                  style={{
                    height: 26, padding: "0 9px", borderRadius: 7, flexShrink: 0,
                    background: planMode ? "rgba(88,166,255,0.15)" : "transparent",
                    border: `1px solid ${planMode ? "rgba(88,166,255,0.45)" : "rgba(255,255,255,0.07)"}`,
                    cursor: "pointer",
                    color: planMode ? "#79C0FF" : "rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: planMode ? 600 : 400,
                    boxShadow: planMode ? "0 0 12px rgba(88,166,255,0.2)" : "none",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!planMode) { (e.currentTarget as HTMLElement).style.background = "rgba(88,166,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(88,166,255,0.7)"; } }}
                  onMouseLeave={(e) => { if (!planMode) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; } }}
                >
                  {planMode && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#79C0FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  План
                </button>

                {/* Send / Stop button */}
                {isChatLoading ? (
                  <button
                    onClick={stopGeneration}
                    title="Остановить генерацию"
                    style={{
                      width: 30, height: 26, borderRadius: 7, flexShrink: 0,
                      background: "rgba(255,123,114,0.15)",
                      border: "1px solid rgba(255,123,114,0.4)",
                      cursor: "pointer", color: "#FF7B72",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      animation: "stopPulse 1.8s ease-in-out infinite",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                      <rect x="1" y="1" width="8" height="8" rx="1.5"/>
                    </svg>
                  </button>
                ) : (
                  <motion.button
                    onClick={() => void sendChat()}
                    disabled={!chatInput.trim() && !attachedFile?.imageDataUrl}
                    whileHover={(chatInput.trim() || attachedFile?.imageDataUrl) ? { scale: 1.07 } : {}}
                    whileTap={(chatInput.trim() || attachedFile?.imageDataUrl) ? { scale: 0.93 } : {}}
                    style={{
                      width: 30, height: 26, borderRadius: 7, flexShrink: 0,
                      background: (chatInput.trim() || attachedFile?.imageDataUrl)
                        ? planMode
                          ? "linear-gradient(135deg, #D2A8FF, #8957e5)"
                          : "linear-gradient(135deg, #58A6FF, #3FB950)"
                        : "rgba(255,255,255,0.06)",
                      border: "none",
                      cursor: (chatInput.trim() || attachedFile?.imageDataUrl) ? "pointer" : "default",
                      color: (chatInput.trim() || attachedFile?.imageDataUrl) ? "#0D1117" : "rgba(255,255,255,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 0.2s, color 0.2s",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onPointerDown={startBtnDrag}
        onClick={() => { if (!btnDraggingRef.current) setIsOpen((v) => !v); }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.95 }}
        title="AI-ассистент (тяните для перемещения)"
        style={{
          position: "fixed",
          left: btnPos.x,
          top: btnPos.y,
          width: 44, height: 44, borderRadius: 14,
          background: isOpen
            ? "linear-gradient(135deg, #1a253a, #0d1117)"
            : "linear-gradient(135deg, #0f1923, #0a0f16)",
          border: `1px solid ${isOpen ? "rgba(88,166,255,0.5)" : "rgba(88,166,255,0.3)"}`,
          boxShadow: isOpen
            ? "0 0 24px rgba(88,166,255,0.35), 0 8px 24px rgba(0,0,0,0.6)"
            : "0 0 16px rgba(88,166,255,0.2), 0 4px 16px rgba(0,0,0,0.5)",
          cursor: "grab",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 8999,
          touchAction: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
          <path d="M8 1L9.5 5.5L14 7L9.5 8.5L8 13L6.5 8.5L2 7L6.5 5.5L8 1Z" fill="url(#ai-btn-star)" />
          <defs>
            <linearGradient id="ai-btn-star" x1="2" y1="1" x2="14" y2="13">
              <stop offset="0%" stopColor="#79C0FF"/>
              <stop offset="100%" stopColor="#56D364"/>
            </linearGradient>
          </defs>
        </svg>
        {isChatLoading && (
          <div style={{
            position: "absolute", top: -3, right: -3,
            width: 10, height: 10, borderRadius: "50%",
            background: "#3FB950",
            boxShadow: "0 0 6px #3FB950",
            animation: "stopPulse 1.2s ease-in-out infinite",
          }} />
        )}
      </motion.button>

      {ReactDOM.createPortal(panel, document.body)}
      {aiContextMenuEl}
    </>
  );
}
