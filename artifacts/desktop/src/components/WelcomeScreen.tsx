import { FolderOpen, FilePlus, Users, Sparkles, ArrowRight, Clock } from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { desktop, isElectron, type Project } from "@/lib/desktopBridge";
import { nanoid } from "nanoid";
import { modKey } from "@/lib/utils";

export function WelcomeScreen({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const { recentProjects, openProject, addRecentProject, openScratch, removeRecentProject } = useWorkspace();
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

  return (
    <div className="flex-1 overflow-auto bg-[#0F0F11]">
      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Hero */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] grid place-items-center shadow-[0_0_48px_rgba(249,115,22,0.3)]">
            <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-100 leading-none">CodeSync Desktop</h1>
            <p className="text-[13px] text-zinc-500 mt-1.5">
              Нативный редактор с local-first хранилищем и облачной совместной работой.
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2.5 mb-8">
          <ActionCard
            icon={FolderOpen}
            title="Открыть папку"
            description="Локальный проект"
            hint={`${modKey()}+O`}
            onClick={handleOpenFolder}
            testId="welcome-open-folder"
          />
          <ActionCard
            icon={FilePlus}
            title="Новый файл"
            description="Черновик без сохранения"
            hint={`${modKey()}+N`}
            onClick={() => openScratch("typescript")}
            testId="welcome-new-file"
          />
          <ActionCard
            icon={Users}
            title="Войти в комнату"
            description="Совместная работа онлайн"
            hint="по коду"
            onClick={onOpenCommandPalette}
            testId="welcome-join-room"
          />
        </div>

        {/* Recent */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Последние проекты</h2>
            {recentProjects.length > 0 && (
              <span className="text-[11px] text-zinc-600">{recentProjects.length} всего</span>
            )}
          </div>
          {recentProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-[#131316]/50 px-5 py-8 text-center text-[13px] text-zinc-500">
              Здесь появятся ваши недавние проекты после первого открытия.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {recentProjects.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="group surface rounded-lg p-3 hover:border-white/15 transition-colors cursor-pointer flex items-start gap-3"
                  onClick={() => openProject(p)}
                  data-testid={`welcome-recent-${p.id}`}
                >
                  <div className="w-8 h-8 rounded-md bg-[#1F1F23] grid place-items-center shrink-0">
                    {p.type === "cloud" ? (
                      <Users className="w-4 h-4 text-[#F97316]" />
                    ) : (
                      <FolderOpen className="w-4 h-4 text-[#F97316]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-zinc-200 truncate">{p.name}</div>
                    <div className="text-[11px] text-zinc-500 truncate font-mono mt-0.5">{p.path}</div>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-600 mt-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelative(p.lastOpenedAt)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeRecentProject(p.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[11px] text-zinc-500 hover:text-zinc-200 px-2"
                    title="Убрать из списка"
                  >
                    Убрать
                  </button>
                  <ArrowRight className="w-4 h-4 text-zinc-600 self-center shrink-0 opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="surface rounded-lg p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Подсказки</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] text-zinc-400">
            <Tip k="K" mod label="Палитра команд" />
            <Tip k="B" mod label="Боковая панель" />
            <Tip k="`" mod label="Терминал" />
            <Tip k="I" mod label="ИИ-помощник" />
            <Tip k="S" mod label="Сохранить файл" />
            <Tip k="O" mod label="Открыть папку" />
          </div>
        </div>

        {!native && (
          <div className="mt-6 rounded-lg border border-white/8 bg-[#131316] px-4 py-3 text-[12px] text-zinc-400 leading-relaxed">
            <span className="text-zinc-200 font-medium">Веб-режим.</span> Полные нативные возможности (файловая система, SQLite, терминал) активируются в Electron.
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon, title, description, hint, onClick, testId,
}: {
  icon: typeof FolderOpen;
  title: string;
  description: string;
  hint?: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group surface rounded-lg p-4 text-left hover:border-white/15 transition-colors flex flex-col gap-2.5"
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#F97316]/20 to-[#EA580C]/10 border border-[#F97316]/25 grid place-items-center">
          <Icon className="w-4 h-4 text-[#F97316]" />
        </div>
        {hint && <span className="kbd">{hint}</span>}
      </div>
      <div>
        <div className="text-[13.5px] font-medium text-zinc-100">{title}</div>
        <div className="text-[12px] text-zinc-500 mt-0.5">{description}</div>
      </div>
    </button>
  );
}

function Tip({ k, mod, label }: { k: string; mod?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {mod && <span className="kbd">{modKey()}</span>}
      <span className="kbd">{k}</span>
      <span className="text-zinc-500 text-[12px] ml-1">{label}</span>
    </div>
  );
}

function formatRelative(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "только что";
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
  return `${Math.floor(s / 86400)} дн назад`;
}
