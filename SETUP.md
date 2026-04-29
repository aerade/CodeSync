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

### Windows — Code Signing (.pfx / PKCS#12)

The CI workflow signs the Windows installer using a standard code-signing certificate stored as a base64-encoded `.pfx` file in GitHub Secrets.

**Почему EV, а не OV:**
- EV-сертификат убирает предупреждение Windows SmartScreen («Windows protected your PC») **с первой установки**
- OV-сертификат требует накопления репутации (~1000+ установок) перед исчезновением SmartScreen

**Рекомендуемые провайдеры:** DigiCert, Sectigo, SSL.com (OV или EV Code Signing)

**Шаги для получения и настройки:**
1. Купите сертификат **OV или EV Code Signing** у выбранного CA.
2. Пройдите верификацию организации (1–5 рабочих дней).
3. Экспортируйте сертификат как `.pfx` / `.p12` (включая приватный ключ) и задайте надёжный пароль.
4. Закодируйте файл в base64:
   ```bash
   # macOS / Linux
   base64 -i certificate.pfx | pbcopy

   # Windows (PowerShell)
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Set-Clipboard
   ```
5. Добавьте в **GitHub → Settings → Secrets → Actions:**

| Secret | Описание |
|--------|----------|
| `WIN_CSC_LINK` | Base64-кодированный `.pfx` файл |
| `WIN_CSC_KEY_PASSWORD` | Пароль от `.pfx` файла |

**Как работает подпись в CI:**
1. CI декодирует `WIN_CSC_LINK` из base64 во временный `.pfx`-файл.
2. `electron-builder` подписывает `.exe` сертификатом и удаляет временный файл.
3. PowerShell запускает `Get-AuthenticodeSignature` и завершает сборку с ошибкой, если подпись не прошла проверку.

> **Важно:** Подпись обязательна для релизных сборок. Если секреты `WIN_CSC_LINK` или `WIN_CSC_KEY_PASSWORD` не заданы, задание CI завершится с ошибкой. Это предотвращает случайную публикацию неподписанных установщиков.

**Проверка подписи (PowerShell):**
```powershell
$sig = Get-AuthenticodeSignature .\CodeSync-Setup.exe
$sig.Status                    # должно быть Valid
$sig.SignerCertificate.Subject # должен содержать название организации
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

## Certificate Renewal

Code-signing certificates have a fixed validity period (typically 1–3 years). A GitHub Actions workflow (`.github/workflows/cert-expiry-check.yml`) runs every Monday and automatically opens a GitHub issue when fewer than **60 days** remain before a certificate expires, giving the team ample time to renew.

### How the alert works

- The workflow decodes the base64-encoded certificate secrets and reads the expiry date with `openssl`.
- If any certificate is expiring within 60 days, a GitHub issue labelled **`cert-expiry`** is created.
- Duplicate alerts are suppressed: if an open `cert-expiry` issue already exists, a comment is added instead of opening a new issue.
- A run summary is always written to the GitHub Actions job summary tab for easy monitoring.

You can also trigger the check manually from **Actions → Certificate Expiry Check → Run workflow**.

---

### macOS — Renewing the Developer ID Certificate

Apple Developer ID certificates are issued for **1 year** and must be renewed annually.

1. Sign in to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**.
2. Revoke the expiring **Developer ID Application** certificate and create a new one.
3. Download the new certificate and import it into Keychain Access.
4. Export it as a `.p12` file (include private key, set a strong password).
5. Encode it to base64:
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```
6. Update the following secrets in **GitHub → Settings → Secrets → Actions**:

   | Secret | What to update |
   |--------|----------------|
   | `APPLE_CERTIFICATE_BASE64` | Paste the new base64 string |
   | `APPLE_CERTIFICATE_PASSWORD` | Password chosen in step 4 |
   | `APPLE_SIGNING_IDENTITY` | Common Name of the new certificate (e.g. `Developer ID Application: Your Name (TEAMID)`) |

7. Trigger a manual release or push a test tag to verify the new certificate signs the DMG correctly.

> **Note:** The private key associated with the old certificate must be kept securely until all builds using it are no longer distributed. After renewing, close the open `cert-expiry` GitHub issue.

---

### Windows — Renewing the Code-Signing Certificate

Windows installers are signed with a `.pfx` certificate whose base64 value is stored in the `WIN_CSC_LINK` secret. OV certificates are typically issued for **1–3 years**; EV certificates for **1–2 years**.

**Steps:**

1. Purchase or renew a **Code Signing** certificate from your CA (DigiCert, Sectigo, SSL.com, etc.).
2. Export the renewed certificate as a `.pfx` file (include the private key) and set a strong password.
3. Encode it to base64:
   ```bash
   base64 -i new-certificate.pfx | pbcopy
   ```
4. Update the following secrets in **GitHub → Settings → Secrets → Actions**:

   | Secret | What to update |
   |--------|----------------|
   | `WIN_CSC_LINK` | Base64 string of the new `.pfx` file |
   | `WIN_CSC_KEY_PASSWORD` | Password set in step 2 |

5. Trigger a test build to confirm the installer is signed and SmartScreen shows the publisher name.

After updating the secrets, close the open `cert-expiry` GitHub issue.

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
