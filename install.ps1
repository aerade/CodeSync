# ──────────────────────────────────────────────────────────
#  CodeSync — Установочный скрипт для Windows (PowerShell)
#  Запуск: правой кнопкой по файлу → "Запустить с PowerShell"
#  Или в терминале: powershell -ExecutionPolicy Bypass -File install.ps1
# ──────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

function Write-Ok   { param($msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "  → $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "`n  ✗ ОШИБКА: $msg`n" -ForegroundColor Red; Read-Host "Нажми Enter для выхода"; exit 1 }

Clear-Host
Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║        CodeSync — Установка          ║" -ForegroundColor Magenta
Write-Host "║   Collaborative IDE Desktop App      ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ── 1. Проверяем Docker ──────────────────────────────────
Write-Info "Проверяю Docker..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Fail "Docker не найден.`n`n  Установи Docker Desktop для Windows:`n  https://www.docker.com/products/docker-desktop`n`n  После установки перезапусти компьютер и повтори."
}

try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Write-Fail "Docker установлен, но не запущен.`n  Открой Docker Desktop и дождись значка в трее (зелёный кит), затем повтори."
}

$dockerVer = (docker --version) -replace "Docker version ([0-9.]+).*", '$1'
Write-Ok "Docker $dockerVer готов"

# ── 2. Создаём .env если его нет ────────────────────────
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Info "Создан файл .env из шаблона"
    } else {
        @"
POSTGRES_PASSWORD=codesync_secret
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CLERK_SECRET_KEY=
NODE_ENV=production
PORT=8080
"@ | Set-Content ".env" -Encoding UTF8
        Write-Info "Создан новый файл .env"
    }
}

# ── 3. Предлагаем ввести API-ключ ────────────────────────
Write-Host ""
Write-Host "  Настройка AI-функций (необязательно)" -ForegroundColor White
Write-Host "  CodeSync работает без ключей, но AI-чат и ревью кода"
Write-Host "  требуют хотя бы один ключ OpenAI или Anthropic."
Write-Host ""

$envContent = Get-Content ".env" -Raw
$hasOpenAI = $envContent -match 'OPENAI_API_KEY=.+'
$hasAnthropic = $envContent -match 'ANTHROPIC_API_KEY=.+'

if (-not $hasOpenAI -and -not $hasAnthropic) {
    $inputKey = Read-Host "  OpenAI API Key (Enter — пропустить)"
    if ($inputKey -ne "") {
        $envContent = $envContent -replace 'OPENAI_API_KEY=.*', "OPENAI_API_KEY=$inputKey"
        Set-Content ".env" $envContent -Encoding UTF8
        Write-Ok "OpenAI ключ сохранён"
    } else {
        Write-Warn "AI-функции будут недоступны (ключ не указан)"
    }
} else {
    Write-Ok "API ключ уже настроен"
}

# ── 4. Собираем и запускаем ──────────────────────────────
Write-Host ""
Write-Info "Собираю и запускаю CodeSync..."
Write-Info "Первый запуск занимает 3-5 минут (загрузка образов и сборка)"
Write-Host ""

docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose завершился с ошибкой. Проверь вывод выше."
}

# ── 5. Ждём API ──────────────────────────────────────────
Write-Host ""
Write-Info "Жду готовности сервисов..."

$attempts = 0
$apiReady = $false
while ($attempts -lt 30) {
    Start-Sleep 3
    $attempts++
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8080/api/healthz" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { $apiReady = $true; break }
    } catch { }
    Write-Host "  ожидание API ($attempts/30)..." -NoNewline
    Write-Host "`r" -NoNewline
}

if ($apiReady) {
    Write-Ok "API сервер готов"
} else {
    Write-Warn "API ещё запускается — открываю браузер"
}

# ── 6. Открываем браузер ─────────────────────────────────
Write-Host ""
Write-Ok "CodeSync запущен!"
Write-Host ""
Write-Host "  Адреса:" -ForegroundColor White
Write-Host "  Веб-версия:      " -NoNewline; Write-Host "http://localhost" -ForegroundColor Green
Write-Host "  API:             " -NoNewline; Write-Host "http://localhost:8080/api" -ForegroundColor Green
Write-Host ""
Write-Host "  Управление:" -ForegroundColor White
Write-Host "  Остановить:      docker compose down"
Write-Host "  Удалить данные:  docker compose down -v"
Write-Host "  Логи:            docker compose logs -f"
Write-Host ""

Start-Process "http://localhost"

Write-Host "  Готово! Наслаждайся CodeSync." -ForegroundColor Green
Write-Host ""
Read-Host "  Нажми Enter для закрытия"
