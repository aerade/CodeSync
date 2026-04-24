import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as MonacoType from "monaco-editor";
import * as Y from "yjs";
import { api, type File as RoomFile, type RoomMember, type User, getToken, getCurrentUser, API_BASE } from "@/lib/api";
import { getLanguageFromFilename } from "@/lib/utils";
import { FileTree } from "@/components/FileTree";
import { AIPanel } from "@/components/AIPanel";
import { TerminalPanel } from "@/components/TerminalPanel";
import { SessionSidebar } from "@/components/SessionSidebar";
import { toast } from "sonner";
import {
  ChevronLeft, Copy, Users, SquareTerminal,
  Eye, X, PanelLeft, PanelRight, Loader2, Settings
} from "lucide-react";

/**
 * Encode a Uint8Array to base64.
 * The renderer runs in a sandboxed Chromium context (nodeIntegration: false,
 * sandbox: true) so Node's Buffer is unavailable. We iterate byte-by-byte
 * instead of spreading into String.fromCharCode(), which blows the call stack
 * for large Uint8Arrays (>65 000 bytes typical in Yjs state vectors).
 */
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

const LANG_LABELS: Record<string, string> = {
  javascript: "JS", typescript: "TS", python: "Python",
  go: "Go", rust: "Rust", java: "Java", cpp: "C++",
  html: "HTML", css: "CSS", json: "JSON", markdown: "MD",
  shell: "SH", sql: "SQL", plaintext: "Text",
};

async function fetchCollabToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-guest-token": token,
    };
    // Required by the embedded desktop server's INTERNAL_TOKEN guard
    const internalToken = typeof window !== "undefined" ? window.electronAPI?.getInternalTokenSync() : undefined;
    if (internalToken) headers["X-Internal-Token"] = internalToken;
    const res = await fetch(`${API_BASE}/collab/token`, {
      method: "POST",
      headers,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.token ?? null;
  } catch {
    return null;
  }
}

function getWsUrl(roomId: string, fileId: string, collabToken: string): string {
  // In packaged Electron, window.location is file://, so derive the WS host
  // from the configured API_BASE URL instead of window.location.
  try {
    const apiUrl = new URL(API_BASE);
    const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
    // Strip /api suffix to get the base origin for WS connections
    const wsHost = apiUrl.host;
    const wsPathBase = apiUrl.pathname.replace(/\/api\/?$/, "");
    return `${wsProtocol}//${wsHost}${wsPathBase}/ws/rooms/${roomId}/files/${fileId}?token=${encodeURIComponent(collabToken)}`;
  } catch {
    // Fallback: relative URL using window.location (works in browser/dev)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/ws/rooms/${roomId}/files/${fileId}?token=${encodeURIComponent(collabToken)}`;
  }
}

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

export default function Room({ onOpenSettings, hasApiKeys = true }: { onOpenSettings?: () => void; hasApiKeys?: boolean }) {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId ?? "";
  const [, navigate] = useLocation();
  const currentUser = getCurrentUser();

  const [room, setRoom] = useState<{ id: string; title: string; inviteCode: string; ownerId: string } | null>(null);
  const [files, setFiles] = useState<RoomFile[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showFileTree, setShowFileTree] = useState(true);
  const [showAI, setShowAI] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [bottomTab, setBottomTab] = useState<"terminal" | "preview">("terminal");

  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collabTokenRef = useRef<string | null>(null);

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;

  useEffect(() => {
    if (!getToken()) { navigate("/"); return; }
    loadRoom();
  }, [roomId]);

  async function loadRoom() {
    try {
      setLoadingRoom(true);

      // Fetch collab token alongside room data
      const [roomData, filesData, membersData, collabToken] = await Promise.all([
        api.getRoom(roomId),
        api.getRoomFiles(roomId),
        api.getRoomMembers(roomId),
        fetchCollabToken(),
      ]);

      collabTokenRef.current = collabToken;
      setRoom(roomData);
      setFiles(filesData);
      setMembers(membersData);

      const firstFile = filesData.find((f) => !f.isFolder);
      if (firstFile) {
        setActiveFileId(firstFile.id);
        setFileContents((prev) => ({ ...prev, [firstFile.id]: firstFile.content }));
      }
    } catch {
      toast.error("Failed to load room");
      navigate("/");
    } finally {
      setLoadingRoom(false);
    }
  }

  useEffect(() => {
    if (!activeFileId) return;
    const file = files.find((f) => f.id === activeFileId);
    if (file && !(activeFileId in fileContents)) {
      setFileContents((prev) => ({ ...prev, [activeFileId]: file.content }));
    }
    connectWs(activeFileId);
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [activeFileId]);

  function connectWs(fileId: string) {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const collabToken = collabTokenRef.current;
    if (!collabToken) {
      // No collab token — still allow editing but without real-time sync
      return;
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const ws = new WebSocket(getWsUrl(roomId, fileId, collabToken));
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        // Server sends initial Yjs state on "init"
        if (msg.type === "init" && msg.update) {
          const update = Uint8Array.from(atob(msg.update), (c) => c.charCodeAt(0));
          Y.applyUpdate(ydoc, update);
          const text = ydoc.getText("content").toString();
          if (text && editorRef.current) {
            const editor = editorRef.current;
            const pos = editor.getPosition();
            editor.getModel()?.setValue(text);
            if (pos) editor.setPosition(pos);
            setFileContents((prev) => ({ ...prev, [fileId]: text }));
          }
        }

        // Incremental Yjs updates from other collaborators
        if (msg.type === "yjs-update" && msg.update) {
          const update = Uint8Array.from(atob(msg.update), (c) => c.charCodeAt(0));
          Y.applyUpdate(ydoc, update);
          const text = ydoc.getText("content").toString();
          if (editorRef.current && editorRef.current.getModel()?.getValue() !== text) {
            const editor = editorRef.current;
            const pos = editor.getPosition();
            editor.getModel()?.setValue(text);
            if (pos) editor.setPosition(pos);
          }
          setFileContents((prev) => ({ ...prev, [fileId]: text }));
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => { /* silently handle — reconnect logic could be added */ };
    ws.onclose = () => { if (wsRef.current === ws) wsRef.current = null; };
  }

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.setTheme("vs-dark");
    editor.updateOptions({
      fontSize: 13,
      fontFamily: "'Geist Mono', 'Fira Code', monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      lineHeight: 20,
      padding: { top: 12, bottom: 12 },
      scrollBeyondLastLine: false,
      renderLineHighlight: "gutter",
      cursorBlinking: "smooth",
      smoothScrolling: true,
      bracketPairColorization: { enabled: true },
      wordWrap: "off",
    });
  };

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFileId || value === undefined) return;
    setFileContents((prev) => ({ ...prev, [activeFileId]: value }));

    // Send Yjs update to collaborators
    const ydoc = ydocRef.current;
    const ws = wsRef.current;
    if (ydoc && ws && ws.readyState === WebSocket.OPEN) {
      const yText = ydoc.getText("content");
      // Only update Yjs if content actually differs (prevents echo loops)
      const current = yText.toString();
      if (current !== value) {
        ydoc.transact(() => {
          yText.delete(0, yText.length);
          yText.insert(0, value);
        });
        const update = Y.encodeStateAsUpdate(ydoc);
        const encoded = uint8ArrayToBase64(update);
        ws.send(JSON.stringify({ type: "yjs-update", update: encoded }));
      }
    }

    // Auto-save to DB after 1.5s idle
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await api.updateFile(roomId, activeFileId, { content: value });
        setFiles((prev) => prev.map((f) => f.id === activeFileId ? { ...f, content: value } : f));
      } catch { /* silent */ } finally {
        setSaving(false);
      }
    }, 1500);
  }, [activeFileId, roomId]);

  function handleFileSelect(file: RoomFile) {
    if (file.isFolder) return;
    setActiveFileId(file.id);
    if (!(file.id in fileContents)) {
      setFileContents((prev) => ({ ...prev, [file.id]: file.content }));
    }
  }

  async function handleFileCreate(name: string, parentId?: string, isFolder = false) {
    const path = `/${name}`;
    const language = isFolder ? "folder" : getLanguageFromFilename(name);
    try {
      const file = await api.createFile(roomId, { name, path, language, content: "", parentId, isFolder });
      setFiles((prev) => [...prev, file]);
      if (!isFolder) {
        setActiveFileId(file.id);
        setFileContents((prev) => ({ ...prev, [file.id]: "" }));
      }
    } catch { toast.error("Failed to create file"); }
  }

  async function handleFileDelete(fileId: string) {
    try {
      await api.deleteFile(roomId, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (activeFileId === fileId) {
        const next = files.find((f) => f.id !== fileId && !f.isFolder);
        setActiveFileId(next?.id ?? null);
      }
    } catch { toast.error("Failed to delete file"); }
  }

  function handleAIApply(code: string) {
    if (!editorRef.current || !activeFileId) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const full = editorRef.current.getModel()!.getFullModelRange();
    editorRef.current.executeEdits("ai", [{ range: full, text: code }]);
  }

  function copyInviteCode() {
    if (!room) return;
    navigator.clipboard.writeText(room.inviteCode);
    toast.success("Invite code copied!");
  }

  const currentContent = activeFileId ? (fileContents[activeFileId] ?? "") : "";
  const language = activeFile ? (activeFile.language || getLanguageFromFilename(activeFile.name)) : "plaintext";

  if (loadingRoom) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading room...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--background)" }}>
      {/* Title bar */}
      <div className="flex items-center px-3 border-b shrink-0" style={{ height: "40px", borderColor: "var(--border)", background: "var(--surface)" }}>
        <button onClick={() => navigate("/")} className="flex items-center gap-1 mr-3 hover:opacity-70 transition-opacity" style={{ color: "var(--muted-foreground)" }}>
          <ChevronLeft size={14} />
        </button>
        <span className="font-medium text-sm mr-2 truncate max-w-[200px]" style={{ color: "var(--foreground)" }}>{room?.title}</span>
        {saving && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Saving…</span>}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setShowFileTree((v) => !v)}
            title="Toggle file tree"
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: showFileTree ? "var(--primary)" : "var(--muted-foreground)" }}
          >
            <PanelLeft size={14} />
          </button>
          <button
            onClick={() => setShowAI((v) => !v)}
            title="Toggle AI panel"
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: showAI ? "var(--primary)" : "var(--muted-foreground)" }}
          >
            <PanelRight size={14} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: "var(--border)" }} />
          <button
            onClick={() => { setBottomTab("terminal"); setShowTerminal((v) => !v); setShowPreview(false); }}
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: (showTerminal && bottomTab === "terminal") ? "var(--primary)" : "var(--muted-foreground)" }}
            title="Terminal"
          >
            <SquareTerminal size={14} />
          </button>
          <button
            onClick={() => { setBottomTab("preview"); setShowPreview((v) => !v); setShowTerminal(false); }}
            className="p-1.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: (showPreview && bottomTab === "preview") ? "var(--primary)" : "var(--muted-foreground)" }}
            title="Preview"
          >
            <Eye size={14} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: "var(--border)" }} />
          <div className="flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
            <Users size={12} />
            <span className="text-xs">{members.length}</span>
          </div>
          <button onClick={copyInviteCode} className="p-1.5 rounded hover:opacity-70 transition-opacity" style={{ color: "var(--muted-foreground)" }} title="Copy invite code">
            <Copy size={12} />
          </button>
          {onOpenSettings && (
            <>
              <div className="w-px h-4 mx-1" style={{ background: "var(--border)" }} />
              <button
                onClick={onOpenSettings}
                title={isMac ? "Settings (⌘,)" : "Settings (Ctrl+,)"}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:opacity-80 relative"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
              >
                <Settings size={13} />
                {!hasApiKeys && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Session sidebar (48px icon bar) */}
        <SessionSidebar
          roomId={roomId}
          members={members}
          currentUser={currentUser}
          room={room}
        />

        {/* File tree */}
        {showFileTree && (
          <div className="shrink-0 border-r overflow-hidden flex flex-col" style={{ width: "220px", borderColor: "var(--border)", background: "var(--surface)" }}>
            <FileTree
              files={files}
              activeFileId={activeFileId}
              onSelect={handleFileSelect}
              onCreate={handleFileCreate}
              onDelete={handleFileDelete}
              roomId={roomId}
            />
          </div>
        )}

        {/* Editor + Bottom Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b shrink-0 overflow-x-auto" style={{ borderColor: "var(--border)", background: "var(--surface)", height: "34px" }}>
            {files.filter((f) => !f.isFolder).slice(0, 10).map((file) => (
              <button
                key={file.id}
                onClick={() => handleFileSelect(file)}
                className="flex items-center gap-1.5 px-3 h-full border-r shrink-0 text-xs transition-all hover:opacity-80"
                style={{
                  borderColor: "var(--border)",
                  color: activeFileId === file.id ? "var(--foreground)" : "var(--muted-foreground)",
                  background: activeFileId === file.id ? "var(--background)" : "transparent",
                  borderBottom: activeFileId === file.id ? "1px solid var(--primary)" : "1px solid transparent",
                }}
              >
                {file.name}
                {file.id === activeFileId && (
                  <button onClick={(e) => { e.stopPropagation(); setActiveFileId(null); }} className="ml-1 hover:opacity-70">
                    <X size={10} />
                  </button>
                )}
              </button>
            ))}
          </div>

          {/* Editor + optional bottom panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div style={{ flex: (showTerminal || showPreview) ? "1 1 60%" : "1 1 100%", overflow: "hidden", minHeight: 0 }}>
              {activeFile ? (
                <Editor
                  height="100%"
                  language={language}
                  value={currentContent}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  theme="vs-dark"
                  options={{ automaticLayout: true }}
                />
              ) : (
                <div className="h-full flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
                  <div className="text-center">
                    <p className="text-sm mb-1">No file open</p>
                    <p className="text-xs">Select a file from the tree</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom panel */}
            {(showTerminal || showPreview) && (
              <div className="border-t shrink-0 flex flex-col" style={{ flex: "0 0 240px", borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center gap-2 px-3 border-b shrink-0" style={{ height: "30px", borderColor: "var(--border)" }}>
                  <button
                    onClick={() => { setBottomTab("terminal"); setShowTerminal(true); setShowPreview(false); }}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: bottomTab === "terminal" ? "var(--elevated)" : "transparent", color: bottomTab === "terminal" ? "var(--foreground)" : "var(--muted-foreground)" }}
                  >
                    Terminal
                  </button>
                  <button
                    onClick={() => { setBottomTab("preview"); setShowPreview(true); setShowTerminal(false); }}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: bottomTab === "preview" ? "var(--elevated)" : "transparent", color: bottomTab === "preview" ? "var(--foreground)" : "var(--muted-foreground)" }}
                  >
                    Preview
                  </button>
                  <button onClick={() => { setShowTerminal(false); setShowPreview(false); }} className="ml-auto hover:opacity-70" style={{ color: "var(--muted-foreground)" }}>
                    <X size={12} />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  {showTerminal && (
                    <TerminalPanel roomId={roomId} language={language} code={currentContent} />
                  )}
                  {showPreview && activeFile && (
                    <iframe
                      key={activeFile.id}
                      srcDoc={currentContent}
                      className="w-full h-full"
                      sandbox="allow-scripts"
                      title="preview"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-3 px-3 border-t shrink-0 text-xs" style={{ height: "22px", borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
            {activeFile && (
              <>
                <span>{LANG_LABELS[language] ?? language}</span>
                <span className="w-px h-3" style={{ background: "var(--border)" }} />
                <span>{activeFile.path}</span>
              </>
            )}
            <span className="ml-auto">{saving ? "Saving…" : "Saved"}</span>
          </div>
        </div>

        {/* AI Panel */}
        {showAI && (
          <div className="shrink-0 border-l flex flex-col overflow-hidden" style={{ width: "320px", borderColor: "var(--border)", background: "var(--surface)" }}>
            <AIPanel
              roomId={roomId}
              fileId={activeFileId ?? undefined}
              language={language}
              code={currentContent}
              onApply={handleAIApply}
            />
          </div>
        )}
      </div>
    </div>
  );
}
