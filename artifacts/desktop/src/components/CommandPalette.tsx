import { Command } from "cmdk";
import { useEffect, useState } from "react";
import {
  FolderOpen, FilePlus, Save, TerminalSquare, Sparkles, Users, Settings, Search as SearchIcon,
  PanelLeft, PanelRight, PanelBottom,
} from "lucide-react";
import { useWorkspace } from "@/store/workspace";
import { desktop, isElectron, type Project } from "@/lib/desktopBridge";
import { nanoid } from "nanoid";
import { modKey } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const [value, setValue] = useState("");
  const ws = useWorkspace();
  const native = isElectron();

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  if (!open) return null;

  const run = (fn: () => void | Promise<void>) => async () => {
    onClose();
    await fn();
  };

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
    await ws.addRecentProject(project);
    await ws.openProject(project);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start pt-[12vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="command-palette"
    >
      <div
        className="w-[640px] max-w-[92vw] glass rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="flex flex-col" label="Палитра команд">
          <div className="flex items-center gap-2 px-3.5 h-12 border-b border-white/8">
            <SearchIcon className="w-4 h-4 text-zinc-500" />
            <Command.Input
              autoFocus
              value={value}
              onValueChange={setValue}
              placeholder="Введите команду или название файла…"
              className="flex-1 bg-transparent outline-none text-[14px] text-zinc-200 placeholder:text-zinc-500"
              data-testid="command-palette-input"
            />
            <span className="kbd">Esc</span>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center text-[13px] text-zinc-500">
              Ничего не найдено
            </Command.Empty>

            <Command.Group heading="Проект" className="text-[10.5px] text-zinc-500 uppercase tracking-wider px-2 pt-2 pb-1">
              <Item icon={FolderOpen} label="Открыть папку…" hint={`${modKey()}+O`} onSelect={run(handleOpenFolder)} testId="cmd-open-folder" />
              <Item icon={FilePlus} label="Новый черновик" onSelect={run(() => ws.openScratch("typescript"))} testId="cmd-new-scratch" />
              {ws.recentProjects.slice(0, 5).map((p) => (
                <Item
                  key={p.id}
                  icon={FolderOpen}
                  label={`Открыть: ${p.name}`}
                  hint={p.path}
                  onSelect={run(() => ws.openProject(p))}
                  testId={`cmd-open-recent-${p.id}`}
                />
              ))}
            </Command.Group>

            <Command.Group heading="Файл" className="text-[10.5px] text-zinc-500 uppercase tracking-wider px-2 pt-2 pb-1">
              <Item icon={Save} label="Сохранить" hint={`${modKey()}+S`} onSelect={run(ws.saveActiveTab)} testId="cmd-save" />
            </Command.Group>

            <Command.Group heading="Вид" className="text-[10.5px] text-zinc-500 uppercase tracking-wider px-2 pt-2 pb-1">
              <Item icon={PanelLeft} label="Переключить боковую панель" hint={`${modKey()}+B`} onSelect={run(ws.toggleLeftSidebar)} testId="cmd-toggle-left" />
              <Item icon={PanelRight} label="Переключить ИИ-помощника" hint={`${modKey()}+I`} onSelect={run(ws.toggleRightPanel)} testId="cmd-toggle-right" />
              <Item icon={PanelBottom} label="Переключить терминал" hint={`${modKey()}+\``} onSelect={run(ws.toggleBottomPanel)} testId="cmd-toggle-bottom" />
              <Item icon={TerminalSquare} label="Показать терминал" onSelect={run(() => { ws.setBottomPanelView("terminal"); if (!ws.showBottomPanel) ws.toggleBottomPanel(); })} testId="cmd-show-terminal" />
              <Item icon={Sparkles} label="Открыть ИИ-чат" onSelect={run(() => { ws.setRightPanelView("ai"); if (!ws.showRightPanel) ws.toggleRightPanel(); })} testId="cmd-show-ai" />
            </Command.Group>

            <Command.Group heading="Совместная работа" className="text-[10.5px] text-zinc-500 uppercase tracking-wider px-2 pt-2 pb-1">
              <Item icon={Users} label="Подключиться к комнате…" onSelect={run(() => { ws.setActivitySection("rooms"); if (!ws.showLeftSidebar) ws.toggleLeftSidebar(); })} testId="cmd-join-room" />
            </Command.Group>

            <Command.Group heading="Прочее" className="text-[10.5px] text-zinc-500 uppercase tracking-wider px-2 pt-2 pb-1">
              <Item icon={Settings} label="Настройки" onSelect={run(() => { ws.setRightPanelView("settings"); if (!ws.showRightPanel) ws.toggleRightPanel(); })} testId="cmd-settings" />
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function Item({
  icon: Icon, label, hint, onSelect, testId,
}: {
  icon: typeof FolderOpen;
  label: string;
  hint?: string;
  onSelect: () => void;
  testId?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2.5 px-2.5 h-9 rounded-md text-[13px] text-zinc-300 cursor-pointer data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-zinc-100"
      data-testid={testId}
    >
      <Icon className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.6} />
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-[11px] text-zinc-500 font-mono">{hint}</span>}
    </Command.Item>
  );
}
