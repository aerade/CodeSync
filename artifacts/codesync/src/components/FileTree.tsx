import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FilePlus, FolderPlus, Archive } from "lucide-react";
import { useCreateFile, useDeleteFile, useUpdateFile, getGetRoomFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Unified file type icons — consistent colored-rect + abbreviation style
function LangIcon({ language }: { language: string }) {
  const s = { width: 16, height: 16, flexShrink: 0 } as const;

  type Cfg = { bg: string; label: string; fg?: string };
  const map: Record<string, Cfg> = {
    javascript: { bg: "#C8961A", label: "JS",   fg: "#fff8e0" },
    jsx:        { bg: "#1792B8", label: "JSX",  fg: "#fff" },
    typescript: { bg: "#2362A4", label: "TS",   fg: "#fff" },
    tsx:        { bg: "#1E518A", label: "TSX",  fg: "#61DAFB" },
    python:     { bg: "#2E6AA6", label: "PY",   fg: "#FFD444" },
    html:       { bg: "#C03A1C", label: "HTML", fg: "#fff" },
    css:        { bg: "#1250A4", label: "CSS",  fg: "#fff" },
    scss:       { bg: "#A0306A", label: "SCSS", fg: "#fff" },
    json:       { bg: "#161B22", label: "{}",   fg: "#F0C040" },
    markdown:   { bg: "#36485A", label: "MD",   fg: "#fff" },
    go:         { bg: "#007898", label: "Go",   fg: "#fff" },
    rust:       { bg: "#9E2818", label: "RS",   fg: "#fff" },
    java:       { bg: "#C05808", label: "JAV",  fg: "#fff" },
    cpp:        { bg: "#3E6888", label: "C++",  fg: "#fff" },
    c:          { bg: "#3840A0", label: "C",    fg: "#fff" },
    csharp:     { bg: "#5A1688", label: "C#",   fg: "#fff" },
    ruby:       { bg: "#901820", label: "RB",   fg: "#fff" },
    php:        { bg: "#585880", label: "PHP",  fg: "#fff" },
    shell:      { bg: "#0a1410", label: "$_",   fg: "#3FB950" },
    bash:       { bg: "#0a1410", label: "$_",   fg: "#3FB950" },
    sql:        { bg: "#1A4870", label: "SQL",  fg: "#fff" },
    yaml:       { bg: "#A81010", label: "YML",  fg: "#fff" },
    vue:        { bg: "#1A5038", label: "VUE",  fg: "#42B883" },
    svelte:     { bg: "#A82400", label: "SV",   fg: "#fff" },
    dockerfile: { bg: "#0B4E9E", label: "DOC",  fg: "#fff" },
    image:      { bg: "#602808", label: "IMG",  fg: "#fff" },
  };

  const { bg, label, fg = "#fff" } = map[language] ?? { bg: "#252D3A", label: "TXT", fg: "rgba(255,255,255,0.55)" };
  const len = label.length;
  const fontSize = len >= 4 ? 4.4 : len === 3 ? 5.5 : len === 1 ? 9 : 7;

  return (
    <svg {...s} viewBox="0 0 16 16">
      <rect width="16" height="16" rx="3" fill={bg}/>
      <rect width="16" height="5" rx="0" fill="rgba(255,255,255,0.06)" style={{ borderRadius: "3px 3px 0 0" }}/>
      <text
        x="8" y="11"
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="700"
        fill={fg}
        fontFamily='"JetBrains Mono","Cascadia Code",monospace'
        letterSpacing="-0.5"
      >
        {label}
      </text>
    </svg>
  );
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const base = filename.toLowerCase();
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return "dockerfile";
  const map: Record<string, string> = {
    js: "javascript", mjs: "javascript", cjs: "javascript",
    jsx: "jsx",
    ts: "typescript", mts: "typescript", cts: "typescript",
    tsx: "tsx",
    py: "python", pyw: "python",
    go: "go",
    rs: "rust",
    java: "java",
    cpp: "cpp", cc: "cpp", cxx: "cpp",
    c: "c", h: "c",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    html: "html", htm: "html",
    css: "css",
    scss: "scss", sass: "scss",
    json: "json", jsonc: "json",
    md: "markdown", mdx: "markdown",
    sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
    sql: "sql",
    yaml: "yaml", yml: "yaml",
    vue: "vue",
    svelte: "svelte",
    jpg: "image", jpeg: "image", png: "image", gif: "image",
    svg: "image", webp: "image", ico: "image", bmp: "image",
  };
  return map[ext] ?? "plaintext";
}

export interface FileItem {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  isFolder: boolean;
  parentId?: string | null;
  roomId: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FileStatEntry {
  added?: number;
  removed?: number;
  errors?: number;
}

interface UserPresenceEntry {
  userId: string;
  username: string;
  color: string;
}

interface Props {
  roomId: string;
  files: FileItem[];
  activeFileId: string | null;
  fileStats?: Record<string, FileStatEntry>;
  userPresence?: Record<string, UserPresenceEntry[]>;
  showFilePresence?: boolean;
  onFileSelect: (file: FileItem) => void;
  onFilesChange: () => void;
  isReadOnly?: boolean;
}

interface ContextMenuState {
  x: number; y: number; fileId: string; fileName: string; isFolder: boolean;
}

export function FileTree({ roomId, files, activeFileId, fileStats = {}, userPresence = {}, showFilePresence = true, onFileSelect, onFilesChange, isReadOnly = false }: Props) {
  const qc = useQueryClient();
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();
  const updateFile = useUpdateFile();

  const prevFileIdsRef = useRef<Set<string>>(new Set());
  const [newlyAddedCount, setNewlyAddedCount] = useState(0);
  const [recentDeletedCount, setRecentDeletedCount] = useState(0);
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prevIds = prevFileIdsRef.current;
    const currentIds = new Set(files.map((f) => f.id));

    if (prevIds.size > 0) {
      const added = files.filter((f) => !prevIds.has(f.id));
      const deletedNum = [...prevIds].filter((id) => !currentIds.has(id)).length;

      if (added.length > 0) {
        setNewlyAddedCount((prev) => prev + added.length);
        if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
        newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedCount(0), 3000);
      }

      if (deletedNum > 0) {
        setRecentDeletedCount((prev) => prev + deletedNum);
        if (deletedTimerRef.current) clearTimeout(deletedTimerRef.current);
        deletedTimerRef.current = setTimeout(() => setRecentDeletedCount(0), 3000);
      }
    }

    prevFileIdsRef.current = currentIds;
  }, [files]);

  useEffect(() => {
    return () => {
      if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
      if (deletedTimerRef.current) clearTimeout(deletedTimerRef.current);
    };
  }, []);

  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [creatingInFolderId, setCreatingInFolderId] = useState<string | null>(null);

  function toggleFolder(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function handleContextMenu(e: React.MouseEvent, fileId: string, fileName: string, isFolder: boolean) {
    e.preventDefault();
    if (isReadOnly) return;
    setContextMenu({ x: e.clientX, y: e.clientY, fileId, fileName, isFolder });
  }

  function handleDeleteFile(fileId: string) {
    deleteFile.mutate({ roomId, fileId }, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
        onFilesChange();
      },
    });
    setContextMenu(null);
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(`Удалить ${ids.length} файл${ids.length > 1 ? "а/ов" : ""}?`);
    if (!confirmed) return;
    setSelectedFileIds(new Set());
    for (const fileId of ids) {
      deleteFile.mutate({ roomId, fileId }, {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          onFilesChange();
        },
      });
    }
  }

  // Returns all visible items in render order (for range selection)
  function getVisibleItems(): FileItem[] {
    const result: FileItem[] = [];
    const rFolders = files.filter((f) => !f.parentId && f.isFolder);
    const rFiles = files.filter((f) => !f.parentId && !f.isFolder);
    for (const folder of rFolders) {
      result.push(folder);
      if (expandedFolders.has(folder.id)) {
        const children = files.filter((f) => f.parentId === folder.id && !f.isFolder);
        result.push(...children);
      }
    }
    result.push(...rFiles);
    return result;
  }

  function handleItemClick(e: React.MouseEvent, item: FileItem) {
    e.preventDefault();
    if (e.shiftKey && lastClickedIdRef.current) {
      // Range selection from last clicked to current
      const visibleItems = getVisibleItems();
      const lastIdx = visibleItems.findIndex((f) => f.id === lastClickedIdRef.current);
      const currentIdx = visibleItems.findIndex((f) => f.id === item.id);
      if (lastIdx !== -1 && currentIdx !== -1) {
        const from = Math.min(lastIdx, currentIdx);
        const to = Math.max(lastIdx, currentIdx);
        const rangeIds = new Set(visibleItems.slice(from, to + 1).map((f) => f.id));
        setSelectedFileIds(rangeIds);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle individual item
      lastClickedIdRef.current = item.id;
      setSelectedFileIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    } else {
      // Regular click
      lastClickedIdRef.current = item.id;
      setSelectedFileIds(new Set());
      if (!item.isFolder) onFileSelect(item);
      else toggleFolder(item.id);
    }
  }

  // Kept for backward compat — used by renderFileItem
  function handleFileClick(e: React.MouseEvent, file: FileItem) {
    handleItemClick(e, file);
  }

  function startRename(fileId: string, currentName: string) {
    setRenamingFileId(fileId);
    setRenameValue(currentName);
    setContextMenu(null);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }

  function handleRename(fileId: string) {
    const name = renameValue.trim();
    if (!name) { setRenamingFileId(null); return; }
    const lang = detectLanguage(name);
    updateFile.mutate({ roomId, fileId, data: { name, path: `/${name}`, language: lang } }, {
      onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) }); onFilesChange(); },
      onSettled: () => { setRenamingFileId(null); },
    });
  }

  function handleCreateFile(parentId?: string | null) {
    if (!newFileName.trim()) { setIsCreatingFile(false); setNewFileName(""); setCreatingInFolderId(null); return; }
    const name = newFileName.trim();
    const lang = detectLanguage(name);
    createFile.mutate({ roomId, data: { name, path: `/${name}`, language: lang, parentId: parentId ?? undefined } }, {
      onSuccess: (file) => {
        void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
        const fileItem: FileItem = {
          id: (file as { id: string }).id, name: (file as { name: string }).name,
          path: (file as { path: string }).path, language: (file as { language: string }).language,
          content: (file as { content?: string }).content ?? "", isFolder: (file as { isFolder: boolean }).isFolder,
          parentId: (file as { parentId?: string | null }).parentId, roomId: (file as { roomId: string }).roomId,
          createdBy: (file as { createdBy?: string | null }).createdBy,
          createdAt: (file as { createdAt: string }).createdAt, updatedAt: (file as { updatedAt: string }).updatedAt,
        };
        onFileSelect(fileItem);
        onFilesChange();
      },
    });
    setIsCreatingFile(false); setNewFileName(""); setCreatingInFolderId(null);
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) { setIsCreatingFolder(false); setNewFolderName(""); return; }
    const name = newFolderName.trim();
    createFile.mutate({ roomId, data: { name, path: `/${name}`, language: "plaintext", isFolder: true } }, {
      onSuccess: (folder) => {
        void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
        onFilesChange();
        setExpandedFolders((prev) => new Set(prev).add((folder as { id: string }).id));
      },
    });
    setIsCreatingFolder(false); setNewFolderName("");
  }

  function handleDragStart(e: unknown, fileId: string) {
    if (isReadOnly) return;
    const de = e as React.DragEvent;
    if (de.dataTransfer) { de.dataTransfer.setData("text/plain", fileId); de.dataTransfer.effectAllowed = "move"; }
  }

  function handleDragOver(e: React.DragEvent, folderId: string | null) {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolderId(folderId);
  }

  function handleDragLeave() { setDragOverFolderId(null); }

  function handleDrop(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault(); setDragOverFolderId(null);
    const fileId = e.dataTransfer.getData("text/plain");
    if (!fileId) return;
    const file = files.find((f) => f.id === fileId);
    if (!file || file.isFolder || file.parentId === targetFolderId) return;
    updateFile.mutate({ roomId, fileId, data: { parentId: targetFolderId } }, {
      onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) }); onFilesChange(); },
    });
  }

  const rootFiles = files.filter((f) => !f.parentId && !f.isFolder);
  const rootFolders = files.filter((f) => !f.parentId && f.isFolder);
  const visItems = getVisibleItems();

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid #58A6FF",
    borderRadius: 7, color: "#E6EDF3", fontFamily: "JetBrains Mono, monospace",
    fontSize: 11, outline: "none", width: "100%", padding: "4px 8px",
  };

  function renderFileItem(file: FileItem, depth = 0, visItems?: FileItem[]) {
    const isActive = activeFileId === file.id;
    const isRenaming = renamingFileId === file.id;
    const isSelected = selectedFileIds.has(file.id);

    // Block-selection: compute adjacent selection for unified rect look
    // Active file is treated same as selected for adjacency purposes
    const isHighlighted = isActive || isSelected;
    const vi = visItems ?? [];
    const visIdx = vi.findIndex((v) => v.id === file.id);
    const prevHighlighted = isHighlighted && visIdx > 0 &&
      (selectedFileIds.has(vi[visIdx - 1]?.id ?? "") || activeFileId === vi[visIdx - 1]?.id);
    const nextHighlighted = isHighlighted && visIdx >= 0 && visIdx < vi.length - 1 &&
      (selectedFileIds.has(vi[visIdx + 1]?.id ?? "") || activeFileId === vi[visIdx + 1]?.id);

    const selRadius = isHighlighted
      ? `${prevHighlighted ? 0 : 6}px ${prevHighlighted ? 0 : 6}px ${nextHighlighted ? 0 : 6}px ${nextHighlighted ? 0 : 6}px`
      : "6px";

    const bg = isSelected && isActive
      ? "rgba(88,166,255,0.24)"
      : isSelected
        ? "rgba(88,166,255,0.16)"
        : isActive
          ? "rgba(88,166,255,0.18)"
          : "transparent";

    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (!isRenaming) handleFileClick(e, file); }}
        onContextMenu={(e) => handleContextMenu(e, file.id, file.name, false)}
        draggable={!isReadOnly && !isRenaming}
        onDragStart={(e) => handleDragStart(e, file.id)}
        className="file-tree-item"
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "4px 10px", paddingLeft: 10 + depth * 14,
          cursor: "pointer", borderRadius: selRadius,
          background: bg,
          border: "none",
          transition: "background 0.1s",
          marginBottom: nextHighlighted ? 0 : 1,
        }}
        onMouseEnter={(e) => { if (!isHighlighted) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = bg; }}
        data-testid={`file-item-${file.id}`}
      >
        <LangIcon language={file.language} />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(file.id); if (e.key === "Escape") setRenamingFileId(null); }}
            onBlur={() => handleRename(file.id)}
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            onClick={(e) => e.stopPropagation()}
            data-testid="input-rename-file"
          />
        ) : (
          <span className="text-xs truncate flex-1" style={{ color: isActive ? "#E6EDF3" : "rgba(255,255,255,0.65)" }}>
            {file.name}
          </span>
        )}
        {/* User presence dots */}
        {showFilePresence && !isRenaming && userPresence[file.id] && userPresence[file.id].length > 0 && (
          <span style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
            {userPresence[file.id].slice(0, 3).map((u) => (
              <span
                key={u.userId}
                title={u.username}
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: u.color, flexShrink: 0,
                  boxShadow: `0 0 4px ${u.color}60`,
                }}
              />
            ))}
          </span>
        )}
        {/* AI edit stats indicator */}
        {!isRenaming && fileStats[file.id] && (
          <span style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0, marginRight: 2 }}>
            {(fileStats[file.id].added ?? 0) > 0 && (
              <span style={{ fontSize: 9, color: "#3FB950", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                +{fileStats[file.id].added}
              </span>
            )}
            {(fileStats[file.id].removed ?? 0) > 0 && (
              <span style={{ fontSize: 9, color: "#F78166", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>
                -{fileStats[file.id].removed}
              </span>
            )}
            {(fileStats[file.id].errors ?? 0) > 0 && (
              <span style={{ fontSize: 9, color: "#F85149", background: "rgba(248,81,73,0.15)", padding: "0 3px", borderRadius: 3, fontWeight: 700 }}>
                ✗{fileStats[file.id].errors}
              </span>
            )}
          </span>
        )}
        {!isRenaming && (
          <a
            href={`${basePath}/api/rooms/${roomId}/files/${file.id}/download`}
            download={file.name}
            style={{ color: "rgba(255,255,255,0.18)", lineHeight: 0, display: "flex", alignItems: "center", flexShrink: 0, padding: "2px" }}
            title={`Скачать ${file.name}`}
            onClick={(e) => e.stopPropagation()}
            className="file-download-btn"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.47 10.78a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0-1.06-1.06L8.75 8.44V1.75a.75.75 0 0 0-1.5 0v6.69L4.78 5.97a.75.75 0 0 0-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5z"/>
            </svg>
          </a>
        )}
      </motion.div>
    );
  }

  function renderNewFileInput(parentId?: string | null) {
    return (
      <div style={{ padding: "4px 10px" }}>
        <input
          autoFocus value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateFile(parentId);
            if (e.key === "Escape") { setIsCreatingFile(false); setNewFileName(""); setCreatingInFolderId(null); }
          }}
          onBlur={() => handleCreateFile(parentId)}
          placeholder="имя_файла.ts"
          style={inputStyle}
          data-testid="input-new-file-name"
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: "#0e0e0e" }}
      onClick={() => setContextMenu(null)}
    >
      {/* Section header */}
      <div style={{ padding: "10px 12px 6px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>
              Файлы
            </span>
            <AnimatePresence>
              {newlyAddedCount > 0 && (
                <motion.span
                  key="added-badge"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  style={{ fontSize: 9, color: "#3FB950", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}
                >
                  +{newlyAddedCount}
                </motion.span>
              )}
              {recentDeletedCount > 0 && (
                <motion.span
                  key="deleted-badge"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  style={{ fontSize: 9, color: "#F78166", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}
                >
                  -{recentDeletedCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {!isReadOnly && (
              <>
                <button
                  onClick={() => { setIsCreatingFolder(true); setNewFolderName(""); }}
                  title="Новая папка"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "3px 4px", borderRadius: 5, lineHeight: 0 }}
                  className="hover:!text-white/60 transition-colors"
                  data-testid="btn-new-folder"
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  onClick={() => { setIsCreatingFile(true); setNewFileName(""); setCreatingInFolderId(null); }}
                  title="Новый файл"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "3px 4px", borderRadius: 5, lineHeight: 0 }}
                  className="hover:!text-white/60 transition-colors"
                  data-testid="btn-new-file"
                >
                  <FilePlus size={13} />
                </button>
              </>
            )}
            <a
              href={`${basePath}/api/rooms/${roomId}/download`}
              download
              title="Скачать всё (ZIP)"
              style={{ color: "rgba(255,255,255,0.3)", padding: "3px 4px", lineHeight: 0, display: "flex", alignItems: "center", borderRadius: 5 }}
              className="hover:!text-white/60 transition-colors"
              data-testid="btn-download-zip"
            >
              <Archive size={13} />
            </a>
          </div>
        </div>
        {isReadOnly && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>только чтение</p>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedFileIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ flexShrink: 0, overflow: "hidden" }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px",
              background: "rgba(255,123,114,0.07)",
              borderBottom: "1px solid rgba(255,123,114,0.15)",
            }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", flex: 1 }}>
                {selectedFileIds.size} выбрано
              </span>
              <button
                onClick={handleBulkDelete}
                style={{
                  fontSize: 10, color: "#FF7B72",
                  background: "rgba(255,123,114,0.1)", border: "1px solid rgba(255,123,114,0.2)",
                  borderRadius: 5, padding: "2px 8px", cursor: "pointer",
                }}
              >
                Удалить
              </button>
              <button
                onClick={() => setSelectedFileIds(new Set())}
                style={{
                  fontSize: 10, color: "rgba(255,255,255,0.35)",
                  background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px",
                }}
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New folder input */}
      {isCreatingFolder && (
        <div style={{ padding: "4px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <input
            autoFocus value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
            }}
            onBlur={handleCreateFolder}
            placeholder="название_папки"
            style={{ ...inputStyle, borderColor: "#F2CC60" }}
            data-testid="input-new-folder-name"
          />
        </div>
      )}

      {/* File list */}
      <div
        className="flex-1 overflow-y-auto py-2 px-1"
        onDragOver={(e) => handleDragOver(e, null)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <AnimatePresence>
          {rootFolders.map((folder, fi) => {
            const children = files.filter((f) => f.parentId === folder.id && !f.isFolder);
            const isExpanded = expandedFolders.has(folder.id);
            const isDragOver = dragOverFolderId === folder.id;
            const isFolSel = selectedFileIds.has(folder.id);
            // Block-selection for folder row
            const fvi = visItems.findIndex((v) => v.id === folder.id);
            const fPrevSel = isFolSel && fvi > 0 && selectedFileIds.has(visItems[fvi - 1]?.id ?? "");
            const fNextSel = isFolSel && fvi >= 0 && fvi < visItems.length - 1 && selectedFileIds.has(visItems[fvi + 1]?.id ?? "");
            const folRadius = isFolSel ? `${fPrevSel ? 0 : 6}px ${fPrevSel ? 0 : 6}px ${fNextSel ? 0 : 6}px ${fNextSel ? 0 : 6}px` : "6px";
            void fi;
            return (
              <motion.div key={folder.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  onClick={(e) => handleItemClick(e, folder)}
                  onContextMenu={(e) => handleContextMenu(e, folder.id, folder.name, true)}
                  onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, folder.id); }}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, folder.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "4px 10px", paddingLeft: isFolSel ? 10 : 12,
                    borderRadius: folRadius, cursor: "pointer",
                    background: isDragOver
                      ? "rgba(88,166,255,0.12)"
                      : isFolSel
                        ? "rgba(88,166,255,0.16)"
                        : "transparent",
                    borderLeft: isFolSel ? "2px solid rgba(88,166,255,0.4)" : "2px solid transparent",
                    marginBottom: fNextSel ? 0 : 1,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (!isFolSel && !isDragOver) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isDragOver ? "rgba(88,166,255,0.12)" : isFolSel ? "rgba(88,166,255,0.16)" : "transparent"; }}
                >
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="rgba(255,255,255,0.4)"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                    <path d="M3 1l4 4-4 4z" />
                  </svg>
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="#F2CC60" style={{ flexShrink: 0 }}>
                    <path d="M1 3h4l1 1h5v7H1V3z" />
                  </svg>
                  <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.65)" }}>{folder.name}</span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{children.length}</span>
                </div>
                {isExpanded && (
                  <AnimatePresence>
                    {children.map((child) => renderFileItem(child, 1, visItems))}
                    {isCreatingFile && creatingInFolderId === folder.id && renderNewFileInput(folder.id)}
                  </AnimatePresence>
                )}
              </motion.div>
            );
          })}

          {rootFiles.map((file) => renderFileItem(file, 0, visItems))}
        </AnimatePresence>

        {isCreatingFile && !creatingInFolderId && renderNewFileInput(null)}

        {files.length === 0 && !isCreatingFile && !isCreatingFolder && (
          <div style={{ textAlign: "center", paddingTop: 32, paddingBottom: 16 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)" }}>Нет файлов</p>
            {!isReadOnly && (
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", marginTop: 6 }}>Нажмите + чтобы создать</p>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 py-1 rounded-xl"
          style={{
            top: contextMenu.y, left: contextMenu.x,
            background: "rgba(10,10,14,0.97)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            minWidth: 160,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isFolder && (
            <button
              className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
              style={{ color: "rgba(255,255,255,0.75)", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => {
                setIsCreatingFile(true); setNewFileName("");
                setCreatingInFolderId(contextMenu.fileId);
                setExpandedFolders((prev) => new Set(prev).add(contextMenu.fileId));
                setContextMenu(null);
              }}
            >
              Новый файл в папке
            </button>
          )}
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
            style={{ color: "rgba(255,255,255,0.75)", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => startRename(contextMenu.fileId, contextMenu.fileName)}
          >
            Переименовать
          </button>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "3px 0" }} />
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors"
            style={{ color: "#FF7B72", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => handleDeleteFile(contextMenu.fileId)}
          >
            Удалить
          </button>
        </motion.div>
      )}
    </div>
  );
}
