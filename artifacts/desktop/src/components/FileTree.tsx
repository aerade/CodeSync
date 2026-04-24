import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  FilePlus, FolderPlus, Trash2, MoreHorizontal,
} from "lucide-react";
import type { File as RoomFile } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  files: RoomFile[];
  activeFileId: string | null;
  onSelect: (file: RoomFile) => void;
  onCreate: (name: string, parentId?: string, isFolder?: boolean) => void;
  onDelete: (fileId: string) => void;
  roomId: string;
}

interface TreeNode {
  file: RoomFile;
  children: TreeNode[];
}

function buildTree(files: RoomFile[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const f of files) map.set(f.id, { file: f, children: [] });
  const roots: TreeNode[] = [];
  for (const f of files) {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.file.isFolder !== b.file.isFolder) return a.file.isFolder ? -1 : 1;
      return a.file.name.localeCompare(b.file.name);
    });
    for (const n of nodes) sort(n.children);
    return nodes;
  };
  return sort(roots);
}

export function FileTree({ files, activeFileId, onSelect, onCreate, onDelete }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState<{ parentId?: string; isFolder: boolean } | null>(null);
  const [newName, setNewName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ fileId: string; x: number; y: number } | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const tree = buildTree(files);

  function toggleFolder(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startCreate(parentId?: string, isFolder = false) {
    setShowNew({ parentId, isFolder });
    setNewName("");
    setContextMenu(null);
    setTimeout(() => newInputRef.current?.focus(), 50);
  }

  function commitCreate() {
    if (newName.trim()) {
      onCreate(newName.trim(), showNew?.parentId, showNew?.isFolder);
    }
    setShowNew(null);
    setNewName("");
  }

  function renderNode(node: TreeNode, depth = 0): React.ReactNode {
    const { file } = node;
    const isExpanded = expanded.has(file.id);
    const isActive = file.id === activeFileId;

    return (
      <div key={file.id}>
        <div
          className={cn(
            "group flex items-center gap-1.5 px-2 py-0.5 rounded-md cursor-pointer text-xs transition-all hover:opacity-90 select-none",
            isActive && "font-medium"
          )}
          style={{
            paddingLeft: `${8 + depth * 12}px`,
            background: isActive ? "rgba(124, 111, 247, 0.12)" : "transparent",
            color: isActive ? "var(--primary)" : "var(--foreground)",
          }}
          onClick={() => {
            if (file.isFolder) toggleFolder(file.id);
            else onSelect(file);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ fileId: file.id, x: e.clientX, y: e.clientY });
          }}
        >
          {file.isFolder ? (
            <>
              {isExpanded ? <ChevronDown size={11} className="shrink-0" /> : <ChevronRight size={11} className="shrink-0" />}
              {isExpanded ? <FolderOpen size={12} className="shrink-0" style={{ color: "#F59E0B" }} /> : <Folder size={12} className="shrink-0" style={{ color: "#F59E0B" }} />}
            </>
          ) : (
            <>
              <span className="w-2.5 shrink-0" />
              <File size={12} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
            </>
          )}
          <span className="truncate flex-1">{file.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setContextMenu({ fileId: file.id, x: e.currentTarget.getBoundingClientRect().right, y: e.currentTarget.getBoundingClientRect().bottom }); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
          >
            <MoreHorizontal size={10} />
          </button>
        </div>

        {file.isFolder && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {showNew?.parentId === file.id && renderNewInput(depth + 1)}
          </div>
        )}
      </div>
    );
  }

  function renderNewInput(depth = 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5" style={{ paddingLeft: `${8 + depth * 12}px` }}>
        {showNew?.isFolder ? <Folder size={12} style={{ color: "#F59E0B" }} /> : <File size={12} style={{ color: "var(--muted-foreground)" }} />}
        <input
          ref={newInputRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitCreate();
            if (e.key === "Escape") { setShowNew(null); setNewName(""); }
          }}
          onBlur={commitCreate}
          className="flex-1 bg-transparent outline-none text-xs border-b"
          style={{ borderColor: "var(--primary)", color: "var(--foreground)" }}
          placeholder={showNew?.isFolder ? "имя-папки" : "файл.расш"}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" onClick={() => setContextMenu(null)}>
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Проводник</span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => startCreate(undefined, false)} className="p-1 rounded hover:opacity-70 transition-opacity" style={{ color: "var(--muted-foreground)" }} title="Новый файл">
            <FilePlus size={12} />
          </button>
          <button onClick={() => startCreate(undefined, true)} className="p-1 rounded hover:opacity-70 transition-opacity" style={{ color: "var(--muted-foreground)" }} title="Новая папка">
            <FolderPlus size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {tree.map((node) => renderNode(node))}
        {showNew && !showNew.parentId && renderNewInput(0)}
        {files.length === 0 && !showNew && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <File size={20} style={{ color: "var(--muted-foreground)" }} />
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Нет файлов</p>
          </div>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed z-50 rounded-lg py-1 shadow-xl min-w-[140px]"
            style={{ top: contextMenu.y, left: contextMenu.x, background: "var(--elevated)", border: "1px solid var(--border)" }}
          >
            {(() => {
              const f = files.find((x) => x.id === contextMenu.fileId);
              if (f?.isFolder) {
                return (
                  <>
                    <button onClick={() => startCreate(f.id, false)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:opacity-80" style={{ color: "var(--foreground)" }}>
                      <FilePlus size={11} /> Новый файл
                    </button>
                    <button onClick={() => startCreate(f.id, true)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:opacity-80" style={{ color: "var(--foreground)" }}>
                      <FolderPlus size={11} /> Новая папка
                    </button>
                    <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
                  </>
                );
              }
              return null;
            })()}
            <button
              onClick={() => { onDelete(contextMenu.fileId); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:opacity-80"
              style={{ color: "#EF4444" }}
            >
              <Trash2 size={11} /> Удалить
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
