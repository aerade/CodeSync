import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FilePlus, FolderPlus, Archive } from "lucide-react";
import { useCreateFile, useDeleteFile, useUpdateFile, getGetRoomFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const LANG_ICONS: Record<string, { icon: string; color: string }> = {
  javascript: { icon: "JS", color: "#F2CC60" },
  typescript: { icon: "TS", color: "#58A6FF" },
  python: { icon: "PY", color: "#3FB950" },
  go: { icon: "GO", color: "#79C0FF" },
  rust: { icon: "RS", color: "#FFA657" },
  java: { icon: "JV", color: "#FF7B72" },
  cpp: { icon: "C+", color: "#D2A8FF" },
  c: { icon: "C", color: "#D2A8FF" },
  csharp: { icon: "C#", color: "#D2A8FF" },
  ruby: { icon: "RB", color: "#FF7B72" },
  php: { icon: "PHP", color: "#79C0FF" },
  html: { icon: "HTM", color: "#FFA657" },
  css: { icon: "CSS", color: "#58A6FF" },
  json: { icon: "{}", color: "#F2CC60" },
  markdown: { icon: "MD", color: "#8B949E" },
  shell: { icon: "$_", color: "#3FB950" },
  bash: { icon: "$_", color: "#3FB950" },
  sql: { icon: "SQL", color: "#79C0FF" },
  plaintext: { icon: "TXT", color: "#8B949E" },
  image: { icon: "IMG", color: "#F78166" },
};

function getLangIcon(language: string) {
  return LANG_ICONS[language] ?? { icon: "•", color: "#8B949E" };
}

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", go: "go", rs: "rust", java: "java", cpp: "cpp", c: "c",
    cs: "csharp", rb: "ruby", php: "php", html: "html", css: "css", json: "json",
    md: "markdown", sh: "shell", bash: "shell", sql: "sql",
    jpg: "image", jpeg: "image", png: "image", gif: "image", svg: "image", webp: "image",
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

interface Props {
  roomId: string;
  files: FileItem[];
  activeFileId: string | null;
  fileStats?: Record<string, FileStatEntry>;
  onFileSelect: (file: FileItem) => void;
  onFilesChange: () => void;
  isReadOnly?: boolean;
}

interface ContextMenuState {
  x: number; y: number; fileId: string; fileName: string; isFolder: boolean;
}

export function FileTree({ roomId, files, activeFileId, fileStats = {}, onFileSelect, onFilesChange, isReadOnly = false }: Props) {
  const qc = useQueryClient();
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();
  const updateFile = useUpdateFile();

  const prevFileIdsRef = useRef<Set<string>>(new Set());
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
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
        setNewlyAddedIds(new Set(added.map((f) => f.id)));
        if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
        newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 3000);
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

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid #58A6FF",
    borderRadius: 7, color: "#E6EDF3", fontFamily: "JetBrains Mono, monospace",
    fontSize: 11, outline: "none", width: "100%", padding: "4px 8px",
  };

  function renderFileItem(file: FileItem, depth = 0) {
    const icon = getLangIcon(file.language);
    const isActive = activeFileId === file.id;
    const isRenaming = renamingFileId === file.id;

    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => { if (!isRenaming) onFileSelect(file); }}
        onContextMenu={(e) => handleContextMenu(e, file.id, file.name, false)}
        draggable={!isReadOnly && !isRenaming}
        onDragStart={(e) => handleDragStart(e, file.id)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "5px 10px", paddingLeft: 10 + depth * 14,
          cursor: "pointer", borderRadius: 7,
          background: isActive ? "rgba(88,166,255,0.1)" : "transparent",
          border: `1px solid ${isActive ? "rgba(88,166,255,0.2)" : "transparent"}`,
          transition: "background 0.12s, border-color 0.12s",
          marginBottom: 1,
        }}
        className={isActive ? "" : "hover:bg-white/4"}
        data-testid={`file-item-${file.id}`}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: icon.color, fontFamily: "JetBrains Mono, monospace", minWidth: 20, textAlign: "center" }}>
          {icon.icon}
        </span>
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
        {/* Newly added indicator */}
        {!isRenaming && newlyAddedIds.has(file.id) && (
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            style={{ fontSize: 9, color: "#3FB950", fontFamily: "JetBrains Mono, monospace", fontWeight: 700, flexShrink: 0 }}
          >
            +1
          </motion.span>
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
            style={{ color: "rgba(255,255,255,0.2)", lineHeight: 0, display: "flex", alignItems: "center", flexShrink: 0, padding: "2px" }}
            title={`Скачать ${file.name}`}
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 hover:!text-white/60 transition-opacity"
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
          {rootFolders.map((folder) => {
            const children = files.filter((f) => f.parentId === folder.id && !f.isFolder);
            const isExpanded = expandedFolders.has(folder.id);
            const isDragOver = dragOverFolderId === folder.id;
            return (
              <motion.div key={folder.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  onClick={() => toggleFolder(folder.id)}
                  onContextMenu={(e) => handleContextMenu(e, folder.id, folder.name, true)}
                  onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, folder.id); }}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, folder.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "5px 10px", borderRadius: 7, cursor: "pointer",
                    background: isDragOver ? "rgba(88,166,255,0.12)" : "transparent",
                    border: `1px solid ${isDragOver ? "rgba(88,166,255,0.3)" : "transparent"}`,
                    marginBottom: 1,
                    transition: "background 0.12s",
                  }}
                  className="hover:bg-white/4"
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
                    {children.map((child) => renderFileItem(child, 1))}
                    {isCreatingFile && creatingInFolderId === folder.id && renderNewFileInput(folder.id)}
                  </AnimatePresence>
                )}
              </motion.div>
            );
          })}

          {rootFiles.map((file) => renderFileItem(file))}
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
