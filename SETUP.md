# CodeSync — Руководство по установке

## Что это

CodeSync — настоящее десктоп-приложение (как VS Code).  
Скачиваете один файл, устанавливаете — готово. Никаких браузеров, Docker или внешних серверов.

Данные хранятся локально в SQLite (файл в папке пользователя).

---

## Архитектура

```
CodeSync.AppImage / CodeSync.exe / CodeSync.dmg
├── Electron (Chromium + Node.js)
│   ├── React UI (React 19 + Vite)
│   │   └── Подключается к http://127.0.0.1:{свободный_порт}/api
│   └── Main Process
│       ├── Запускает встроенный API-сервер (дочерний процесс)
│       ├── Хранит API-ключи зашифрованно (OS keychain через safeStorage)
│       └── Управляет настройками
└── resources/server/
    ├── server.cjs  (Express + @libsql/SQLite + Yjs коллаборация)
    └── node_modules/@libsql/linux-x64-gnu/  (pre-built бинарник SQLite)
```

---

## Быстрый старт (для разработчиков)

### Требования
- Node.js 20+
- pnpm 9+

### Установка зависимостей

```bash
pnpm install
cd artifacts/desktop/server && npm install --ignore-scripts
```

### Запуск в режиме разработки

```bash
# Запустить Vite dev server (UI)
pnpm --filter @workspace/desktop run dev

# Запустить Electron (откроет localhost)
pnpm --filter @workspace/desktop run electron:dev
```

---

## Сборка установщика

### Linux (AppImage + deb)

```bash
pnpm --filter @workspace/desktop run build:full
```

Результат: `artifacts/desktop/dist/electron/`
- `CodeSync-1.0.0.AppImage` — портативный исполняемый файл
- `codesync_1.0.0_amd64.deb` — для Debian/Ubuntu

### macOS (dmg)

```bash
pnpm --filter @workspace/desktop run electron:build:mac
```

### Windows (NSIS)

```bash
pnpm --filter @workspace/desktop run electron:build:win
```

---

## Настройки (AI-функции)

Откройте **Tools → Settings** (или `Ctrl+,`):

| Ключ | Поставщик | Модель |
|------|-----------|--------|
| OpenAI API Key | platform.openai.com | GPT-4o mini |
| Anthropic API Key | console.anthropic.com | Claude (приоритетный) |

Ключи шифруются и хранятся в OS keychain. Передаются только напрямую в OpenAI/Anthropic.

---

## База данных

| Платформа | Путь |
|-----------|------|
| Linux | `~/.config/CodeSync/codesync.db` |
| macOS | `~/Library/Application Support/CodeSync/codesync.db` |
| Windows | `%APPDATA%\CodeSync\codesync.db` |

Для сброса данных — удалите файл `.db`.

---

## Веб-версия (отдельно)

Веб-версия (artifacts/codesync) работает независимо с PostgreSQL.  
Это отдельный продукт — изменения в одном не влияют на другой.
