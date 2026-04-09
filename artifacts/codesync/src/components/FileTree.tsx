import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FilePlus, FolderPlus } from "lucide-react";
import { useCreateFile, useDeleteFile, useUpdateFile, getGetRoomFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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

interface Props {
  roomId: string;
  files: FileItem[];
  activeFileId: string | null;
  onFileSelect: (file: FileItem) => void;
  onFilesChange: () => void;
  isReadOnly?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  fileId: string;
  fileName: string;
  isFolder: boolean;
}

export function FileTree({ roomId, files, activeFileId, onFileSelect, onFilesChange, isReadOnly = false }: Props) {
  const qc = useQueryClient();
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();
  const updateFile = useUpdateFile();

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
    deleteFile.mutate(
      { roomId, fileId },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          onFilesChange();
        },
      }
    );
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
    if (!name) {
      setRenamingFileId(null);
      return;
    }
    const lang = detectLanguage(name);
    updateFile.mutate(
      { roomId, fileId, data: { name, path: `/${name}`, language: lang } },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          onFilesChange();
        },
        onSettled: () => {
          setRenamingFileId(null);
        },
      }
    );
  }

  function handleCreateFile(parentId?: string | null) {
    if (!newFileName.trim()) {
      setIsCreatingFile(false);
      setNewFileName("");
      setCreatingInFolderId(null);
      return;
    }
    const name = newFileName.trim();
    const lang = detectLanguage(name);
    createFile.mutate(
      { roomId, data: { name, path: `/${name}`, language: lang, parentId: parentId ?? undefined } },
      {
        onSuccess: (file) => {
          void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          const fileItem: FileItem = {
            id: (file as { id: string }).id,
            name: (file as { name: string }).name,
            path: (file as { path: string }).path,
            language: (file as { language: string }).language,
            content: (file as { content?: string }).content ?? "",
            isFolder: (file as { isFolder: boolean }).isFolder,
            parentId: (file as { parentId?: string | null }).parentId,
            roomId: (file as { roomId: string }).roomId,
            createdBy: (file as { createdBy?: string | null }).createdBy,
            createdAt: (file as { createdAt: string }).createdAt,
            updatedAt: (file as { updatedAt: string }).updatedAt,
          };
          onFileSelect(fileItem);
          onFilesChange();
        },
      }
    );
    setIsCreatingFile(false);
    setNewFileName("");
    setCreatingInFolderId(null);
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      setNewFolderName("");
      return;
    }
    const name = newFolderName.trim();
    createFile.mutate(
      { roomId, data: { name, path: `/${name}`, language: "plaintext", isFolder: true } },
      {
        onSuccess: (folder) => {
          void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          onFilesChange();
          setExpandedFolders((prev) => new Set(prev).add((folder as { id: string }).id));
        },
      }
    );
    setIsCreatingFolder(false);
    setNewFolderName("");
  }

  function handleDragStart(e: unknown, fileId: string) {
    if (isReadOnly) return;
    const de = e as React.DragEvent;
    if (de.dataTransfer) {
      de.dataTransfer.setData("text/plain", fileId);
      de.dataTransfer.effectAllowed = "move";
    }
  }

  function handleDragOver(e: React.DragEvent, folderId: string | null) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  }

  function handleDragLeave() {
    setDragOverFolderId(null);
  }

  function handleDrop(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault();
    setDragOverFolderId(null);
    const fileId = e.dataTransfer.getData("text/plain");
    if (!fileId) return;

    const file = files.find((f) => f.id === fileId);
    if (!file || file.isFolder) return;
    if (file.parentId === targetFolderId) return;

    updateFile.mutate(
      { roomId, fileId, data: { parentId: targetFolderId } },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          onFilesChange();
        },
      }
    );
  }

  const rootFiles = files.filter((f) => !f.parentId && !f.isFolder);
  const rootFolders = files.filter((f) => !f.parentId && f.isFolder);

  function renderFileItem(file: FileItem, extraClass = "") {
    const icon = getLangIcon(file.language);
    const isRenaming = renamingFileId === file.id;

    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        className={`file-tree-item ${extraClass} ${activeFileId === file.id ? "active" : ""}`}
        onClick={() => { if (!isRenaming) onFileSelect(file); }}
        onContextMenu={(e) => handleContextMenu(e, file.id, file.name, false)}
        draggable={!isReadOnly && !isRenaming}
        onDragStart={(e) => handleDragStart(e, file.id)}
        data-testid={`file-item-${file.id}`}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: icon.color, fontFamily: "JetBrains Mono, monospace", minWidth: 18 }}>
          {icon.icon}
        </span>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename(file.id);
              if (e.key === "Escape") setRenamingFileId(null);
            }}
            onBlur={() => handleRename(file.id)}
            className="text-xs outline-none rounded px-1"
            style={{
              background: "#0D1117",
              border: "1px solid #58A6FF",
              color: "#E6EDF3",
              fontFamily: "JetBrains Mono, monospace",
              flex: 1,
              minWidth: 0,
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="input-rename-file"
          />
        ) : (
          <span className="text-xs truncate">{file.name}</span>
        )}
      </motion.div>
    );
  }

  function renderNewFileInput(parentId?: string | null) {
    return (
      <div className="px-2 py-1">
        <input
          autoFocus
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateFile(parentId);
            if (e.key === "Escape") { setIsCreatingFile(false); setNewFileName(""); setCreatingInFolderId(null); }
          }}
          onBlur={() => handleCreateFile(parentId)}
          placeholder="имя_файла.ts"
          className="w-full text-xs outline-none rounded px-2 py-1"
          style={{
            background: "#0D1117",
            border: "1px solid #58A6FF",
            color: "#E6EDF3",
            fontFamily: "JetBrains Mono, monospace",
          }}
          data-testid="input-new-file-name"
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full select-none"
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid #30363D", minHeight: 36 }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8B949E" }}>
          Файлы
        </span>
        <div className="flex gap-1">
          {!isReadOnly && (
            <>
              <button
                className="p-1 rounded transition-colors hover:bg-white/10"
                style={{ color: "#8B949E", lineHeight: 0, display: "flex", alignItems: "center" }}
                onClick={() => { setIsCreatingFolder(true); setNewFolderName(""); }}
                title="Новая папка"
                data-testid="btn-new-folder"
              >
                <FolderPlus size={14} />
              </button>
              <button
                className="p-1 rounded transition-colors hover:bg-white/10"
                style={{ color: "#8B949E", lineHeight: 0, display: "flex", alignItems: "center" }}
                onClick={() => { setIsCreatingFile(true); setNewFileName(""); setCreatingInFolderId(null); }}
                title="Новый файл"
                data-testid="btn-new-file"
              >
                <FilePlus size={14} />
              </button>
            </>
          )}
          {isReadOnly && (
            <span className="text-xs px-2" style={{ color: "#8B949E", opacity: 0.6 }}>
              только чтение
            </span>
          )}
        </div>
      </div>

      {/* New folder input */}
      {isCreatingFolder && (
        <div className="px-2 py-1">
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { setIsCreatingFolder(false); setNewFolderName(""); }
            }}
            onBlur={handleCreateFolder}
            placeholder="название_папки"
            className="w-full text-xs outline-none rounded px-2 py-1"
            style={{
              background: "#0D1117",
              border: "1px solid #F2CC60",
              color: "#E6EDF3",
              fontFamily: "JetBrains Mono, monospace",
            }}
            data-testid="input-new-folder-name"
          />
        </div>
      )}

      {/* Files list */}
      <div
        className="flex-1 overflow-y-auto py-1 px-1"
        onDragOver={(e) => handleDragOver(e, null)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
        style={{
          background: dragOverFolderId === null ? undefined : undefined,
        }}
      >
        <AnimatePresence>
          {rootFolders.map((folder) => {
            const children = files.filter((f) => f.parentId === folder.id && !f.isFolder);
            const isExpanded = expandedFolders.has(folder.id);
            const isDragOver = dragOverFolderId === folder.id;
            return (
              <motion.div key={folder.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  className="file-tree-item"
                  onClick={() => toggleFolder(folder.id)}
                  onContextMenu={(e) => handleContextMenu(e, folder.id, folder.name, true)}
                  onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, folder.id); }}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, folder.id); }}
                  style={{
                    background: isDragOver ? "rgba(88, 166, 255, 0.15)" : undefined,
                    borderRadius: 4,
                  }}
                >
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="#8B949E"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                  >
                    <path d="M3 1l4 4-4 4z" />
                  </svg>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="#F2CC60">
                    <path d="M1 3h4l1 1h5v7H1V3z" />
                  </svg>
                  <span className="text-xs">{folder.name}</span>
                  <span className="text-xs ml-auto" style={{ color: "#30363D" }}>{children.length}</span>
                </div>
                {isExpanded && (
                  <>
                    {children.map((child) => renderFileItem(child, "pl-6"))}
                    {isCreatingFile && creatingInFolderId === folder.id && renderNewFileInput(folder.id)}
                  </>
                )}
              </motion.div>
            );
          })}

          {rootFiles.map((file) => renderFileItem(file))}
        </AnimatePresence>

        {isCreatingFile && !creatingInFolderId && renderNewFileInput(null)}

        {files.length === 0 && !isCreatingFile && !isCreatingFolder && (
          <div className="text-center py-6">
            <p className="text-xs" style={{ color: "#8B949E" }}>Нет файлов</p>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 rounded shadow-lg py-1"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#1C2128",
            border: "1px solid #30363D",
            minWidth: 160,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isFolder && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
              style={{ color: "#E6EDF3" }}
              onClick={() => {
                setIsCreatingFile(true);
                setNewFileName("");
                setCreatingInFolderId(contextMenu.fileId);
                setExpandedFolders((prev) => new Set(prev).add(contextMenu.fileId));
                setContextMenu(null);
              }}
            >
              Новый файл в папке
            </button>
          )}
          <button
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
            style={{ color: "#E6EDF3" }}
            onClick={() => startRename(contextMenu.fileId, contextMenu.fileName)}
          >
            Переименовать
          </button>
          <div style={{ borderTop: "1px solid #30363D", margin: "2px 0" }} />
          <button
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors"
            style={{ color: "#FF7B72" }}
            onClick={() => handleDeleteFile(contextMenu.fileId)}
          >
            Удалить {contextMenu.fileName}
          </button>
        </motion.div>
      )}
    </div>
  );
}
