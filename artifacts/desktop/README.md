# CodeSync Desktop

Нативное десктопное приложение CodeSync на Electron + React 19 + Vite +
TypeScript + Tailwind v4. Локальный SQLite через better-sqlite3, реальный
терминал на node-pty, Monaco Editor, Yjs для совместного редактирования.

## Структура

```
artifacts/desktop/
├── src/                     # React-рендерер (работает в браузере и Electron)
│   ├── App.tsx              # каркас IDE
│   ├── components/          # TitleBar, ActivityBar, SideBar, FileTree,
│   │                        # EditorPane, TabsBar, BottomPanel, AIPanel,
│   │                        # CommandPalette, StatusBar, WelcomeScreen
│   ├── hooks/               # useHotkeys
│   ├── store/workspace.tsx  # глобальный контекст рабочего пространства
│   ├── lib/
│   │   ├── desktopBridge.ts # абстракция window.desktopAPI / fallback
│   │   ├── editorThemes.ts  # тёмная Monaco-тема
│   │   └── utils.ts
│   └── index.css            # дизайн-токены (Cursor / Antigravity стиль)
├── electron/
│   ├── main.ts              # главный процесс
│   ├── preload.ts           # contextBridge для рендера
│   ├── menu.ts              # русское нативное меню
│   ├── tsconfig.json
│   └── ipc/
│       ├── fs.ts            # файловая система
│       ├── db.ts            # SQLite (better-sqlite3)
│       └── pty.ts           # терминал (node-pty)
├── electron-builder.yml     # сборка установщиков (mac/win/linux)
├── vite.config.ts           # Vite-конфиг рендерера
└── package.json
```

## Режимы работы

### Веб-превью (внутри Replit)

Vite-сервер отдаёт React-рендерер. `window.desktopAPI` отсутствует, поэтому
включается браузерный fallback: проекты хранятся в `localStorage`, файловая
система не доступна, терминал работает в эмуляции, ИИ-чат стучится в
`/api/ai/chat` существующего api-server.

```bash
pnpm --filter @workspace/desktop run dev
```

### Нативная сборка (локально)

Требуется локальная установка тяжёлых зависимостей: `electron`,
`electron-builder`, `better-sqlite3`, `node-pty`. Они объявлены как
`optionalDependencies`, чтобы установка в облаке не блокировалась.

```bash
# 1. Установить зависимости (включая нативные)
pnpm install --filter @workspace/desktop

# 2. Запустить Vite + Electron в режиме разработки
#    (в одном терминале: vite, в другом — electron)
pnpm --filter @workspace/desktop run dev          # терминал #1
pnpm --filter @workspace/desktop run electron:dev # терминал #2

# 3. Собрать установщик для текущей ОС
pnpm --filter @workspace/desktop run electron:dist
```

В режиме разработки Electron подключается к `http://localhost:5173/desktop/`
(можно переопределить переменной `VITE_DEV_URL`).

## Архитектура

### Local-first + cloud rooms

Основной режим — локальный: проекты, настройки и метаданные хранятся в
SQLite (`<userData>/codesync.db`), файлы читаются прямо с диска через
`node:fs/promises`. Облачные комнаты (совместная работа) опциональны и
используют существующий `artifacts/api-server` (REST + WebSocket + Yjs).

### Bridge-абстракция

`src/lib/desktopBridge.ts` экспортирует `desktop()` — единый API для FS,
SQLite, PTY, окна и системных уведомлений. В Electron он делегирует
`window.desktopAPI` (preload), в браузере — браузерный fallback. Это
позволяет одному коду рендерера работать в обоих режимах.

### Дизайн-система

Палитра вдохновлена Cursor / Claude Code / Antigravity:

- Фон: `#0F0F11`, поверхности `#18181B / #1F1F23`, элевация `#25252B`
- Бордеры: `rgba(255,255,255, 0.06 / 0.10 / 0.16)` — 1px
- Акцент: приглушённый фиолет `#8B7DE9 → #A395FF`
- Шрифты: Inter (UI) и JetBrains Mono (код)
- Glassmorphism: палитра команд, всплывающие панели

## Горячие клавиши

| Сочетание | Действие |
|-----------|----------|
| `⌘/Ctrl + K` | Палитра команд |
| `⌘/Ctrl + Shift + P` | Палитра команд |
| `⌘/Ctrl + S` | Сохранить файл |
| `⌘/Ctrl + N` | Новый черновик |
| `⌘/Ctrl + O` | Открыть папку |
| `⌘/Ctrl + B` | Боковая панель |
| `⌘/Ctrl + I` | ИИ-помощник |
| `⌘/Ctrl + \`` | Терминал |

## Что сделано

- [x] Каркас Electron (main + preload + меню на русском)
- [x] IPC: FS, SQLite (better-sqlite3), PTY (node-pty)
- [x] Vite + React 19 + Tailwind v4 рендерер
- [x] Дизайн-система Cursor/Antigravity-стиль
- [x] TitleBar (нативные кнопки mac/win), ActivityBar, SideBar
- [x] FileTree (lazy-loading, рекурсивный)
- [x] TabsBar + Monaco EditorPane (тема codesync-dark)
- [x] BottomPanel (терминал/проблемы/вывод) с xterm.js
- [x] AIPanel со streaming SSE через api-server
- [x] CommandPalette (cmdk) с глобальными хоткеями
- [x] StatusBar
- [x] Welcome-экран с recents
- [x] Реакция на нативное меню через IPC

## Намеренно вне scope (для будущих задач)

- Полная интеграция Yjs/y-monaco для облачных комнат (есть инфра, но не
  включена в EditorPane)
- Поиск по всему проекту
- Git-интеграция
- Магазин расширений
- Auto-update / code-signing / multi-platform CI
