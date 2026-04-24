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

В режиме разработки Vite слушает порт **21098** (этот же порт назначает
артефакту workflow в Replit; локально он используется как дефолт), и
Electron подключается к `http://localhost:21098/desktop/`.
Переопределить можно переменными `PORT` (для Vite) и `VITE_DEV_URL`
(для Electron) — оба значения должны указывать на один и тот же адрес.

## Архитектура

### Local-first + cloud rooms

Основной режим — локальный: проекты, настройки и метаданные хранятся в
SQLite (`<userData>/codesync.db`), файлы читаются прямо с диска через
`node:fs/promises`. Облачные комнаты (совместная работа) опциональны и
используют существующий `artifacts/api-server` (REST + WebSocket + Yjs).

#### Авторизация и scope desktop-сборки

* На рабочем столе используется **гостевой** режим api-server
  (`x-guest-token`, выпускается автоматически через `/api/auth/guest`).
* Для всех WebSocket-соединений (Yjs `EditorPane`, `ChatPanel`)
  предварительно запрашивается short-lived collab-токен через
  `POST /api/collab/token` и передаётся в URL как `?token=...`.
* **Создание комнаты** требует не-гостевого аккаунта и в текущей
  desktop-сборке намеренно ограничено: при попытке создания UI
  предложит открыть веб-версию CodeSync. На рабочем столе доступен
  полный сценарий **присоединения** к существующей комнате по
  invite-коду (8 символов) или UUID.
* Room-level чат подключается к специальному `fileId="__room__"`
  (этот идентификатор поддерживается api-server как room-presence
  канал), либо к конкретному файлу, если он открыт.

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

- [x] Каркас Electron (main + preload + нативное меню на русском)
- [x] IPC: FS (read/write/create/rename/remove/move/pickDir), SQLite
      (better-sqlite3 для projects/settings), PTY (node-pty с поддержкой
      нескольких сессий)
- [x] Vite + React 19 + Tailwind v4 рендерер; продакшен-сборка
      запекается в Electron
- [x] Дизайн-система Cursor/Antigravity-стиль (#0F0F11/#18181B/#A395FF,
      JetBrains Mono, glass blur, focus-ring)
- [x] TitleBar (нативные кнопки mac/win), ActivityBar, SideBar
- [x] FileTree: lazy-loading, drag-and-drop, контекстное меню
      (создать файл/папку, переименовать, удалить)
- [x] TabsBar + Monaco EditorPane (тема codesync-dark)
- [x] **Yjs + y-monaco + y-websocket binding** для облачных файлов —
      полноценное совместное редактирование с awareness
- [x] BottomPanel: **многозакладочный терминал** (несколько pty-сессий
      на проект)
- [x] **Гостевая авторизация** через `POST /api/auth/guest` с хранением
      токена в локальной SQLite (`x-guest-token`)
- [x] **Управление облачными комнатами**: создание, вход по ID,
      загрузка списка файлов, открытие файла комнаты в редакторе
- [x] **Панель истории версий**: список снапшотов, восстановление
      версии через `POST /snapshots/:id/restore`
- [x] **Сохранение снапшота** облачного файла по ⌘/Ctrl+S
- [x] **AIPanel — три режима**:
      *Чат* (streaming SSE через `/api/ai/chat` с гостевым токеном),
      *Ревью* (структурированный system-prompt по содержимому активного
      файла, до 8 КБ контекста),
      *История* (чтение `ai_history` из локальной SQLite через
      `db:listAiMessages`, очистка через `db:clearAiHistory`).
      Сообщения «пользователь / ассистент» автоматически
      сохраняются в `ai_history` (scope = id текущего проекта).
- [x] **Нативные уведомления** (`Notification` в main-процессе через
      `system:notify`): показываются для упоминаний `@username` в чате
      комнаты (с антиспам-таймером 4 c) и для завершения долгих
      операций (ИИ-ответ, восстановление снапшота >1.5 с) — только
      если соответствующая панель скрыта или окно вне фокуса.
- [x] CommandPalette (cmdk) — палитра команд
- [x] **Глобальные хоткеи** через `globalShortcut`:
      `⌘/Ctrl+Shift+O/N/T/I/K`, активируют окно, даже когда оно не в
      фокусе
- [x] **Поиск** по всему проекту (recursive FS, фильтр по содержимому)
- [x] **Git**-секция: чтение `.git/HEAD` и текущей ветки
- [x] StatusBar, Welcome-экран с recents
- [x] Реакция на нативное меню и глобальные хоткеи через IPC
- [x] ESM/CJS-разделение: `dev` запускает Vite + Electron параллельно
      через `concurrently`+`wait-on`; `electron:build` пишет
      `dist-electron/package.json` с `type:commonjs`

