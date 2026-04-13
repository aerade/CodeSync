import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import ReactDOM from "react-dom";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as MonacoType from "monaco-editor";
import * as Y from "yjs";
import { PreviewPanel } from "@/components/PreviewPanel";
import { EDITOR_THEMES, registerCustomThemes } from "@/lib/editorThemes";
import {
  useGetRoom,
  useGetRoomFiles,
  useUpdateFile,
  getGetRoomFilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FileTree } from "@/components/FileTree";
import { AIPanel } from "@/components/AIPanel";
import { AIChatFloat } from "@/components/AIChatFloat";
import { Terminal, TerminalHandle } from "@/components/Terminal";
import { SessionSidebar, RoomChatMessage } from "@/components/SessionSidebar";
import { useUser, useAuth } from "@clerk/react";


const LANG_LABELS: Record<string, string> = {
  javascript: "JavaScript", typescript: "TypeScript", python: "Python",
  go: "Go", rust: "Rust", java: "Java", cpp: "C++", c: "C",
  csharp: "C#", ruby: "Ruby", php: "PHP", html: "HTML", css: "CSS",
  json: "JSON", markdown: "Markdown", shell: "Shell", sql: "SQL", plaintext: "Text",
};

interface CollabCursorInfo {
  userId: string;
  username: string;
  color: string;
  lineNumber: number;
  column: number;
}

interface WSMessage {
  type: string;
  update?: string;
  states?: Record<string, {
    cursor?: { anchor: number; head: number } | null;
    userId: string;
    username: string;
    color: string;
    isGuest?: boolean;
  }>;
  userId?: string;
  username?: string;
  color?: string;
  position?: { lineNumber: number; column: number };
  message?: string;
  imageDataUrl?: string;
  timestamp?: number;
}

interface RoomFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  isFolder: boolean;
  parentId: string | null | undefined;
  roomId: string;
  createdBy: string | null | undefined;
  createdAt: string;
  updatedAt: string;
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const [, setLocation] = useLocation();
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const qc = useQueryClient();

  // Only treat as guest when Clerk has fully loaded AND confirmed the user is NOT signed in.
  // During the OAuth redirect window (isLoaded=false), we must not decide yet.
  const isGuest = clerkLoaded && !isSignedIn && !!localStorage.getItem("codesync_guest_token");

  // When the user signs in via Clerk (e.g. Google OAuth), clear any leftover guest data
  useEffect(() => {
    if (clerkLoaded && isSignedIn) {
      localStorage.removeItem("codesync_guest_token");
      localStorage.removeItem("codesync_guest_user_id");
      localStorage.removeItem("codesync_guest_username");
    }
  }, [clerkLoaded, isSignedIn]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [editorTheme, setEditorTheme] = useState<string>(
    () => localStorage.getItem("codesync_editor_theme") ?? "vs-dark"
  );
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [themeMenuPos, setThemeMenuPos] = useState<{ top: number; right: number } | null>(null);
  const themeBtnRef = useRef<HTMLButtonElement>(null);

  function openThemeMenu() {
    if (!themeBtnRef.current) return;
    const rect = themeBtnRef.current.getBoundingClientRect();
    setThemeMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setThemeMenuOpen((o) => !o);
  }

  function handleThemeChange(themeId: string) {
    setEditorTheme(themeId);
    localStorage.setItem("codesync_editor_theme", themeId);
    setThemeMenuOpen(false);
  }

  // Close theme menu when clicking outside
  useEffect(() => {
    if (!themeMenuOpen) return;
    function close(e: MouseEvent) {
      const t = e.target as Element;
      if (!t.closest("[data-theme-selector]")) setThemeMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [themeMenuOpen]);

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const activeFileIdRef = useRef<string | null>(null);
  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);
  const [fileContent, setFileContent] = useState("");
  const [isBottomOpen, setIsBottomOpen] = useState(!isMobile);
  const terminalRef = useRef<TerminalHandle>(null);
  const [isLeftOpen, setIsLeftOpen] = useState(!isMobile);
  const [isRightOpen, setIsRightOpen] = useState(!isMobile);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const [aiChatPrefill, setAiChatPrefill] = useState<string | null>(null);
  const [fileStats, setFileStats] = useState<Record<string, { added?: number; removed?: number; errors?: number }>>({});

  // Resizable panel sizes
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [aiPanelWidth, setAiPanelWidth] = useState(320);
  const isResizingTerminal = useRef(false);
  const isResizingAiPanel = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const terminalCleanupRef = useRef<(() => void) | null>(null);
  const aiPanelCleanupRef = useRef<(() => void) | null>(null);

  // Cleanup resize listeners on unmount
  useEffect(() => {
    return () => {
      terminalCleanupRef.current?.();
      aiPanelCleanupRef.current?.();
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);
  const [connectedMembers, setConnectedMembers] = useState<{ userId: string; username: string; color: string; isGuest: boolean }[]>([]);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const myUserIdRef = useRef<string>("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [cursors, setCursors] = useState<CollabCursorInfo[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof MonacoType | null>(null);
  const isRemoteUpdate = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decorationIds = useRef<string[]>([]);
  const aiDiffDecorationsRef = useRef<string[]>([]);

  const updateFile = useUpdateFile();

  const { data: room } = useGetRoom(roomId);
  const { data: rawFiles = [], refetch: refetchFiles } = useGetRoomFiles(roomId);
  const files: RoomFile[] = rawFiles as RoomFile[];
  const activeFile = files.find((f) => f.id === activeFileId) ?? null;

  useEffect(() => {
    if (files.length > 0 && !activeFileId) {
      const first = files[0];
      setActiveFileId(first.id);
      setFileContent(first.content ?? "");
    }
  }, [files, activeFileId]);

  // Update collaborator cursor decorations
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations: MonacoType.editor.IModelDeltaDecoration[] = cursors.map((c) => ({
      range: new monaco.Range(c.lineNumber, c.column, c.lineNumber, c.column + 1),
      options: {
        afterContentClassName: "collab-cursor",
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        overviewRuler: { color: c.color, position: monaco.editor.OverviewRulerLane.Right },
        minimap: { color: c.color, position: monaco.editor.MinimapPosition.Gutter },
      },
    }));

    decorationIds.current = editor.deltaDecorations(decorationIds.current, newDecorations);
  }, [cursors]);

  useEffect(() => {
    if (!activeFileId) return;

    const file = files.find((f) => f.id === activeFileId);
    if (file) {
      setFileContent(file.content ?? "");
    }

    if (editorRef.current && aiDiffDecorationsRef.current.length > 0) {
      aiDiffDecorationsRef.current = editorRef.current.deltaDecorations(aiDiffDecorationsRef.current, []);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    const yText = ydoc.getText("content");

    let cancelled = false;

    void (async () => {
      // Wait for Clerk to fully load before attempting any auth
      if (!clerkLoaded) return;

      const guestToken = localStorage.getItem("codesync_guest_token") ?? "";

      // Request a collaboration token from the server (validates auth server-side)
      let collabToken = "";
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };

        // Prefer Clerk JWT over guest token (handles OAuth redirects where cookies lag)
        if (isSignedIn) {
          try {
            const clerkJwt = await getToken();
            if (clerkJwt) headers["Authorization"] = `Bearer ${clerkJwt}`;
          } catch {
            // Non-fatal: fall back to cookie-based Clerk auth
          }
        } else if (guestToken) {
          headers["x-guest-token"] = guestToken;
        }

        const tokenResp = await fetch("/api/collab/token", { method: "POST", headers });
        if (tokenResp.ok) {
          const tokenData = await tokenResp.json() as { token: string };
          collabToken = tokenData.token;
        }
      } catch (err) {
        console.error("Failed to get collab token:", err);
      }

      if (cancelled || !collabToken) {
        if (!collabToken) console.warn("No collab token — WebSocket connection skipped");
        ydoc.destroy();
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${protocol}://${window.location.host}/ws/rooms/${roomId}/files/${activeFileId}?token=${encodeURIComponent(collabToken)}`;

      const ws = new WebSocket(wsUrl);
      if (cancelled) { ws.close(); return; }
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;

          if (msg.type === "init" && msg.update) {
            const update = Uint8Array.from(atob(msg.update), (c) => c.charCodeAt(0));
            Y.applyUpdate(ydoc, update);
            const text = yText.toString();
            if (text && editorRef.current) {
              isRemoteUpdate.current = true;
              editorRef.current.setValue(text);
              isRemoteUpdate.current = false;
            }
          } else if (msg.type === "yjs-update" && msg.update) {
            const update = Uint8Array.from(atob(msg.update), (c) => c.charCodeAt(0));
            isRemoteUpdate.current = true;
            Y.applyUpdate(ydoc, update);
            const text = yText.toString();
            if (editorRef.current) {
              const editor = editorRef.current;
              const position = editor.getPosition();
              // Keep isRemoteUpdate true while setValue runs so onChange doesn't re-emit
              editor.setValue(text);
              if (position) editor.setPosition(position);
              setFileContent(text);
            }
            isRemoteUpdate.current = false;
          } else if (msg.type === "awareness" && msg.states) {
            const list = Object.values(msg.states).map((s) => ({
              userId: s.userId,
              username: s.username,
              color: s.color,
              isGuest: s.isGuest ?? false,
            }));
            setConnectedMembers(list);
          } else if (msg.type === "joined" && msg.userId) {
            myUserIdRef.current = msg.userId;
          } else if (msg.type === "cursor" && msg.userId && msg.position) {
            setCursors((prev) => {
              const next = prev.filter((c) => c.userId !== msg.userId);
              if (msg.userId && msg.position) {
                next.push({
                  userId: msg.userId,
                  username: msg.username ?? "Аноним",
                  color: msg.color ?? "#58A6FF",
                  lineNumber: msg.position.lineNumber,
                  column: msg.position.column,
                });
              }
              return next;
            });
          } else if (msg.type === "chat" && msg.userId && msg.message) {
            setChatMessages((prev) => [
              ...prev,
              {
                id: `chat_${msg.timestamp ?? Date.now()}_${msg.userId}`,
                userId: msg.userId!,
                username: msg.username ?? "Аноним",
                color: msg.color ?? "#58A6FF",
                content: msg.message!,
                imageDataUrl: msg.imageDataUrl,
                timestamp: msg.timestamp ?? Date.now(),
              },
            ]);
          }
        } catch (err) {
          console.error("WS message error:", err);
        }
      };

      ws.onclose = () => {
        setConnectedMembers([]);
        setCursors([]);
      };
    })();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId, roomId, clerkLoaded, isSignedIn]);

  function handleEditorChange(value: string | undefined) {
    if (isRemoteUpdate.current) return;
    const text = value ?? "";
    setFileContent(text);

    if (ydocRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
      const ydoc = ydocRef.current;
      const yText = ydoc.getText("content");
      const currentText = yText.toString();

      // Only update Yjs and broadcast if content actually changed
      if (currentText !== text) {
        ydoc.transact(() => {
          yText.delete(0, yText.length);
          yText.insert(0, text);
        });

        const update = Y.encodeStateAsUpdate(ydoc);
        wsRef.current.send(JSON.stringify({
          type: "yjs-update",
          update: btoa(String.fromCharCode(...update)),
        }));
      }
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (activeFileId && !isRemoteUpdate.current) {
        updateFile.mutate({ roomId, fileId: activeFileId, data: { content: text } });
      }
    }, 1500);
  }

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register all custom themes
    registerCustomThemes(monaco);

    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    monaco.languages.html.htmlDefaults?.setOptions?.({
      suggest: { html5: true },
    });

    editor.onDidChangeCursorPosition((e) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "cursor",
          position: { lineNumber: e.position.lineNumber, column: e.position.column },
        }));
        wsRef.current.send(JSON.stringify({ type: "awareness", state: { cursor: null } }));
      }
    });

    let selectionScrollTop = 0;

    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText = editor.getModel()?.getValueInRange(selection) ?? "";
        if (selectedText.trim().length > 3) {
          const domNode = editor.getDomNode();
          if (!domNode) return;
          const rect = domNode.getBoundingClientRect();
          const startPos = editor.getScrolledVisiblePosition(selection.getStartPosition());
          if (startPos) {
            const x = rect.left + startPos.left;
            const y = rect.top + startPos.top - 44;
            selectionScrollTop = editor.getScrollTop();
            setSelectionMenu({ x: Math.max(8, x), y: Math.max(8, y), text: selectedText });
          }
        } else {
          setSelectionMenu(null);
        }
      } else {
        setSelectionMenu(null);
      }
    });

    // Hide selection menu when editor scrolls more than 150px from where menu opened
    editor.onDidScrollChange(() => {
      const delta = Math.abs(editor.getScrollTop() - selectionScrollTop);
      if (delta > 150) {
        setSelectionMenu(null);
      }
    });
  };

  function sendChatMessage(content: string, imageDataUrl?: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", message: content, imageDataUrl }));
    }
  }

  function copyInviteCode() {
    if (room?.inviteCode) {
      void navigator.clipboard.writeText(room.inviteCode);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  }

  const handleTerminalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingTerminal.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = terminalHeight;

    function onMove(ev: MouseEvent) {
      if (!isResizingTerminal.current) return;
      const delta = dragStartY.current - ev.clientY;
      const newH = Math.max(80, Math.min(600, dragStartHeight.current + delta));
      setTerminalHeight(newH);
    }

    function onUp() {
      isResizingTerminal.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      terminalCleanupRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    terminalCleanupRef.current = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [terminalHeight]);

  const handleAiPanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingAiPanel.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = aiPanelWidth;

    function onMove(ev: MouseEvent) {
      if (!isResizingAiPanel.current) return;
      const delta = dragStartX.current - ev.clientX;
      const newW = Math.max(240, Math.min(600, dragStartWidth.current + delta));
      setAiPanelWidth(newW);
    }

    function onUp() {
      isResizingAiPanel.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      aiPanelCleanupRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    aiPanelCleanupRef.current = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [aiPanelWidth]);

  if (!room) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: "#161B22" }}>
        <div className="text-sm" style={{ color: "#8B949E" }}>Загрузка комнаты...</div>
      </div>
    );
  }

  const themeMenuPortal = themeMenuOpen && themeMenuPos
    ? ReactDOM.createPortal(
        <div
          data-theme-selector=""
          style={{
            position: "fixed",
            top: themeMenuPos.top,
            right: themeMenuPos.right,
            zIndex: 99999,
            background: "rgba(10,10,10,0.97)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
            minWidth: 170,
            borderRadius: 10,
            overflow: "hidden",
            backdropFilter: "blur(16px)",
          }}
        >
          {EDITOR_THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                fontSize: 12,
                color: theme.id === editorTheme ? "#fff" : "rgba(255,255,255,0.5)",
                background: theme.id === editorTheme ? "rgba(255,255,255,0.08)" : "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "background 0.12s",
              }}
            >
              {theme.id === editorTheme
                ? <span style={{ color: "#3FB950", fontSize: 10 }}>✓</span>
                : <span style={{ width: 14, display: "inline-block" }} />
              }
              {theme.label}
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
    <div className="ide-layout">
      {/* TOP BAR */}
      <div className="ide-topbar">
        <button
          className="text-sm font-semibold transition-colors hover:opacity-80"
          style={{ color: "#E6EDF3", cursor: "pointer", background: "none", border: "none" }}
          onClick={() => setLocation("/dashboard")}
          data-testid="btn-back-dashboard"
        >
          CodeSync
        </button>
        <span style={{ color: "#30363D" }}>/</span>
        <span className="text-sm font-medium truncate" style={{ color: "#E6EDF3", maxWidth: 200 }}>
          {room.title}
        </span>

        {/* Invite code */}
        <button
          onClick={copyInviteCode}
          className="text-xs font-mono px-2 py-0.5 rounded transition-colors hover:bg-white/5"
          style={{
            background: "#0D1117",
            border: "1px solid #30363D",
            color: inviteCopied ? "#3FB950" : "#8B949E",
            letterSpacing: "0.1em",
          }}
          data-testid="btn-copy-invite"
        >
          {inviteCopied ? "Скопировано!" : room.inviteCode}
        </button>

        {/* Run code OR Preview for HTML */}
        {activeFile?.language === "html" ? (
          <button
            onClick={() => setIsPreviewOpen(true)}
            data-testid="btn-toggle-preview"
            className="flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all hover:brightness-110 active:scale-95"
            style={{ background: "#1158be", color: "#fff", border: "1px solid #2176d2", fontSize: 12, cursor: "pointer" }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 1.75A.75.75 0 0 1 .75 1h14.5a.75.75 0 0 1 .75.75v9.5A.75.75 0 0 1 15.25 12H9.5v2h2.25a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5H6.5v-2H.75a.75.75 0 0 1-.75-.75Zm1.5.75v8h13v-8Z"/>
            </svg>
            Превью
          </button>
        ) : (
          <button
            onClick={() => {
              setIsBottomOpen(true);
              setTimeout(() => terminalRef.current?.run(), 100);
            }}
            data-testid="btn-run-code-topbar"
            className="flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all hover:brightness-110 active:scale-95"
            style={{ background: "#238636", color: "#fff", border: "1px solid #2ea043", fontSize: 12, cursor: "pointer" }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215z"/>
            </svg>
            Запустить
          </button>
        )}

        {/* Members — live count from WebSocket awareness */}
        <div
          className="flex items-center gap-2 px-2.5 py-1 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Avatar stack */}
          <div className="flex items-center" style={{ gap: -2 }}>
            {connectedMembers.slice(0, 4).map((m, i) => (
              <div
                key={m.userId}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ring-1 ring-[#161B22]"
                style={{ background: m.color, color: "#0D1117", zIndex: 4 - i, marginLeft: i > 0 ? -5 : 0 }}
                title={m.username}
              >
                {m.username.slice(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
          {/* Count */}
          <span className="text-xs font-medium" style={{ color: "#8B949E" }}>
            {connectedMembers.length}
            {room?.maxUsers ? `/${room.maxUsers}` : ""}
          </span>
          {/* Online dot */}
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: connectedMembers.length > 0 ? "#3FB950" : "#484F58" }}
            animate={connectedMembers.length > 0 ? { opacity: [1, 0.4, 1] } : { opacity: 0.4 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* Theme selector */}
          <div data-theme-selector="">
            <button
              ref={themeBtnRef}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors hover:bg-white/8"
              style={{
                color: "#8B949E",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                cursor: "pointer",
                fontSize: 11,
              }}
              onClick={openThemeMenu}
              title="Тема редактора"
              data-testid="btn-theme-selector"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              <span>{EDITOR_THEMES.find((t) => t.id === editorTheme)?.label ?? "Тема"}</span>
              <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.5 }}>
                <path d="M8 10.94L2.53 5.47a.75.75 0 0 0-1.06 1.06l6 6a.75.75 0 0 0 1.06 0l6-6a.75.75 0 0 0-1.06-1.06L8 10.94z"/>
              </svg>
            </button>
            </div>

          <button
            className="text-xs px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: "#8B949E", border: "none", background: "transparent", cursor: "pointer" }}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            data-testid="btn-toggle-sidebar"
          >
            Участники
          </button>
          <button
            className="text-xs px-2 py-0.5 rounded hover:bg-white/5 transition-colors"
            style={{ color: "#8B949E", border: "none", background: "transparent", cursor: "pointer" }}
            onClick={() => setIsRightOpen(!isRightOpen)}
            data-testid="btn-toggle-ai"
          >
            AI
          </button>
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="ide-main">
        {/* Left: File tree */}
        {isLeftOpen && (
          <motion.div
            initial={{ width: 240 }}
            animate={{ width: 240 }}
            className="flex-shrink-0 overflow-hidden"
            style={{ width: 240, borderRight: "1px solid #30363D", background: "#161B22" }}
          >
            <FileTree
              roomId={roomId}
              files={files}
              activeFileId={activeFileId}
              fileStats={fileStats}
              onFileSelect={(file) => {
                setActiveFileId(file.id);
                setFileContent(file.content ?? "");
                // Clear AI stats badge for this file when it's opened
                setFileStats((prev) => {
                  if (!prev[file.id]) return prev;
                  const next = { ...prev };
                  delete next[file.id];
                  return next;
                });
              }}
              onFilesChange={() => { void refetchFiles(); }}
              isReadOnly={isGuest}
            />
          </motion.div>
        )}

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Editor header */}
          <div
            className="flex items-center gap-2 px-3"
            style={{ height: 32, borderBottom: "1px solid #30363D", background: "#1C2128", flexShrink: 0 }}
          >
            <button
              className="text-xs hover:bg-white/5 px-1.5 rounded transition-colors"
              style={{ color: "#8B949E", background: "transparent", border: "none", cursor: "pointer" }}
              onClick={() => setIsLeftOpen(!isLeftOpen)}
              data-testid="btn-toggle-filetree"
            >
              {isLeftOpen ? "◀" : "▶"}
            </button>
            <span className="text-xs" style={{ color: "#8B949E" }}>
              {activeFile?.name ?? "Выберите файл"}
            </span>
            {activeFile && (
              <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ marginLeft: "auto", background: "#0D1117", color: "#8B949E", border: "1px solid #30363D" }}>
                {LANG_LABELS[activeFile.language] ?? activeFile.language}
              </span>
            )}
          </div>

          {/* Monaco Editor / Image Viewer */}
          <div className="flex-1 overflow-hidden" style={{ position: "relative" }}>
            {activeFile?.language === "image" && fileContent?.startsWith("data:") ? (
              <div
                style={{
                  width: "100%", height: "100%",
                  background: "#0D1117",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  overflow: "auto", gap: 12,
                }}
              >
                <img
                  src={fileContent}
                  alt={activeFile.name}
                  style={{
                    maxWidth: "90%", maxHeight: "80%",
                    objectFit: "contain",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 8px 48px rgba(0,0,0,0.6)",
                  }}
                />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "JetBrains Mono, monospace" }}>
                  {activeFile.name}
                </span>
              </div>
            ) : activeFile ? (
              <Editor
                height="100%"
                language={activeFile.language === "shell" ? "shell" : activeFile.language}
                value={fileContent}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                theme={editorTheme}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
                  lineHeight: 22,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  cursorBlinking: "smooth",
                  smoothScrolling: true,
                  renderLineHighlight: "line",
                  bracketPairColorization: { enabled: true },
                  tabSize: 2,
                  insertSpaces: true,
                  formatOnPaste: true,
                  readOnly: isGuest,
                  domReadOnly: isGuest,
                  quickSuggestions: { other: true, comments: true, strings: true },
                  suggestOnTriggerCharacters: true,
                  parameterHints: { enabled: true },
                  suggest: { showKeywords: true, showSnippets: true, showFunctions: true, showVariables: true },
                  autoClosingBrackets: "always",
                  autoClosingQuotes: "always",
                  autoSurround: "languageDefined",
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full" style={{ background: "#0D1117" }}>
                <div className="text-center">
                  <p className="text-sm mb-2" style={{ color: "#8B949E" }}>Выберите файл для редактирования</p>
                  <p className="text-xs" style={{ color: "#30363D" }}>или создайте новый</p>
                </div>
              </div>
            )}

            {/* Collaborator cursor overlays */}
            {cursors.map((c) => (
              <div
                key={c.userId}
                className="pointer-events-none absolute z-10 text-xs font-medium px-1 rounded"
                style={{
                  background: c.color,
                  color: "#0D1117",
                  top: (c.lineNumber - 1) * 22 + 12 + "px",
                  left: Math.max(0, c.column - 1) * 8.4 + 48 + "px",
                  opacity: 0.85,
                  whiteSpace: "nowrap",
                  transform: "translateY(-100%)",
                  fontSize: 10,
                }}
              >
                {c.username}
              </div>
            ))}

            {/* Selection context menu */}
            {selectionMenu && !isGuest && (
              <div
                ref={selectionMenuRef}
                style={{
                  position: "fixed",
                  left: Math.min(selectionMenu.x, window.innerWidth - 310),
                  top: selectionMenu.y,
                  zIndex: 4000,
                  display: "flex",
                  gap: 3,
                  background: "#1C2128",
                  border: "1px solid #30363D",
                  borderRadius: 8,
                  padding: "3px 4px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                  animation: "fadeIn 0.12s ease",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {[
                  { label: "✦ Спросить ИИ", prefix: "Объясни этот код:\n```\n", suffix: "\n```" },
                  { label: "⟳ Рефакторинг", prefix: "Рефакторь следующий код, сделай его чище и эффективнее:\n```\n", suffix: "\n```" },
                  { label: "★ Улучшить", prefix: "Улучши и оптимизируй этот код:\n```\n", suffix: "\n```" },
                  { label: "✎ Комментарии", prefix: "Добавь подробные комментарии к этому коду:\n```\n", suffix: "\n```" },
                  { label: "⚑ Найти баги", prefix: "Найди баги и проблемы в этом коде:\n```\n", suffix: "\n```" },
                ].map(({ label, prefix, suffix }) => (
                  <button
                    key={label}
                    onClick={() => {
                      setAiChatPrefill(prefix + selectionMenu.text + suffix);
                      setSelectionMenu(null);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      borderRadius: 5,
                      padding: "4px 8px",
                      fontSize: 11,
                      color: "#C9D1D9",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "background 0.1s",
                      fontFamily: "Inter, sans-serif",
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "rgba(88,166,255,0.15)"; (e.target as HTMLButtonElement).style.color = "#58A6FF"; }}
                    onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "transparent"; (e.target as HTMLButtonElement).style.color = "#C9D1D9"; }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom: Terminal */}
          {isBottomOpen && (
            <div
              className="ide-bottom"
              style={{ height: terminalHeight, flexShrink: 0, borderTop: "1px solid #30363D" }}
            >
              <div
                className="resize-handle-horizontal"
                onMouseDown={handleTerminalResizeStart}
                style={{
                  cursor: "row-resize",
                  height: 6,
                  background: "transparent",
                  flexShrink: 0,
                }}
              />
              <div style={{ height: terminalHeight - 6, overflow: "hidden" }}>
                <Terminal
                  ref={terminalRef}
                  code={fileContent}
                  language={activeFile?.language ?? "javascript"}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: AI Panel */}
        {isRightOpen && (
          <div
            className="flex-shrink-0 flex"
            style={{ width: aiPanelWidth, borderLeft: "1px solid #30363D" }}
          >
            <div
              onMouseDown={handleAiPanelResizeStart}
              style={{
                width: 6,
                cursor: "col-resize",
                flexShrink: 0,
                background: "transparent",
              }}
              className="hover:bg-blue-500/20 transition-colors"
            />
            <div style={{ flex: 1, overflow: "hidden" }}>
              <AIPanel
                roomId={roomId}
                fileId={activeFileId}
                fileContent={fileContent}
                language={activeFile?.language ?? "javascript"}
                fileName={activeFile?.name ?? ""}
                files={files.filter((f) => !f.isFolder).map((f) => ({ id: f.id, name: f.name, language: f.language, content: f.content }))}
                onContentRestored={(content: string) => {
                  isRemoteUpdate.current = true;
                  setFileContent(content);
                  if (editorRef.current) {
                    const pos = editorRef.current.getPosition();
                    editorRef.current.setValue(content);
                    if (pos) editorRef.current.setPosition(pos);
                  }
                  if (ydocRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                    const ydoc = ydocRef.current;
                    const yText = ydoc.getText("content");
                    ydoc.transact(() => {
                      yText.delete(0, yText.length);
                      yText.insert(0, content);
                    });
                    const update = Y.encodeStateAsUpdate(ydoc);
                    wsRef.current.send(JSON.stringify({
                      type: "yjs-update",
                      update: btoa(String.fromCharCode(...update)),
                    }));
                  }
                  isRemoteUpdate.current = false;
                }}
                onShowAiDiff={(oldContent: string, newContent: string) => {
                  const editor = editorRef.current;
                  const monaco = monacoRef.current;
                  if (!editor || !monaco) return;
                  const oldLines = oldContent.split("\n");
                  const newLines = newContent.split("\n");
                  const decorations: MonacoType.editor.IModelDeltaDecoration[] = [];
                  for (let i = 0; i < newLines.length; i++) {
                    if (oldLines[i] !== newLines[i]) {
                      decorations.push({
                        range: new monaco.Range(i + 1, 1, i + 1, 1),
                        options: {
                          isWholeLine: true,
                          className: "ai-diff-added",
                          overviewRuler: { color: "rgba(63,185,80,0.7)", position: monaco.editor.OverviewRulerLane.Right },
                        },
                      });
                    }
                  }
                  aiDiffDecorationsRef.current = editor.deltaDecorations(aiDiffDecorationsRef.current, decorations);
                  setTimeout(() => {
                    if (editorRef.current) {
                      aiDiffDecorationsRef.current = editorRef.current.deltaDecorations(aiDiffDecorationsRef.current, []);
                    }
                  }, 2000);
                }}
                onClearAiDiff={() => {
                  const editor = editorRef.current;
                  if (!editor) return;
                  aiDiffDecorationsRef.current = editor.deltaDecorations(aiDiffDecorationsRef.current, []);
                }}
              />
            </div>
          </div>
        )}

        {/* Preview Popup (portal, rendered via PreviewPanel) */}
        <PreviewPanel
          files={files.filter((f) => !f.isFolder)}
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
        />

        {/* Session sidebar */}
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 240 }}
            className="flex-shrink-0"
            style={{ width: 240 }}
          >
            <SessionSidebar
              members={connectedMembers}
              chatMessages={chatMessages}
              myUserId={myUserIdRef.current}
              onSendMessage={sendChatMessage}
            />
          </motion.div>
        )}
      </div>
    </div>

    {themeMenuPortal}

    <AIChatFloat
      roomId={roomId}
      fileId={activeFileId}
      fileContent={fileContent}
      language={activeFile?.language ?? "javascript"}
      fileName={activeFile?.name ?? ""}
      files={files.filter((f) => !f.isFolder).map((f) => ({ id: f.id, name: f.name, language: f.language, content: f.content }))}
      prefillInput={aiChatPrefill}
      onPrefillUsed={() => setAiChatPrefill(null)}
      onAiStats={(stats) => setFileStats((prev) => ({ ...prev, ...stats }))}
      onFilesChanged={() => {
        void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
      }}
      onContentRestored={(content: string) => {
        isRemoteUpdate.current = true;
        setFileContent(content);
        if (editorRef.current) {
          const pos = editorRef.current.getPosition();
          editorRef.current.setValue(content);
          if (pos) editorRef.current.setPosition(pos);
        }
        if (ydocRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          const ydoc = ydocRef.current;
          const yText = ydoc.getText("content");
          ydoc.transact(() => {
            yText.delete(0, yText.length);
            yText.insert(0, content);
          });
          const update = Y.encodeStateAsUpdate(ydoc);
          wsRef.current.send(JSON.stringify({
            type: "yjs-update",
            update: btoa(String.fromCharCode(...update)),
          }));
        }
        isRemoteUpdate.current = false;
      }}
      onShowAiDiff={(oldContent: string, newContent: string) => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;
        const oldLines = oldContent.split("\n");
        const newLines = newContent.split("\n");
        const decorations: MonacoType.editor.IModelDeltaDecoration[] = [];
        for (let i = 0; i < newLines.length; i++) {
          if (oldLines[i] !== newLines[i]) {
            decorations.push({
              range: new monaco.Range(i + 1, 1, i + 1, 1),
              options: {
                isWholeLine: true,
                className: "ai-diff-added",
                overviewRuler: { color: "rgba(63,185,80,0.7)", position: monaco.editor.OverviewRulerLane.Right },
              },
            });
          }
        }
        aiDiffDecorationsRef.current = editor.deltaDecorations(aiDiffDecorationsRef.current, decorations);
        setTimeout(() => {
          if (editorRef.current) {
            aiDiffDecorationsRef.current = editorRef.current.deltaDecorations(aiDiffDecorationsRef.current, []);
          }
        }, 2000);
      }}
      onClearAiDiff={() => {
        const editor = editorRef.current;
        if (!editor) return;
        aiDiffDecorationsRef.current = editor.deltaDecorations(aiDiffDecorationsRef.current, []);
      }}
      onFileStream={(streamFileId, streamFileName, content) => {
        const currentActiveFileId = activeFileIdRef.current;

        // Switch to any file being streamed - even if not yet in list (just created)
        if (streamFileId && streamFileId !== currentActiveFileId) {
          setActiveFileId(streamFileId);
          activeFileIdRef.current = streamFileId;
        }

        isRemoteUpdate.current = true;
        setFileContent(content);
        if (editorRef.current) {
          const pos = editorRef.current.getPosition();
          editorRef.current.setValue(content);
          if (pos) editorRef.current.setPosition(pos);
        }
        isRemoteUpdate.current = false;
      }}
    />
    </>
  );
}
