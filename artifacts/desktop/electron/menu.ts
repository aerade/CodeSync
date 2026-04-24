import { Menu, type MenuItemConstructorOptions, app } from "electron";

export function buildMenu(dispatch: (action: string) => void) {
  const isMac = process.platform === "darwin";
  const accelMod = isMac ? "Cmd" : "Ctrl";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: "about" as const, label: "О программе" },
        { type: "separator" as const },
        { role: "services" as const, label: "Сервисы" },
        { type: "separator" as const },
        { role: "hide" as const, label: "Скрыть" },
        { role: "hideOthers" as const, label: "Скрыть остальные" },
        { role: "unhide" as const, label: "Показать всё" },
        { type: "separator" as const },
        { role: "quit" as const, label: "Выйти" },
      ],
    } as MenuItemConstructorOptions] : []),
    {
      label: "Файл",
      submenu: [
        { label: "Новый файл", accelerator: `${accelMod}+N`, click: () => dispatch("new-file") },
        { label: "Открыть папку…", accelerator: `${accelMod}+O`, click: () => dispatch("open-folder") },
        { type: "separator" },
        { label: "Сохранить", accelerator: `${accelMod}+S`, click: () => dispatch("save") },
        { type: "separator" },
        isMac ? { role: "close", label: "Закрыть окно" } : { role: "quit", label: "Выйти" },
      ],
    },
    {
      label: "Правка",
      submenu: [
        { role: "undo", label: "Отменить" },
        { role: "redo", label: "Повторить" },
        { type: "separator" },
        { role: "cut", label: "Вырезать" },
        { role: "copy", label: "Копировать" },
        { role: "paste", label: "Вставить" },
        { role: "selectAll", label: "Выделить всё" },
      ],
    },
    {
      label: "Вид",
      submenu: [
        { label: "Палитра команд", accelerator: `${accelMod}+K`, click: () => dispatch("command-palette") },
        { type: "separator" },
        { label: "Боковая панель", accelerator: `${accelMod}+B`, click: () => dispatch("toggle-sidebar") },
        { label: "Терминал", accelerator: `${accelMod}+\``, click: () => dispatch("toggle-terminal") },
        { label: "ИИ-помощник", accelerator: `${accelMod}+I`, click: () => dispatch("toggle-ai") },
        { type: "separator" },
        { role: "togglefullscreen", label: "Полноэкранный режим" },
        { role: "reload", label: "Перезагрузить" },
        { role: "toggleDevTools", label: "Инструменты разработчика" },
      ],
    },
    {
      label: "Окно",
      submenu: [
        { role: "minimize", label: "Свернуть" },
        { role: "zoom", label: "Масштабировать" },
        ...(isMac ? [
          { type: "separator" as const },
          { role: "front" as const, label: "На передний план" },
        ] : [
          { role: "close" as const, label: "Закрыть" },
        ]),
      ],
    },
    {
      label: "Справка",
      submenu: [
        { label: "Документация", click: () => dispatch("help-docs") },
        { label: "О программе", click: () => dispatch("help-about") },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
