import { FolderOpen, Plus, Users, Search as SearchIcon, GitBranch, Package, Wifi, WifiOff } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { FileTree } from "@/components/FileTree";
import { desktop, isElectron, type Project } from "@/lib/desktopBridge";
import { nanoid } from "nanoid";
import { useState } from "react";

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

  if (!currentProject) {
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
            className="w-full h-8 rounded-md bg-[#A395FF] hover:bg-[#B5A8FF] text-[#0E0B22] font-medium text-[13px] transition-colors flex items-center justify-center gap-1.5"
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
                    <FolderOpen className="w-3 h-3 shrink-0 text-[#8B7DE9]" />
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
            placeholder="Поиск по проекту"
            className="w-full h-8 pl-7 pr-2 rounded-md bg-[#131316] border border-white/8 text-[13px] focus-ring placeholder:text-zinc-500"
            data-testid="sidebar-search-input"
          />
        </div>
        <p className="text-[12px] text-zinc-500 px-1 leading-relaxed">
          Полнотекстовый поиск по файлам проекта будет доступен после открытия папки.
        </p>
      </div>
    </div>
  );
}

function RoomsSection() {
  const [code, setCode] = useState("");
  const { addRecentProject, openProject } = useWorkspace();

  const join = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const project: Project = {
      id: nanoid(10),
      name: `Комната ${trimmed.slice(0, 8)}`,
      path: `cloud://room/${trimmed}`,
      type: "cloud",
      cloudRoomId: trimmed,
      lastOpenedAt: Date.now(),
    };
    await addRecentProject(project);
    await openProject(project);
    setCode("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">Облачные комнаты</div>
      <div className="p-2.5 space-y-3">
        <div className="text-[12.5px] text-zinc-400 leading-relaxed">
          Подключитесь к существующей комнате CodeSync для совместной работы.
        </div>
        <div className="space-y-1.5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ID комнаты или код приглашения"
            className="w-full h-8 px-2.5 rounded-md bg-[#131316] border border-white/8 text-[13px] focus-ring placeholder:text-zinc-500 font-mono"
            data-testid="rooms-input-code"
          />
          <button
            type="button"
            onClick={join}
            className="w-full h-8 rounded-md bg-[#A395FF] hover:bg-[#B5A8FF] text-[#0E0B22] font-medium text-[13px] transition-colors flex items-center justify-center gap-1.5"
            data-testid="rooms-join"
          >
            <Users className="w-3.5 h-3.5" />
            Войти в комнату
          </button>
          <button
            type="button"
            className="w-full h-8 rounded-md bg-[#18181B] hover:bg-[#1F1F23] border border-white/8 text-zinc-300 font-medium text-[13px] transition-colors flex items-center justify-center gap-1.5"
            data-testid="rooms-create"
          >
            <Plus className="w-3.5 h-3.5" />
            Создать новую
          </button>
        </div>
        <ConnectionState />
      </div>
    </div>
  );
}

function ConnectionState() {
  const native = isElectron();
  return (
    <div className="rounded-md border border-white/8 bg-[#131316] px-2.5 py-2 flex items-center gap-2 text-[12px] text-zinc-400">
      {native ? <Wifi className="w-3.5 h-3.5 text-[#56C271]" /> : <WifiOff className="w-3.5 h-3.5 text-zinc-500" />}
      <span>{native ? "Готов к подключению" : "Веб-режим (без локальной БД)"}</span>
    </div>
  );
}

function GitSection() {
  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">Контроль версий</div>
      <div className="p-3 text-[13px] text-zinc-400 space-y-2">
        <div className="flex items-center gap-2 text-zinc-300">
          <GitBranch className="w-3.5 h-3.5 text-[#8B7DE9]" />
          <span className="font-medium">main</span>
        </div>
        <p className="text-[12.5px] text-zinc-500 leading-relaxed">
          Интеграция с git появится после подключения локального репозитория.
        </p>
      </div>
    </div>
  );
}

function ExtensionsSection() {
  return (
    <div className="flex flex-col h-full">
      <div className="panel-header">Расширения</div>
      <div className="p-3 text-[13px] text-zinc-400 flex items-center gap-2">
        <Package className="w-3.5 h-3.5 text-[#8B7DE9]" />
        Магазин расширений будет добавлен позже.
      </div>
    </div>
  );
}
