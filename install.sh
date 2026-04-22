#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
#  CodeSync — Установочный скрипт для macOS / Linux
#  Запуск: bash install.sh
# ──────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
info() { echo -e "${CYAN}→${RESET} $*"; }
warn() { echo -e "${YELLOW}!${RESET} $*"; }
fail() { echo -e "${RED}✗ ОШИБКА:${RESET} $*"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║        CodeSync — Установка          ║${RESET}"
echo -e "${BOLD}║   Collaborative IDE Desktop App      ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Проверяем Docker ──────────────────────────────────
info "Проверяю Docker..."

if ! command -v docker &>/dev/null; then
  fail "Docker не найден.\n\n  Установи Docker Desktop:\n    macOS/Windows: https://www.docker.com/products/docker-desktop\n    Ubuntu/Debian: https://docs.docker.com/engine/install/ubuntu/\n\n  После установки запусти этот скрипт снова."
fi

if ! docker info &>/dev/null 2>&1; then
  fail "Docker установлен, но не запущен.\n  Открой Docker Desktop и дождись запуска (иконка в трее станет зелёной), затем повтори."
fi

DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
ok "Docker ${DOCKER_VERSION} готов"

# Проверяем docker compose (v2) или docker-compose (v1)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  fail "docker compose не найден. Обнови Docker до версии 24+ или установи docker-compose."
fi
ok "Docker Compose готов"

# ── 2. Создаём .env если его нет ────────────────────────
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    info "Создан файл .env из шаблона"
  else
    cat > .env << 'ENVEOF'
POSTGRES_PASSWORD=codesync_secret
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CLERK_SECRET_KEY=
NODE_ENV=production
PORT=8080
ENVEOF
    info "Создан новый файл .env"
  fi
fi

# ── 3. Предлагаем ввести API-ключ ────────────────────────
echo ""
echo -e "${BOLD}Настройка AI-функций (необязательно)${RESET}"
echo "  CodeSync работает без ключей, но AI-чат и ревью кода"
echo "  требуют хотя бы один ключ OpenAI или Anthropic."
echo ""

OPENAI_CURRENT=$(grep -E '^OPENAI_API_KEY=' .env | cut -d= -f2 || true)
ANTHROPIC_CURRENT=$(grep -E '^ANTHROPIC_API_KEY=' .env | cut -d= -f2 || true)

if [ -z "$OPENAI_CURRENT" ] && [ -z "$ANTHROPIC_CURRENT" ]; then
  read -rp "  OpenAI API Key (Enter — пропустить): " INPUT_OPENAI || true
  if [ -n "${INPUT_OPENAI:-}" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=${INPUT_OPENAI}|" .env
    else
      sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=${INPUT_OPENAI}|" .env
    fi
    ok "OpenAI ключ сохранён"
  else
    warn "AI-функции будут недоступны (ключ не указан)"
  fi
else
  ok "API ключ уже настроен"
fi

# ── 4. Собираем и запускаем контейнеры ───────────────────
echo ""
info "Собираю и запускаю CodeSync..."
info "Первый запуск занимает 3-5 минут (загрузка образов и сборка)"
echo ""

$COMPOSE_CMD up -d --build

echo ""
info "Жду готовности сервисов..."

# Ждём API
ATTEMPTS=0
until curl -sf http://localhost:8080/api/healthz &>/dev/null || [ $ATTEMPTS -ge 30 ]; do
  sleep 3
  ATTEMPTS=$((ATTEMPTS + 1))
  printf "  ожидание API"
  for _ in $(seq 1 $ATTEMPTS); do printf "."; done
  printf "\r"
done

if curl -sf http://localhost:8080/api/healthz &>/dev/null; then
  ok "API сервер готов"
else
  warn "API сервер ещё запускается — открываю браузер заранее"
fi

# ── 5. Открываем браузер ─────────────────────────────────
echo ""
ok "CodeSync запущен!"
echo ""
echo -e "  ${BOLD}Адреса:${RESET}"
echo -e "  ${GREEN}Веб-версия:${RESET}      http://localhost"
echo -e "  ${GREEN}API:${RESET}             http://localhost:8080/api"
echo ""
echo -e "  ${BOLD}Управление:${RESET}"
echo -e "  Остановить:      ${CYAN}docker compose down${RESET}"
echo -e "  Удалить данные:  ${CYAN}docker compose down -v${RESET}"
echo -e "  Логи:            ${CYAN}docker compose logs -f${RESET}"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
  open "http://localhost" 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost" 2>/dev/null || true
fi

echo -e "${GREEN}${BOLD}Готово! Наслаждайся CodeSync.${RESET}"
echo ""
