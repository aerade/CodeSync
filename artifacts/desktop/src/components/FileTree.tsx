import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight, ChevronDown, File as FileIcon, Folder, FolderOpen,
  RefreshCw, FilePlus, FolderPlus, Trash2, Pencil,
} from "lucide-react";
import { desktop, type FsNode } from "@/lib/desktopBridge";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";
import * as ContextMenu from "@radix-ui/react-context-menu";

type CtxState = {
  x: number;
  y: number;
  node: FsNode | null;
} | null;

function sortNodes(nodes: FsNode[]): FsNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

export function FileTree({ rootPath }: { rootPath: string }) {
  const [tree, setTree] = useState<FsNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [children, setChildren] = useState<Record<string, FsNode[]>>({});
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState<{ parent: string; type: "file" | "dir" } | null>(null);
  const [createValue, setCreateValue] = useState("");
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const {
    openFile, activeTabId, tabs,
    createFileAt, createDirAt, renamePath, deletePath, movePath,
    treeRefreshKey,
  } = useWorkspace();

  const activeFilePath = tabs.find((t) => t.id === activeTabId)?.filePath ?? null;

  const loadDir = async (path: string): Promise<FsNode[]> => {
    try {
      const items = await desktop().fs.readDir(path);
      return sortNodes(items);
    } catch (err) {
      console.warn("readDir failed", path, err);
      return [];
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    const items = await loadDir(rootPath);
    setTree(items);
    // Перечитываем уже раскрытые директории
    const next: Record<string, FsNode[]> = {};
    for (const path of Object.keys(expanded)) {
      if (expanded[path]) {
        next[path] = await loadDir(path);
      }
    }
    setChildren(next);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, treeRefreshKey]);

  const toggle = async (node: FsNode) => {
    if (!node.isDirectory) {
      openFile(node.path);
      return;
    }
    const willExpand = !expanded[node.path];
    setExpanded((s) => ({ ...s, [node.path]: willExpand }));
    if (willExpand) {
      const items = await loadDir(node.path);
      setChildren((s) => ({ ...s, [node.path]: items }));
    }
  };

  const startRename = (node: FsNode) => {
    setRenamingPath(node.path);
    setRenameValue(node.name);
    setCreating(null);
  };

  const commitRename = async () => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    await renamePath(renamingPath, renameValue.trim());
    setRenamingPath(null);
    setRenameValue("");
  };

  const startCreate = (parent: string, type: "file" | "dir") => {
    setCreating({ parent, type });
    setCreateValue("");
    setRenamingPath(null);
    if (!expanded[parent]) {
      setExpanded((s) => ({ ...s, [parent]: true }));
      loadDir(parent).then((items) => setChildren((s) => ({ ...s, [parent]: items })));
    }
  };

  const commitCreate = async () => {
    if (!creating || !createValue.trim()) {
      setCreating(null);
      return;
    }
    if (creating.type === "file") {
      await createFileAt(creating.parent, createValue.trim());
    } else {
      await createDirAt(creating.parent, createValue.trim());
    }
    setCreating(null);
    setCreateValue("");
  };

  const onDragStart = (e: React.DragEvent, node: FsNode) => {
    setDraggingPath(node.path);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", node.path);
  };

  const onDragOver = (e: React.DragEvent, node: FsNode) => {
    if (!node.isDirectory) return;
    if (draggingPath && (node.path === draggingPath || node.path.startsWith(draggingPath + "/"))) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPath(node.path);
  };

  const onDrop = async (e: React.DragEvent, node: FsNode) => {
    e.preventDefault();
    setDragOverPath(null);
    const src = draggingPath ?? e.dataTransfer.getData("text/plain");
    setDraggingPath(null);
    if (!src || !node.isDirectory) return;
    if (src === node.path || node.path.startsWith(src + "/")) return;
    await movePath(src, node.path);
  };

  const renderNode = (node: FsNode, depth: number) => {
    const isOpen = expanded[node.path];
    const isActive = node.path === activeFilePath;
    const isRenaming = renamingPath === node.path;
    const isDragOver = dragOverPath === node.path;

    return (
      <div key={node.path}>
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div
              draggable={!isRenaming}
              onDragStart={(e) => onDragStart(e, node)}
              onDragOver={(e) => onDragOver(e, node)}
              onDragLeave={() => setDragOverPath(null)}
              onDrop={(e) => onDrop(e, node)}
              className={cn(
                "w-full flex items-center gap-1 h-[26px] px-1.5 text-[13px] text-left hover-row rounded-sm cursor-pointer",
                isActive && "is-active",
                isDragOver && "bg-[#F97316]/10 outline outline-1 outline-[#F97316]/40",
              )}
              style={{ paddingLeft: 6 + depth * 14 }}
              onClick={() => !isRenaming && toggle(node)}
              data-testid={`file-tree-node-${node.name}`}
            >
              {node.isDirectory ? (
                <>
                  {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />}
                  {isOpen ? <FolderOpen className="w-[14px] h-[14px] text-[#F97316] shrink-0" /> : <Folder className="w-[14px] h-[14px] text-[#F97316] shrink-0" />}
                </>
              ) : (
                <>
                  <span className="w-3" />
                  <FileIcon className="w-[14px] h-[14px] text-zinc-500 shrink-0" />
                </>
              )}
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingPath(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-[#0F0F11] border border-[#F97316]/40 rounded px-1 text-[12.5px] text-zinc-100 outline-none"
                  data-testid={`file-tree-rename-${node.name}`}
                />
              ) : (
                <span className="truncate text-zinc-300">{node.name}</span>
              )}
            </div>
          </ContextMenu.Trigger>

          <ContextMenu.Portal>
            <ContextMenu.Content
              className="min-w-[200px] glass rounded-md p-1 text-[13px] text-zinc-200 shadow-xl border border-white/10 z-50"
              data-testid={`file-tree-ctx-${node.name}`}
            >
              {node.isDirectory && (
                <>
                  <ContextMenu.Item
                    onSelect={() => startCreate(node.path, "file")}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/8 cursor-pointer outline-none"
                    data-testid={`ctx-new-file-${node.name}`}
                  >
                    <FilePlus className="w-3.5 h-3.5 text-[#F97316]" /> Новый файл
                  </ContextMenu.Item>
                  <ContextMenu.Item
                    onSelect={() => startCreate(node.path, "dir")}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/8 cursor-pointer outline-none"
                    data-testid={`ctx-new-dir-${node.name}`}
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#F97316]" /> Новая папка
                  </ContextMenu.Item>
                  <ContextMenu.Separator className="h-px bg-white/8 my-1" />
                </>
              )}
              <ContextMenu.Item
                onSelect={() => startRename(node)}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/8 cursor-pointer outline-none"
                data-testid={`ctx-rename-${node.name}`}
              >
                <Pencil className="w-3.5 h-3.5 text-zinc-400" /> Переименовать
              </ContextMenu.Item>
              <ContextMenu.Item
                onSelect={() => {
                  if (window.confirm(`Удалить «${node.name}»?`)) deletePath(node.path);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-red-500/15 text-red-300 cursor-pointer outline-none"
                data-testid={`ctx-delete-${node.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" /> Удалить
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>

        {node.isDirectory && isOpen && (
          <div>
            {creating && creating.parent === node.path && (
              <div className="flex items-center gap-1 h-[24px] px-1.5" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>
                {creating.type === "dir"
                  ? <Folder className="w-[14px] h-[14px] text-[#F97316] shrink-0" />
                  : <FileIcon className="w-[14px] h-[14px] text-zinc-500 shrink-0" />}
                <input
                  autoFocus
                  value={createValue}
                  onChange={(e) => setCreateValue(e.target.value)}
                  onBlur={commitCreate}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitCreate();
                    if (e.key === "Escape") setCreating(null);
                  }}
                  placeholder={creating.type === "file" ? "имя_файла.ts" : "имя-папки"}
                  className="flex-1 bg-[#0F0F11] border border-[#F97316]/40 rounded px-1 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600"
                  data-testid={`file-tree-create-input`}
                />
              </div>
            )}
            {children[node.path]?.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex-1 truncate">{rootPath.split(/[\\/]/).pop() ?? "Проект"}</span>
        <button
          type="button"
          onClick={() => startCreate(rootPath, "file")}
          className="hover:text-zinc-200 p-0.5"
          title="Новый файл"
          data-testid="file-tree-root-new-file"
        >
          <FilePlus className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => startCreate(rootPath, "dir")}
          className="hover:text-zinc-200 p-0.5"
          title="Новая папка"
          data-testid="file-tree-root-new-dir"
        >
          <FolderPlus className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={refresh}
          className="hover:text-zinc-200 p-0.5"
          title="Обновить"
          data-testid="file-tree-refresh"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
        </button>
      </div>

      <div
        className="flex-1 overflow-auto py-1"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={async (e) => {
          e.preventDefault();
          const src = draggingPath ?? e.dataTransfer.getData("text/plain");
          setDraggingPath(null);
          setDragOverPath(null);
          if (!src) return;
          await movePath(src, rootPath);
        }}
      >
        {creating && creating.parent === rootPath && (
          <div className="flex items-center gap-1 h-[24px] px-1.5" style={{ paddingLeft: 6 }}>
            {creating.type === "dir"
              ? <Folder className="w-[14px] h-[14px] text-[#F97316] shrink-0" />
              : <FileIcon className="w-[14px] h-[14px] text-zinc-500 shrink-0" />}
            <input
              autoFocus
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              onBlur={commitCreate}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCreate();
                if (e.key === "Escape") setCreating(null);
              }}
              placeholder={creating.type === "file" ? "имя_файла.ts" : "имя-папки"}
              className="flex-1 bg-[#0F0F11] border border-[#F97316]/40 rounded px-1 text-[12.5px] text-zinc-100 outline-none placeholder:text-zinc-600"
              data-testid="file-tree-create-input-root"
            />
          </div>
        )}
        {tree.length === 0 && !loading && !creating && (
          <div className="px-3 py-4 text-[12px] text-zinc-500">
            Папка пуста или недоступна.
          </div>
        )}
        {tree.map((n) => renderNode(n, 0))}
      </div>
    </div>
  );
}
