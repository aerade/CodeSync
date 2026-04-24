import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, File as FileIcon, Folder, FolderOpen, RefreshCw } from "lucide-react";
import { desktop, type FsNode } from "@/lib/desktopBridge";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/store/workspace";

type Node = FsNode & { children?: Node[]; loaded?: boolean; expanded?: boolean };

function sortNodes(nodes: FsNode[]): FsNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

export function FileTree({ rootPath }: { rootPath: string }) {
  const [tree, setTree] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [children, setChildren] = useState<Record<string, FsNode[]>>({});
  const { openFile, activeTabId, tabs } = useWorkspace();

  const activeFilePath = tabs.find((t) => t.id === activeTabId)?.filePath ?? null;

  const loadDir = async (path: string) => {
    try {
      const items = await desktop().fs.readDir(path);
      return sortNodes(items);
    } catch (err) {
      console.warn("readDir failed", path, err);
      return [];
    }
  };

  const refresh = async () => {
    setLoading(true);
    const items = await loadDir(rootPath);
    setTree(items as Node[]);
    setExpanded({});
    setChildren({});
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath]);

  const toggle = async (node: FsNode) => {
    if (!node.isDirectory) {
      openFile(node.path);
      return;
    }
    const willExpand = !expanded[node.path];
    setExpanded((s) => ({ ...s, [node.path]: willExpand }));
    if (willExpand && !children[node.path]) {
      const items = await loadDir(node.path);
      setChildren((s) => ({ ...s, [node.path]: items }));
    }
  };

  const renderNode = (node: FsNode, depth: number) => {
    const isOpen = expanded[node.path];
    const isActive = node.path === activeFilePath;
    return (
      <div key={node.path}>
        <button
          type="button"
          onClick={() => toggle(node)}
          className={cn(
            "w-full flex items-center gap-1 h-[26px] px-1.5 text-[13px] text-left hover-row rounded-sm",
            isActive && "is-active",
          )}
          style={{ paddingLeft: 6 + depth * 14 }}
          data-testid={`file-tree-node-${node.name}`}
        >
          {node.isDirectory ? (
            <>
              {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" /> : <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />}
              {isOpen ? <FolderOpen className="w-[14px] h-[14px] text-[#8B7DE9] shrink-0" /> : <Folder className="w-[14px] h-[14px] text-[#8B7DE9] shrink-0" />}
            </>
          ) : (
            <>
              <span className="w-3" />
              <FileIcon className="w-[14px] h-[14px] text-zinc-500 shrink-0" />
            </>
          )}
          <span className="truncate text-zinc-300">{node.name}</span>
        </button>
        {node.isDirectory && isOpen && children[node.path] && (
          <div>{children[node.path].map((c) => renderNode(c, depth + 1))}</div>
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
          onClick={refresh}
          className="hover:text-zinc-200 p-0.5"
          title="Обновить"
          data-testid="file-tree-refresh"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
        </button>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {tree.length === 0 && !loading && (
          <div className="px-3 py-4 text-[12px] text-zinc-500">
            Папка пуста или недоступна.
          </div>
        )}
        {tree.map((n) => renderNode(n, 0))}
      </div>
    </div>
  );
}
