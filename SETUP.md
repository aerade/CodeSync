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

### Windows — EV Code Signing via SSL.com eSigner (Cloud HSM)

EV (Extended Validation) сертификаты хранятся на аппаратных токенах (HSM) и не могут быть экспортированы в `.pfx`. CI-пайплайн использует **SSL.com eSigner** — облачный HSM-сервис, позволяющий подписывать в GitHub Actions без физического токена.

**Почему EV, а не OV:**
- EV-сертификат убирает предупреждение Windows SmartScreen («Windows protected your PC») **с первой установки**
- OV-сертификат требует накопления репутации (~1000+ установок) перед исчезновением SmartScreen

**Провайдер: SSL.com eSigner**

**Шаги для получения сертификата:**
1. Зарегистрируйтесь на [ssl.com](https://www.ssl.com) и купите сертификат **EV Code Signing**.
2. Пройдите верификацию организации (занимает 1–5 рабочих дней).
3. В личном кабинете SSL.com включите **eSigner** для вашего сертификата (раздел *Code Signing Certificates → Enroll for eSigner*).
4. Получите `Credential ID` сертификата из панели SSL.com.
5. Включите TOTP (2FA) в настройках аккаунта и сохраните секрет TOTP.

**Добавьте в GitHub → Settings → Secrets → Actions:**

| Secret | Описание |
|--------|----------|
| `SSL_COM_USERNAME` | Email-адрес аккаунта SSL.com |
| `SSL_COM_PASSWORD` | Пароль аккаунта SSL.com |
| `SSL_COM_CREDENTIAL_ID` | ID сертификата из панели SSL.com (*Credential ID*) |
| `SSL_COM_TOTP_SECRET` | Секрет TOTP (base32) из настроек 2FA аккаунта SSL.com |

> **Примечание:** старые секреты `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `WIN_CERT_SUBJECT_NAME` больше не используются и могут быть удалены из репозитория.

**Как работает подпись в CI:**
1. `electron-builder` собирает установщик **без подписи** (`CSC_IDENTITY_AUTO_DISCOVERY=false`).
2. Шаг `sslcom/esigner-codesign@develop` передаёт `.exe` в облачный HSM SSL.com.
3. SSL.com подписывает файл EV-сертификатом и возвращает подписанный `.exe`.
4. Подписанный файл загружается в GitHub Releases.

**Проверка EV-подписи (PowerShell):**
```powershell
$sig = Get-AuthenticodeSignature .\CodeSync-Setup.exe
$sig.Status                              # должно быть Valid
$sig.SignerCertificate.Subject           # должен содержать название организации
$sig.SignerCertificate.Extensions |
  Where-Object { $_.Oid.Value -eq "2.5.29.32" }  # EV OID должен присутствовать
```

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
