import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
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
import { Terminal, TerminalHandle } from "@/components/Terminal";
import { SessionSidebar } from "@/components/SessionSidebar";
import { Button } from "@/components/ui/button";
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
  const [fileContent, setFileContent] = useState("");
  const [isBottomOpen, setIsBottomOpen] = useState(!isMobile);
  const terminalRef = useRef<TerminalHandle>(null);
  const [isLeftOpen, setIsLeftOpen] = useState(!isMobile);
  const [isRightOpen, setIsRightOpen] = useState(!isMobile);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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

        wsRef.current.send(JSON.stringify({
          type: "awareness",
          state: { cursor: null },
        }));
      }
    });
  };

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

  return (
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

        {/* Run code */}
        <Button
          size="sm"
          onClick={() => {
            setIsBottomOpen(true);
            setTimeout(() => terminalRef.current?.run(), 100);
          }}
          style={{ background: "#3FB950", color: "#0D1117", fontWeight: 600, fontSize: 11, height: 26 }}
          data-testid="btn-run-code-topbar"
        >
          Запустить
        </Button>

        {/* Preview */}
        {files.some((f) => !f.isFolder && f.language === "html") && (
          <Button
            size="sm"
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            style={{
              background: isPreviewOpen ? "#58A6FF" : "transparent",
              color: isPreviewOpen ? "#0D1117" : "#58A6FF",
              fontWeight: 600,
              fontSize: 11,
              height: 26,
              border: "1px solid #58A6FF",
            }}
            data-testid="btn-toggle-preview"
          >
            Превью
          </Button>
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
              className="text-xs px-2 py-0.5 rounded hover:bg-white/5 transition-colors flex items-center gap-1"
              style={{ color: "#8B949E", border: "none", background: "transparent", cursor: "pointer" }}
              onClick={openThemeMenu}
              title="Тема редактора"
              data-testid="btn-theme-selector"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span className="hidden sm:inline">{EDITOR_THEMES.find((t) => t.id === editorTheme)?.label ?? "Тема"}</span>
            </button>
            {themeMenuOpen && themeMenuPos && (
              <div
                data-theme-selector=""
                style={{
                  position: "fixed",
                  top: themeMenuPos.top,
                  right: themeMenuPos.right,
                  zIndex: 9999,
                  background: "rgba(13,17,23,0.97)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
                  minWidth: 160,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {EDITOR_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/8"
                    style={{
                      color: theme.id === editorTheme ? "#fff" : "#8B949E",
                      background: theme.id === editorTheme ? "rgba(255,255,255,0.08)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {theme.id === editorTheme && (
                      <span style={{ color: "#3FB950", fontSize: 10 }}>✓</span>
                    )}
                    {theme.id !== editorTheme && <span style={{ width: 14 }} />}
                    {theme.label}
                  </button>
                ))}
              </div>
            )}
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
              onFileSelect={(file) => {
                setActiveFileId(file.id);
                setFileContent(file.content ?? "");
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

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden" style={{ position: "relative" }}>
            {activeFile ? (
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
                    const oldLine = oldLines[i];
                    const newLine = newLines[i];
                    if (oldLine !== newLine) {
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
                  for (let i = newLines.length; i < oldLines.length; i++) {
                    const lineNum = Math.max(1, newLines.length);
                    decorations.push({
                      range: new monaco.Range(lineNum, 1, lineNum, 1),
                      options: {
                        isWholeLine: true,
                        className: "ai-diff-deleted",
                        overviewRuler: { color: "rgba(255,123,114,0.7)", position: monaco.editor.OverviewRulerLane.Right },
                      },
                    });
                    break;
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
                  const matchById = streamFileId && streamFileId === activeFileId;
                  const matchByName = !streamFileId && streamFileName &&
                    files.some((f) => f.name === streamFileName && f.id === activeFileId);
                  const isNewFile = !streamFileId;
                  if (!matchById && !matchByName && !isNewFile) return;
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
            </div>
          </div>
        )}

        {/* Preview Panel */}
        {isPreviewOpen && (
          <div
            className="flex-shrink-0"
            style={{ width: 480, borderLeft: "1px solid #30363D" }}
          >
            <PreviewPanel
              files={files.filter((f) => !f.isFolder)}
              onClose={() => setIsPreviewOpen(false)}
            />
          </div>
        )}

        {/* Session sidebar */}
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 180 }}
            className="flex-shrink-0"
            style={{ width: 180 }}
          >
            <SessionSidebar
              members={connectedMembers}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
