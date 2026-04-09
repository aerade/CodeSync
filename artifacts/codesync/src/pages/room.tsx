import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as MonacoType from "monaco-editor";
import * as Y from "yjs";
import {
  useGetRoom,
  useGetRoomFiles,
  useGetRoomMembers,
  useGetRoomEvents,
  useUpdateFile,
  getGetRoomEventsQueryKey,
  getGetRoomMembersQueryKey,
  getGetRoomFilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FileTree } from "@/components/FileTree";
import { AIPanel } from "@/components/AIPanel";
import { Terminal, TerminalHandle } from "@/components/Terminal";
import { SessionSidebar } from "@/components/SessionSidebar";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/react";

const COLLAB_COLORS = [
  "#58A6FF", "#3FB950", "#D2A8FF", "#FFA657",
  "#F2CC60", "#79C0FF", "#56D364", "#FF7B72",
];

function getColor(idx: number) {
  return COLLAB_COLORS[idx % COLLAB_COLORS.length];
}

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
  const { user: clerkUser } = useUser();
  const qc = useQueryClient();

  // Guest mode: Clerk user is not signed in but a guest token exists
  const isGuest = !clerkUser && !!localStorage.getItem("codesync_guest_token");

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isBottomOpen, setIsBottomOpen] = useState(true);
  const terminalRef = useRef<TerminalHandle>(null);
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
  const [activeMemberIds, setActiveMemberIds] = useState<Set<string>>(new Set());
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
  const { data: members = [] } = useGetRoomMembers(roomId, {
    query: { refetchInterval: 5000, queryKey: getGetRoomMembersQueryKey(roomId) },
  });
  const { data: events = [] } = useGetRoomEvents(roomId, undefined, {
    query: { refetchInterval: 5000, queryKey: getGetRoomEventsQueryKey(roomId) },
  });

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
      const guestToken = localStorage.getItem("codesync_guest_token") ?? "";

      // Request a collaboration token from the server (validates auth server-side)
      let collabToken = "";
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (guestToken) headers["x-guest-token"] = guestToken;
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
            const ids = new Set(Object.keys(msg.states));
            setActiveMemberIds(ids);
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
          } else if (msg.type === "joined") {
            setActiveMemberIds((prev) => new Set([...prev, msg.userId ?? ""]));
          }
        } catch (err) {
          console.error("WS message error:", err);
        }
      };

      ws.onclose = () => {
        setActiveMemberIds(new Set());
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
  }, [activeFileId, roomId]);

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

        {/* Members */}
        <div className="flex items-center gap-1 ml-2">
          {members.slice(0, 5).map((m, i) => (
            <div
              key={m.id}
              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: getColor(i), color: "#0D1117", fontSize: 9 }}
              title={m.username}
              data-testid={`avatar-member-${m.id}`}
            >
              {m.username.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {members.length > 5 && (
            <span className="text-xs" style={{ color: "#8B949E" }}>+{members.length - 5}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
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
                theme="vs-dark"
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

        {/* Session sidebar */}
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 180 }}
            className="flex-shrink-0"
            style={{ width: 180 }}
          >
            <SessionSidebar
              members={members.map((m, i) => ({
                userId: m.userId,
                username: m.username,
                color: getColor(i),
                isGuest: m.isGuest,
              }))}
              events={events.map((e) => ({
                id: e.id,
                username: e.username,
                description: e.description,
                type: e.type,
                createdAt: e.createdAt,
              }))}
              activeMemberIds={activeMemberIds}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
