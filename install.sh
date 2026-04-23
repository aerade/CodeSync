#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║        CodeSync Desktop — One-click installer            ║
# ║  https://github.com/your-org/codesync                   ║
# ╚══════════════════════════════════════════════════════════╝
set -euo pipefail

# ─── Colours ──────────────────────────────────────────────
BL='\033[0;34m'; CY='\033[0;36m'; GR='\033[0;32m'
YL='\033[0;33m'; RD='\033[0;31m'; PU='\033[0;35m'
BO='\033[1m';    DM='\033[2m';    RS='\033[0m'

# ─── Constants ────────────────────────────────────────────
APP_NAME="CodeSync"
APP_VERSION="1.0.0"
GITHUB_REPO="your-org/codesync"
RELEASES_URL="https://github.com/${GITHUB_REPO}/releases/latest/download"
DESKTOP_DIR="$HOME/.local/share/applications"
APP_ID="codesync-desktop"

NEED_SUDO=0
INSTALL_DIR=""

# ─── Helpers ──────────────────────────────────────────────
banner() {
  clear
  printf "${PU}${BO}"
  printf "  ╔══════════════════════════════════════════════════════════╗\n"
  printf "  ║                                                          ║\n"
  printf "  ║   ${CY}CodeSync Desktop${PU}${BO}  —  Collaborative IDE                ║\n"
  printf "  ║                                                          ║\n"
  printf "  ║   ${DM}${PU}v${APP_VERSION}   •   Встроенный сервер   •   SQLite${BO}${PU}          ║\n"
  printf "  ╚══════════════════════════════════════════════════════════╝${RS}\n\n"
}

step() { printf "  ${BL}${BO}▶${RS}  ${BO}$1${RS}\n"; }
ok()   { printf "  ${GR}${BO}✓${RS}  $1\n"; }
info() { printf "  ${CY}ℹ${RS}  ${DM}$1${RS}\n"; }
warn() { printf "  ${YL}⚠${RS}  $1\n"; }
fail() { printf "\n  ${RD}${BO}✗  Ошибка: $1${RS}\n\n"; exit 1; }
hr()   { printf "  ${DM}──────────────────────────────────────────────${RS}\n"; }

spinner_start() {
  local msg=$1
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  tput civis 2>/dev/null || true
  while true; do
    printf "\r  ${PU}${frames[$i]}${RS}  ${DM}${msg}...${RS}"
    i=$(( (i+1) % ${#frames[@]} ))
    sleep 0.08
  done &
  SPINNER_PID=$!
}

spinner_stop() {
  [[ -n "${SPINNER_PID:-}" ]] && kill "$SPINNER_PID" 2>/dev/null || true
  SPINNER_PID=""
  tput cnorm 2>/dev/null || true
  printf "\r%-60s\r" " "
}

confirm() {
  local msg=$1 default=${2:-y}
  local opts="[Y/n]"; [[ "$default" == "n" ]] && opts="[y/N]"
  printf "  ${CY}?${RS}  ${BO}${msg}${RS} ${DM}${opts}${RS}: "
  read -r answer
  answer="${answer:-$default}"
  [[ "$answer" =~ ^[Yy]$ ]]
}

# ─── Detect OS / Arch ─────────────────────────────────────
OS="unknown"; ARCH="$(uname -m)"
case "$(uname -s)" in
  Linux*)  OS="linux"  ;;
  Darwin*) OS="macos"  ;;
  CYGWIN*|MINGW*|MSYS*) OS="windows" ;;
esac

[[ "$OS" == "windows" ]] && {
  banner
  warn "Обнаружена Windows. Используйте install.ps1 из PowerShell."
  printf "\n  ${CY}${BO}  powershell -ExecutionPolicy Bypass -File install.ps1${RS}\n\n"
  exit 0
}
[[ "$OS" == "unknown" ]] && fail "Неизвестная ОС: $(uname -s)"

# ─── Choose binary by OS+Arch ─────────────────────────────
asset_name() {
  case "$OS" in
    linux)
      case "$ARCH" in
        x86_64)  echo "${APP_NAME}-${APP_VERSION}.AppImage" ;;
        aarch64) echo "${APP_NAME}-${APP_VERSION}-arm64.AppImage" ;;
        *)        fail "Архитектура ${ARCH} не поддерживается" ;;
      esac ;;
    macos)
      case "$ARCH" in
        arm64)   echo "${APP_NAME}-${APP_VERSION}-arm64.dmg" ;;
        *)       echo "${APP_NAME}-${APP_VERSION}.dmg" ;;
      esac ;;
  esac
}

# ─── Check deps ───────────────────────────────────────────
check_deps() {
  step "Проверка зависимостей"
  local missing=()
  command -v curl  &>/dev/null || missing+=("curl")
  command -v chmod &>/dev/null || missing+=("chmod")
  [[ ${#missing[@]} -gt 0 ]] && fail "Не найдены: ${missing[*]}"
  ok "Все зависимости найдены"
}

# ─── Choose install dir ───────────────────────────────────
choose_install_dir() {
  printf "\n"; hr
  printf "\n  ${BO}${CY}Куда установить ${APP_NAME}?${RS}\n\n"

  if [[ "$OS" == "macos" ]]; then
    printf "  ${PU}${BO}  1)${RS}  $HOME/Applications  ${DM}(только текущий пользователь, рекомендуется)${RS}\n"
    printf "  ${PU}${BO}  2)${RS}  /Applications       ${DM}(для всех пользователей, нужен sudo)${RS}\n"
    printf "  ${PU}${BO}  3)${RS}  Указать путь вручную\n\n"
    printf "  ${CY}?${RS}  ${BO}Выбор${RS} ${DM}[1-3]${RS}: "; read -r ch
    case "${ch:-1}" in
      1) INSTALL_DIR="$HOME/Applications" ;;
      2) INSTALL_DIR="/Applications"; NEED_SUDO=1 ;;
      3) printf "  ${CY}?${RS}  ${BO}Путь${RS} ${DM}[$HOME/Applications]${RS}: "; read -r d
         INSTALL_DIR="${d:-$HOME/Applications}" ;;
      *) INSTALL_DIR="$HOME/Applications" ;;
    esac
  else
    printf "  ${PU}${BO}  1)${RS}  $HOME/.local/bin    ${DM}(только текущий пользователь, рекомендуется)${RS}\n"
    printf "  ${PU}${BO}  2)${RS}  /usr/local/bin      ${DM}(для всех пользователей, нужен sudo)${RS}\n"
    printf "  ${PU}${BO}  3)${RS}  Указать путь вручную\n\n"
    printf "  ${CY}?${RS}  ${BO}Выбор${RS} ${DM}[1-3]${RS}: "; read -r ch
    case "${ch:-1}" in
      1) INSTALL_DIR="$HOME/.local/bin" ;;
      2) INSTALL_DIR="/usr/local/bin"; NEED_SUDO=1 ;;
      3) printf "  ${CY}?${RS}  ${BO}Путь${RS} ${DM}[$HOME/.local/bin]${RS}: "; read -r d
         INSTALL_DIR="${d:-$HOME/.local/bin}" ;;
      *) INSTALL_DIR="$HOME/.local/bin" ;;
    esac
  fi

  INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"
  printf "\n"; ok "Папка установки: ${BO}${INSTALL_DIR}${RS}"
}

# ─── Download or locate binary ────────────────────────────
get_binary() {
  local asset; asset=$(asset_name)
  # Check if bundled alongside the script
  local script_dir; script_dir="$(cd "$(dirname "$0")" && pwd)"
  local local_path="${script_dir}/artifacts/desktop/dist/electron/${asset}"

  if [[ -f "$local_path" ]]; then
    info "Найдена локальная сборка: ${local_path}"
    BINARY_PATH="$local_path"
    return
  fi

  step "Загрузка ${asset}"
  local tmp_dir; tmp_dir="$(mktemp -d)"
  BINARY_PATH="${tmp_dir}/${asset}"
  local url="${RELEASES_URL}/${asset}"
  info "URL: ${url}"

  if curl -fL --progress-bar "$url" -o "$BINARY_PATH" 2>&1; then
    printf "\n"
  else
    rm -rf "$tmp_dir"
    fail "Не удалось загрузить файл. Проверьте интернет-соединение."
  fi
}

# ─── Linux install ────────────────────────────────────────
install_linux() {
  get_binary
  local dest="${INSTALL_DIR}/$(basename "$BINARY_PATH")"
  local link="${INSTALL_DIR}/codesync"

  step "Создание папки ${INSTALL_DIR}"
  mkdir -p "$INSTALL_DIR"

  step "Копирование AppImage"
  local scmd=""
  [[ $NEED_SUDO -eq 1 && ! -w "$INSTALL_DIR" ]] && scmd="sudo"
  $scmd cp "$BINARY_PATH" "$dest"
  $scmd chmod +x "$dest"
  ok "AppImage установлен"

  # Symlink without version
  $scmd ln -sf "$dest" "$link" 2>/dev/null && ok "Создана ссылка: ${link}" || true

  # Desktop entry
  if confirm "Создать ярлык в меню приложений?" "y"; then
    mkdir -p "$DESKTOP_DIR"
    cat > "${DESKTOP_DIR}/${APP_ID}.desktop" << DESKTOP
[Desktop Entry]
Name=CodeSync Desktop
GenericName=Collaborative IDE
Comment=Collaborative code editor with embedded server and SQLite storage
Exec=${dest} %U
Icon=code
Terminal=false
Type=Application
Categories=Development;IDE;TextEditor;
Keywords=code;editor;collaborative;ide;
StartupWMClass=CodeSync
DESKTOP
    command -v update-desktop-database &>/dev/null && \
      update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    ok "Ярлык добавлен в меню приложений"
  fi

  # PATH
  if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
    if confirm "Добавить ${INSTALL_DIR} в PATH?" "y"; then
      local export_line="export PATH=\"${INSTALL_DIR}:\$PATH\""
      for rc in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.zshrc" "$HOME/.profile"; do
        [[ -f "$rc" ]] && ! grep -qF "$INSTALL_DIR" "$rc" && \
          printf "\n# CodeSync installer\n%s\n" "$export_line" >> "$rc" && ok "→ $rc"
      done
      export PATH="${INSTALL_DIR}:$PATH"
    fi
  fi
}

# ─── macOS install ────────────────────────────────────────
install_macos() {
  get_binary
  local dmg="$BINARY_PATH"

  step "Монтирование образа диска"
  spinner_start "Монтирование"
  local mount_point
  mount_point=$(hdiutil attach "$dmg" -nobrowse -noverify 2>/dev/null | \
    awk '/\/Volumes/ { print $NF }')
  spinner_stop
  [[ -z "$mount_point" ]] && fail "Не удалось смонтировать DMG"
  ok "Диск смонтирован: ${mount_point}"

  step "Копирование приложения в ${INSTALL_DIR}"
  mkdir -p "$INSTALL_DIR"
  local scmd=""
  [[ $NEED_SUDO -eq 1 && ! -w "$INSTALL_DIR" ]] && scmd="sudo"

  spinner_start "Копирование"
  $scmd cp -R "${mount_point}/${APP_NAME}.app" "${INSTALL_DIR}/" 2>/dev/null
  spinner_stop
  ok "${APP_NAME}.app скопировано"

  step "Снятие карантина macOS"
  xattr -cr "${INSTALL_DIR}/${APP_NAME}.app" 2>/dev/null && ok "Карантин снят" || true

  step "Отмонтирование"
  hdiutil detach "$mount_point" -quiet 2>/dev/null || true
  ok "Диск отмонтирован"
}

# ─── Verify ───────────────────────────────────────────────
verify() {
  printf "\n"; hr; step "Проверка установки"
  local found=0
  case "$OS" in
    linux) [[ -x "${INSTALL_DIR}/codesync" ]] && found=1 || \
           ls "${INSTALL_DIR}/"*.AppImage &>/dev/null 2>&1 && found=1 || true ;;
    macos) [[ -d "${INSTALL_DIR}/${APP_NAME}.app" ]] && found=1 || true ;;
  esac
  [[ $found -eq 1 ]] && ok "${BO}Установка прошла успешно!${RS}" || \
    warn "Файл не обнаружен — проверьте ${INSTALL_DIR} вручную"
}

# ─── Summary ──────────────────────────────────────────────
summary() {
  printf "\n"
  printf "  ${GR}${BO}┌──────────────────────────────────────────────────┐${RS}\n"
  printf "  ${GR}${BO}│   CodeSync Desktop установлен!                   │${RS}\n"
  printf "  ${GR}${BO}└──────────────────────────────────────────────────┘${RS}\n\n"
  case "$OS" in
    linux)
      info "Запустить: ${BO}${INSTALL_DIR}/codesync${RS}"
      [[ -f "${DESKTOP_DIR}/${APP_ID}.desktop" ]] && \
        info "Или найдите ${BO}CodeSync${RS} в меню приложений"
      ;;
    macos)
      info "Откройте ${BO}${INSTALL_DIR}/${APP_NAME}.app${RS}"
      info "Или найдите ${BO}CodeSync${RS} в Spotlight (⌘+Пробел)"
      ;;
  esac
  printf "\n"
  info "При первом запуске откроются настройки API-ключей"
  printf "\n"
}

# ─── Uninstall ────────────────────────────────────────────
do_uninstall() {
  banner; warn "Режим удаления"; hr; printf "\n"
  local targets=(
    "$HOME/.local/bin/codesync"
    "$HOME/.local/bin/CodeSync.AppImage"
    "$HOME/.local/bin/CodeSync-${APP_VERSION}.AppImage"
    "/usr/local/bin/codesync"
    "${DESKTOP_DIR}/${APP_ID}.desktop"
    "$HOME/Applications/${APP_NAME}.app"
    "/Applications/${APP_NAME}.app"
  )
  local removed=0
  for t in "${targets[@]}"; do
    if [[ -e "$t" ]]; then
      if confirm "Удалить ${t}?" "y"; then
        rm -rf "$t" && ok "Удалено: $t" && ((removed++)) || warn "Не удалось удалить: $t"
      fi
    fi
  done
  command -v update-desktop-database &>/dev/null && \
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
  [[ $removed -gt 0 ]] && ok "Готово ($removed файлов удалено)" || info "Ничего не найдено"
}

# ─── Parse args ───────────────────────────────────────────
UNINSTALL=0; FORCE_DIR=""
for arg in "$@"; do
  case "$arg" in
    --uninstall)    UNINSTALL=1 ;;
    --help|-h)
      banner
      printf "  ${BO}Использование:${RS}\n\n"
      printf "    ${GR}bash install.sh${RS}              — интерактивная установка\n"
      printf "    ${GR}bash install.sh --uninstall${RS}  — удаление\n"
      printf "    ${GR}bash install.sh --dir PATH${RS}   — установка в указанный путь\n\n"
      exit 0 ;;
    --dir=*) FORCE_DIR="${arg#--dir=}" ;;
    --dir)   shift; FORCE_DIR="${1:-}" ;;
  esac
done

# ─── Main ─────────────────────────────────────────────────
main() {
  banner

  [[ $UNINSTALL -eq 1 ]] && { do_uninstall; exit 0; }

  printf "  ${DM}Система: ${BO}$(uname -s) $(uname -m)${RS}\n\n"; hr

  check_deps

  if [[ -n "$FORCE_DIR" ]]; then
    INSTALL_DIR="${FORCE_DIR/#\~/$HOME}"
    printf "\n"; ok "Папка установки: ${BO}${INSTALL_DIR}${RS}"
  else
    choose_install_dir
  fi

  printf "\n"; hr
  printf "\n  ${BO}Параметры установки:${RS}\n\n"
  printf "    Приложение : ${BO}${APP_NAME} Desktop v${APP_VERSION}${RS}\n"
  printf "    Папка      : ${BO}${INSTALL_DIR}${RS}\n"
  printf "    Система    : ${BO}${OS} / ${ARCH}${RS}\n\n"

  if ! confirm "Начать установку?" "y"; then
    printf "\n  ${YL}Установка отменена.${RS}\n\n"; exit 0
  fi

  printf "\n"; hr; printf "\n"

  case "$OS" in
    linux) install_linux ;;
    macos) install_macos ;;
  esac

  verify
  summary
}

main
