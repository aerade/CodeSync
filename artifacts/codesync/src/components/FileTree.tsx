import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateFile, useDeleteFile, getGetRoomFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const LANG_ICONS: Record<string, { icon: string; color: string }> = {
  javascript: { icon: "JS", color: "#F2CC60" },
  typescript: { icon: "TS", color: "#58A6FF" },
  python: { icon: "PY", color: "#3FB950" },
  go: { icon: "GO", color: "#79C0FF" },
  rust: { icon: "RS", color: "#FFA657" },
  java: { icon: "☕", color: "#FF7B72" },
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

interface FileItem {
  id: string;
  name: string;
  path: string;
  language: string;
  isFolder: boolean;
  parentId?: string | null;
}

interface Props {
  roomId: string;
  files: FileItem[];
  activeFileId: string | null;
  onFileSelect: (file: FileItem) => void;
  onFilesChange: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  fileId: string;
  fileName: string;
}

export function FileTree({ roomId, files, activeFileId, onFileSelect, onFilesChange }: Props) {
  const qc = useQueryClient();
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  function handleContextMenu(e: React.MouseEvent, fileId: string, fileName: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileId, fileName });
  }

  function handleDeleteFile(fileId: string) {
    deleteFile.mutate(
      { roomId, fileId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          onFilesChange();
        },
      }
    );
    setContextMenu(null);
  }

  function handleCreateFile() {
    if (!newFileName.trim()) {
      setIsCreatingFile(false);
      setNewFileName("");
      return;
    }
    const name = newFileName.trim();
    const lang = detectLanguage(name);
    createFile.mutate(
      { roomId, data: { name, path: `/${name}`, language: lang } },
      {
        onSuccess: (file) => {
          qc.invalidateQueries({ queryKey: getGetRoomFilesQueryKey(roomId) });
          onFileSelect(file as any);
          onFilesChange();
        },
      }
    );
    setIsCreatingFile(false);
    setNewFileName("");
  }

  const rootFiles = files.filter((f) => !f.parentId && !f.isFolder);
  const rootFolders = files.filter((f) => !f.parentId && f.isFolder);

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
          <button
            className="px-1.5 py-0.5 rounded text-xs transition-colors hover:bg-white/5"
            style={{ color: "#8B949E" }}
            onClick={() => { setIsCreatingFile(true); setNewFileName(""); }}
            title="Новый файл"
            data-testid="btn-new-file"
          >
            +
          </button>
        </div>
      </div>

      {/* Files list */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        <AnimatePresence>
          {rootFolders.map((folder) => {
            const children = files.filter((f) => f.parentId === folder.id);
            return (
              <motion.div key={folder.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div
                  className="file-tree-item"
                  onContextMenu={(e) => handleContextMenu(e, folder.id, folder.name)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="#F2CC60">
                    <path d="M1 3h4l1 1h5v7H1V3z" />
                  </svg>
                  <span className="text-xs">{folder.name}</span>
                </div>
                {children.map((child) => {
                  const icon = getLangIcon(child.language);
                  return (
                    <div
                      key={child.id}
                      className={`file-tree-item pl-6 ${activeFileId === child.id ? "active" : ""}`}
                      onClick={() => onFileSelect(child)}
                      onContextMenu={(e) => handleContextMenu(e, child.id, child.name)}
                      data-testid={`file-item-${child.id}`}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: icon.color, fontFamily: "JetBrains Mono, monospace", minWidth: 16 }}>
                        {icon.icon}
                      </span>
                      <span className="text-xs truncate">{child.name}</span>
                    </div>
                  );
                })}
              </motion.div>
            );
          })}

          {rootFiles.map((file) => {
            const icon = getLangIcon(file.language);
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`file-tree-item ${activeFileId === file.id ? "active" : ""}`}
                onClick={() => onFileSelect(file)}
                onContextMenu={(e) => handleContextMenu(e, file.id, file.name)}
                data-testid={`file-item-${file.id}`}
              >
                <span style={{ fontSize: 9, fontWeight: 700, color: icon.color, fontFamily: "JetBrains Mono, monospace", minWidth: 18 }}>
                  {icon.icon}
                </span>
                <span className="text-xs truncate">{file.name}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isCreatingFile && (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile();
                if (e.key === "Escape") { setIsCreatingFile(false); setNewFileName(""); }
              }}
              onBlur={handleCreateFile}
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
        )}

        {files.length === 0 && !isCreatingFile && (
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
            minWidth: 140,
          }}
          onClick={(e) => e.stopPropagation()}
        >
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
