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

### Linux (AppImage)

```bash
pnpm --filter @workspace/desktop run build:full
```

Результат: `artifacts/desktop/dist/electron/`
- `CodeSync-1.0.0.AppImage` — портативный исполняемый файл (~144 MB)

**Проверка сборки (без дисплея):**
Следующие пункты подтверждены на Replit Linux (headless):
- [x] `build:full` завершается с кодом 0
- [x] `CodeSync-1.0.0.AppImage` создан (144 MB, ELF 64-bit x86-64)
- [x] `linux-unpacked/resources/app.asar` — фронтенд + Electron-скрипты
- [x] `linux-unpacked/resources/server/server.cjs` — встроенный сервер
- [x] `linux-unpacked/resources/server/node_modules/@libsql/` — SQLite бинарник
- [x] `linux-unpacked/resources/server/node_modules/node-pty/` — терминальный бинарник

Запуск на Linux:

```bash
chmod +x CodeSync-1.0.0.AppImage
./CodeSync-1.0.0.AppImage
```

### macOS (dmg)

```bash
pnpm --filter @workspace/desktop run electron:build:mac
```

### Windows (NSIS)

```bash
pnpm --filter @workspace/desktop run electron:build:win
```

---

## Загрузка готового установщика

### Прямая загрузка (GitHub Releases)

После настройки GitHub CI каждый тег автоматически публикует установщики в **Releases**.  
Пример URL: `https://github.com/your-org/codesync/releases/latest`

### CI/CD — GitHub Actions

Создайте файл `.github/workflows/release.yml`  
(замените `your-org/codesync` в `publish` секции `electron-builder.yml` на свои значения):

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

# Required so softprops/action-gh-release can upload assets
permissions:
  contents: write

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - name: Build AppImage
        run: pnpm --filter @workspace/desktop run build:full
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Upload AppImage
        uses: softprops/action-gh-release@v2
        with:
          files: artifacts/desktop/dist/electron/CodeSync-*.AppImage

  build-win:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - name: Build Windows installer
        run: pnpm --filter @workspace/desktop run electron:build:win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Upload installer
        uses: softprops/action-gh-release@v2
        with:
          files: artifacts/desktop/dist/electron/*.exe

  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - name: Build macOS dmg
        run: pnpm --filter @workspace/desktop run electron:build:mac
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Upload dmg
        uses: softprops/action-gh-release@v2
        with:
          files: artifacts/desktop/dist/electron/*.dmg
```

Для публикации: создайте тег `v1.0.0` и запушьте — GitHub Actions соберёт все три платформы автоматически.

```bash
git tag v1.0.0
git push origin v1.0.0
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
