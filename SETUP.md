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

Файл `.github/workflows/release.yml` уже создан в репозитории.  
Он автоматически собирает все три платформы при пуше тега и подписывает установщики.

Для публикации: создайте тег `v1.0.0` и запушьте — GitHub Actions соберёт все три платформы автоматически.

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Code Signing (подпись установщиков)

Подпись устраняет предупреждения безопасности: «Windows protected your PC» (SmartScreen) и блокировку Gatekeeper на macOS.

### macOS — Developer ID + Notarization

**Что нужно:**
- Аккаунт в [Apple Developer Program](https://developer.apple.com/programs/) (~$99/год)
- Сертификат типа **Developer ID Application** (не Distribution)
- Apple ID и пароль приложения (App-Specific Password) для notarytool

**Шаги:**
1. В Xcode / Keychain Access создайте сертификат **Developer ID Application**.
2. Экспортируйте его как `.p12` и закодируйте в base64:
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```
3. Добавьте в GitHub → Settings → Secrets → Actions следующие секреты:

| Secret | Описание |
|--------|----------|
| `APPLE_CERTIFICATE_BASE64` | Base64-кодированный `.p12` файл |
| `APPLE_CERTIFICATE_PASSWORD` | Пароль от `.p12` файла |
| `APPLE_SIGNING_IDENTITY` | Common Name сертификата, напр. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_TEAM_ID` | 10-значный Team ID из developer.apple.com |
| `APPLE_ID` | Ваш Apple ID (email) |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-Specific Password с appleid.apple.com |

Нотаризация (notarization) запускается автоматически через `electron-builder` после сборки DMG.

---

### Windows — OV или EV Code Signing Certificate

**Что нужно:**
- Сертификат подписи кода (OV — от ~$200/год, EV — от ~$400/год)
  - Рекомендуемые CA: DigiCert, Sectigo, GlobalSign
  - EV-сертификат убирает SmartScreen полностью с первой установки
  - OV-сертификат убирает SmartScreen после накопления репутации (~1000 установок)
- Файл сертификата в формате `.pfx` / `.p12`

**Шаги:**
1. Получите сертификат у CA, экспортируйте как `.pfx`.
2. Закодируйте в base64:
   ```bash
   base64 -i certificate.pfx | pbcopy   # macOS/Linux
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | clip  # PowerShell
   ```
3. Добавьте в GitHub → Settings → Secrets → Actions:

| Secret | Описание |
|--------|----------|
| `WIN_CSC_LINK` | Base64-кодированный `.pfx` файл |
| `WIN_CSC_KEY_PASSWORD` | Пароль от `.pfx` файла |
| `WIN_CERT_SUBJECT_NAME` | Subject Name сертификата, напр. `Your Company Name` |

> **EV-сертификаты:** некоторые CA выдают EV-сертификаты на USB-токене (HSM). В этом случае подпись в облачном CI невозможна — используйте облачные HSM-сервисы (DigiCert KeyLocker, SSL.com eSigner) или подписывайте локально перед публикацией.

---

### Проверка подписи

**macOS:**
```bash
codesign --verify --verbose=4 CodeSync.dmg
spctl --assess --verbose=4 --type install CodeSync.dmg
```

**Windows** (PowerShell):
```powershell
Get-AuthenticodeSignature .\CodeSync-Setup.exe | Select-Object Status, SignerCertificate
```

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
