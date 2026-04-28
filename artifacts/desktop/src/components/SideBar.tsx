import {
  FolderOpen, Plus, Users, Search as SearchIcon, GitBranch, Package,
  Wifi, WifiOff, RefreshCw, FileIcon, LogIn, Hash,
} from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { FileTree } from "@/components/FileTree";
import { desktop, isElectron, type Project } from "@/lib/desktopBridge";
import { apiFetch } from "@/lib/apiConfig";
import { log } from "@/lib/logger";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";

export function SideBar() {
  const { activitySection } = useWorkspace();

  return (
    <aside className="w-[260px] shrink-0 bg-[#0F0F11] border-r border-white/5 flex flex-col">
      {activitySection === "files" && <FilesSection />}
      {activitySection === "search" && <SearchSection />}
      {activitySection === "rooms" && <RoomsSection />}
      {activitySection === "git" && <GitSection />}
      {activitySection === "extensions" && <ExtensionsSection />}
    </aside>
  );
}

function FilesSection() {
  const { currentProject, openProject, addRecentProject, recentProjects } = useWorkspace();
  const native = isElectron();

  const handleOpenFolder = async () => {
    const path = native ? await desktop().fs.pickDirectory() : window.prompt("Введите путь к папке проекта", "/home/user/project");
    if (!path) return;
    const project: Project = {
      id: nanoid(10),
      name: path.split(/[\\/]/).pop() ?? path,
      path,
      type: "local",
      lastOpenedAt: Date.now(),
    };
    await addRecentProject(project);
    await openProject(project);
  };

  if (!currentProject || currentProject.type !== "local") {
    return (
      <div className="flex flex-col h-full">
        <div className="panel-header">Проводник</div>
        <div className="p-3 space-y-3 text-[13px]">
          <p className="text-zinc-400 leading-relaxed">
            Откройте папку проекта или подключитесь к облачной комнате.
          </p>
          <button
            type="button"
            onClick={handleOpenFolder}
            className="w-full h-8 rounded-md bg-[#F97316] hover:bg-[#FB923C] text-[#1C0A00] font-medium text-[13px] transition-colors flex items-center justify-center gap-1.5"
            data-testid="sidebar-open-folder"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Открыть папку
          </button>
          {recentProjects.length > 0 && (
            <div>
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1.5 mt-3">Последние</div>
              <div className="space-y-0.5">
                {recentProjects.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProject(p)}
                    className="w-full h-7 px-2 text-left text-[12.5px] hover-row rounded-sm flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200"
                    data-testid={`sidebar-recent-${p.id}`}
                  >
                    {p.type === "cloud"
                      ? <Users className="w-3 h-3 shrink-0 text-[#F97316]" />
                      : <FolderOpen className="w-3 h-3 shrink-0 text-[#F97316]" />}
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <FileTree rootPath={currentProject.path} />;
}

function SearchSection() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ path: string; line: number; preview: string }>>([]);
  const [loading, setLoading] = useState(false);
  const { currentProject, openFile } = useWorkspace();

  const search = useCallback(async () => {
    if (!query.trim() || !currentProject || currentProject.type !== "local") return;
    setLoading(true);
    setResults([]);
    try {
      // Простой поиск — рекурсивный обход FS. Достаточно быстрый для проектов
      // типичного размера, без зависимостей вроде ripgrep. Игнорируется список IGNORED.
      const found: Array<{ path: string; line: number; preview: string }> = [];
      const q = query.toLowerCase();
      const visit = async (dir: string, depth: number) => {
        if (depth > 6 || found.length >= 200) return;
        const items = await desktop().fs.readDir(dir).catch(() => []);
        for (const item of items) {
          if (found.length >= 200) return;
          if (item.isDirectory) {
            await visit(item.path, depth + 1);
          } else {
            if ((item.size ?? 0) > 256 * 1024) continue;
            try {
              const content = await desktop().fs.readFile(item.path);
              const lines = content.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(q)) {
                  found.push({ path: item.path, line: i + 1, preview: lines[i].trim().slice(0, 120) });
                  if (found.length >= 200) break;
                }
              }
            } catch {
              /* skip binary / unreadable */
            }
          }
        }
      };
      await visit(currentProject.path, 0);
      setResults(found);
    } finally {
      setLoading(false);
    }
  }, [query, currentProject]);

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">Поиск</div>
      <div className="p-2.5 space-y-2">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="Поиск по проекту"
            className="w-full h-8 pl-7 pr-2 rounded-md bg-[#131316] border border-white/8 text-[13px] focus-ring placeholder:text-zinc-500"
            data-testid="sidebar-search-input"
          />
        </div>
        {!currentProject || currentProject.type !== "local" ? (
          <p className="text-[12px] text-zinc-500 px-1 leading-relaxed">
            Откройте папку проекта, чтобы выполнять поиск.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={search}
              disabled={loading || !query.trim()}
              className="w-full h-7 rounded-md bg-[#18181B] border border-white/8 hover:bg-[#1F1F23] text-zinc-300 text-[12px] disabled:opacity-50"
              data-testid="sidebar-search-go"
            >
              {loading ? "Поиск…" : "Найти"}
            </button>
            <div className="text-[11px] text-zinc-500 px-1">
              {results.length > 0 && `Найдено: ${results.length}`}
            </div>
          </>
        )}
      </div>
      <div className="flex-1 overflow-auto px-1">
        {results.map((r, i) => (
          <button
            key={`${r.path}:${r.line}:${i}`}
            type="button"
            onClick={() => openFile(r.path)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-[12px]"
            data-testid={`search-result-${i}`}
          >
            <div className="text-zinc-400 truncate">
              {r.path.split(/[\\/]/).pop()} <span className="text-zinc-600">:{r.line}</span>
            </div>
            <div className="text-zinc-500 font-mono text-[11px] truncate">{r.preview}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

type RoomFile = {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
};

function RoomsSection() {
  const { addRecentProject, openProject, currentProject, openCloudFile, recentRooms, rememberRoom } = useWorkspace();
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [files, setFiles] = useState<RoomFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const username = useGuestUsername();

  const inRoom = currentProject?.type === "cloud" && currentProject.cloudRoomId;

  const loadFiles = useCallback(async (roomId: string) => {
    setFilesLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/rooms/${roomId}/files`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as RoomFile[];
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      log.error("rooms", `Не удалось загрузить файлы комнаты ${roomId}`, err);
      setError(`Не удалось загрузить файлы комнаты: ${String(err)}`);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (inRoom && currentProject?.cloudRoomId) loadFiles(currentProject.cloudRoomId);
    else setFiles([]);
  }, [inRoom, currentProject?.cloudRoomId, loadFiles]);

  /**
   * Вход в комнату по invite-коду или прямому room id.
   * Сначала пробуем `GET /api/rooms/join/:code` (короткий код), при 404 —
   * fallback к `GET /api/rooms/:id` (UUID комнаты).
   */
  const join = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setJoining(true);
    setError(null);
    try {
      let roomId = trimmed;
      let roomTitle = `Комната ${trimmed.slice(0, 8)}`;
      let inviteCode: string | null = null;
      // Попытка №1 — invite-код
      const inviteRes = await apiFetch(`/api/rooms/join/${encodeURIComponent(trimmed.toUpperCase())}`);
      if (inviteRes.ok) {
        const room = await inviteRes.json() as { id: string; title?: string; inviteCode?: string };
        roomId = room.id;
        if (room.title) roomTitle = room.title;
        inviteCode = room.inviteCode ?? trimmed.toUpperCase();
      } else {
        // Попытка №2 — UUID комнаты
        const direct = await apiFetch(`/api/rooms/${trimmed}`);
        if (direct.ok) {
          const room = await direct.json() as { title?: string; inviteCode?: string };
          if (room.title) roomTitle = room.title;
          inviteCode = room.inviteCode ?? null;
        } else {
          throw new Error(`Комната не найдена (HTTP ${inviteRes.status} / ${direct.status})`);
        }
      }
      const project: Project = {
        id: nanoid(10),
        name: roomTitle,
        path: `cloud://room/${roomId}`,
        type: "cloud",
        cloudRoomId: roomId,
        lastOpenedAt: Date.now(),
      };
      await addRecentProject(project);
      await rememberRoom({ id: roomId, inviteCode, title: roomTitle, lastJoinedAt: Date.now() });
      await openProject(project);
      setCode("");
    } catch (err) {
      log.error("rooms", "join", err);
      setError(`Не удалось войти в комнату: ${String(err)}`);
    } finally {
      setJoining(false);
    }
  };

  const createRoom = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Комната ${username}`, isPrivate: false }),
      });
      if (res.status === 401) {
        // api-server явно запрещает гостям создавать комнаты (Clerk-only).
        // На рабочем столе нет встроенного Clerk-логина, поэтому
        // предлагаем открыть веб-версию для создания комнаты.
        setError(
          "Создание комнаты требует входа в аккаунт CodeSync (через веб-версию). " +
          "На рабочем столе вы можете присоединиться к существующей комнате по invite-коду.",
        );
        const webUrl = "https://codesync.replit.app/";
        if (window.confirm("Открыть веб-версию CodeSync, чтобы создать комнату?")) {
          window.open(webUrl, "_blank", "noopener");
        }
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || "API недоступен"}`);
      }
      const room = await res.json() as { id: string; title: string; inviteCode?: string };
      const project: Project = {
        id: nanoid(10),
        name: room.title,
        path: `cloud://room/${room.id}`,
        type: "cloud",
        cloudRoomId: room.id,
        lastOpenedAt: Date.now(),
      };
      await addRecentProject(project);
      await rememberRoom({
        id: room.id,
        inviteCode: room.inviteCode ?? null,
        title: room.title,
        lastJoinedAt: Date.now(),
      });
      await openProject(project);
    } catch (err) {
      log.error("rooms", "create", err);
      setError(`Не удалось создать комнату: ${String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const openRoomFile = async (f: RoomFile) => {
    if (f.isFolder || !currentProject?.cloudRoomId) return;
    try {
      const res = await apiFetch(`/api/rooms/${currentProject.cloudRoomId}/files/${f.id}`);
      let initialContent = "";
      if (res.ok) {
        const data = await res.json() as { content?: string };
        initialContent = data.content ?? "";
      }
      openCloudFile(currentProject.cloudRoomId, f.id, f.name, initialContent);
    } catch (err) {
      log.error("rooms", `Не удалось открыть файл комнаты ${f.id}`, err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex-1">Облачные комнаты</span>
        {inRoom && currentProject?.cloudRoomId && (
          <button
            type="button"
            onClick={() => loadFiles(currentProject.cloudRoomId!)}
            className="hover:text-zinc-200 p-0.5"
            title="Обновить файлы"
            data-testid="rooms-refresh-files"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="p-2.5 space-y-3">
        {!inRoom && (
          <>
            <div className="text-[12.5px] text-zinc-400 leading-relaxed">
              Войдите по invite-коду (8 символов) либо ID комнаты.<br />
              <span className="text-zinc-500">
                Создание новой комнаты требует аккаунта в веб-версии CodeSync.
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="relative">
                <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Invite-код или ID"
                  className="w-full h-8 pl-7 pr-2 rounded-md bg-[#131316] border border-white/8 text-[13px] focus-ring placeholder:text-zinc-500 font-mono uppercase"
                  data-testid="rooms-input-code"
                />
              </div>
              <button
                type="button"
                onClick={join}
                disabled={joining || !code.trim()}
                className="w-full h-8 rounded-md bg-[#F97316] hover:bg-[#FB923C] text-[#1C0A00] font-medium text-[13px] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                data-testid="rooms-join"
              >
                <LogIn className="w-3.5 h-3.5" />
                {joining ? "Вход…" : "Войти в комнату"}
              </button>
              <button
                type="button"
                onClick={createRoom}
                disabled={creating}
                className="w-full h-8 rounded-md bg-[#18181B] hover:bg-[#1F1F23] border border-white/8 text-zinc-300 font-medium text-[13px] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                data-testid="rooms-create"
              >
                <Plus className="w-3.5 h-3.5" />
                {creating ? "Создание…" : "Создать новую"}
              </button>
            </div>
            {recentRooms.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-white/5">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Недавние</div>
                {recentRooms.slice(0, 6).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setCode(r.inviteCode ?? r.id); }}
                    className="w-full h-8 px-2 text-left text-[12.5px] hover-row rounded-sm flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200"
                    data-testid={`recent-room-${r.id}`}
                  >
                    <Users className="w-3 h-3 shrink-0 text-[#F97316]" />
                    <span className="truncate flex-1">{r.title}</span>
                    {r.inviteCode && (
                      <span className="font-mono text-[10.5px] text-zinc-500">{r.inviteCode}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {inRoom && currentProject && (
          <>
            <div className="text-[12.5px] text-zinc-300 font-medium">{currentProject.name}</div>
            <div className="text-[11px] text-zinc-500 font-mono break-all">
              {currentProject.cloudRoomId}
            </div>
            {filesLoading && <div className="text-[12px] text-zinc-500">Загрузка файлов…</div>}
            {!filesLoading && files.length === 0 && (
              <div className="text-[12px] text-zinc-500">Файлов пока нет.</div>
            )}
            <div className="space-y-0.5">
              {files.filter((f) => !f.isFolder).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => openRoomFile(f)}
                  className="w-full h-7 px-2 text-left text-[12.5px] hover-row rounded-sm flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200"
                  data-testid={`room-file-${f.id}`}
                >
                  <FileIcon className="w-3 h-3 shrink-0 text-zinc-500" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {error && (
          <div className="text-[11.5px] text-[#E26F6F] bg-[#E26F6F]/8 border border-[#E26F6F]/20 rounded p-2">
            {error}
          </div>
        )}
        <ConnectionState />
      </div>
    </div>
  );
}

function useGuestUsername(): string {
  const [name, setName] = useState("Гость");
  useEffect(() => {
    desktop().db.getSetting("guestUsername").then((n) => { if (n) setName(n); });
  }, []);
  return name;
}

function ConnectionState() {
  const native = isElectron();
  const onlineRef = useRef(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => { onlineRef.current = navigator.onLine; setTick((t) => t + 1); };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const online = onlineRef.current;
  return (
    <div className="rounded-md border border-white/8 bg-[#131316] px-2.5 py-2 flex items-center gap-2 text-[12px] text-zinc-400">
      {online ? <Wifi className="w-3.5 h-3.5 text-[#56C271]" /> : <WifiOff className="w-3.5 h-3.5 text-[#E26F6F]" />}
      <span>
        {native ? (online ? "Готов к подключению" : "Нет соединения") : "Веб-режим"}
      </span>
    </div>
  );
}

function GitSection() {
  const { currentProject } = useWorkspace();
  const [branch, setBranch] = useState<string | null>(null);
  const [status, setStatus] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentProject || currentProject.type !== "local") return;
    setLoading(true);
    try {
      const headPath = `${currentProject.path}/.git/HEAD`;
      const exists = await desktop().fs.exists(headPath).catch(() => false);
      if (!exists) {
        setBranch(null);
        setStatus([]);
        return;
      }
      const head = await desktop().fs.readFile(headPath).catch(() => "");
      const m = head.trim().match(/ref: refs\/heads\/(.+)$/);
      setBranch(m ? m[1] : "detached HEAD");
      // Простейший статус — наличие staging/working файлов читаем из .git/index длины,
      // полный git status требует git CLI. Для нативной сборки покажем подсказку.
      setStatus([]);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">
        <span className="flex-1">Контроль версий</span>
        <button
          type="button"
          onClick={refresh}
          className="hover:text-zinc-200 p-0.5"
          title="Обновить"
          data-testid="git-refresh"
        >
          <RefreshCw className={loading ? "w-3 h-3 animate-spin" : "w-3 h-3"} />
        </button>
      </div>
      <div className="p-3 text-[13px] text-zinc-400 space-y-2">
        {currentProject?.type === "local" ? (
          branch ? (
            <>
              <div className="flex items-center gap-2 text-zinc-300">
                <GitBranch className="w-3.5 h-3.5 text-[#F97316]" />
                <span className="font-medium font-mono">{branch}</span>
              </div>
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Выполните <span className="font-mono text-zinc-400">git status</span> в терминале для подробной информации.
              </p>
              {status.map((s, i) => (
                <div key={i} className="text-[12px] text-zinc-500 font-mono">{s}</div>
              ))}
            </>
          ) : (
            <p className="text-[12.5px] text-zinc-500">
              В этой папке нет git-репозитория. Выполните <span className="font-mono text-zinc-400">git init</span> в терминале.
            </p>
          )
        ) : (
          <p className="text-[12.5px] text-zinc-500">Откройте локальный проект для работы с git.</p>
        )}
      </div>
    </div>
  );
}

function ExtensionsSection() {
  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">Расширения</div>
      <div className="p-3 text-[13px] text-zinc-400 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="w-3.5 h-3.5 text-[#F97316]" />
          <span>Встроенные модули</span>
        </div>
        <ul className="space-y-1.5 text-[12.5px] text-zinc-500">
          <li>• Monaco Editor (TypeScript / JavaScript / JSON / Markdown)</li>
          <li>• Yjs + y-monaco (совместное редактирование)</li>
          <li>• xterm.js + node-pty (системный терминал)</li>
          <li>• better-sqlite3 (локальное хранилище)</li>
          <li>• ИИ-помощник через api-server</li>
        </ul>
      </div>
    </div>
  );
}
