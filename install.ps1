#Requires -Version 5.1
<#
.SYNOPSIS
    CodeSync Desktop — One-click installer for Windows
.DESCRIPTION
    Installs CodeSync Desktop with optional location selection,
    Start Menu shortcut, desktop shortcut, and PATH registration.
.PARAMETER Uninstall
    Remove a previously installed CodeSync Desktop.
.PARAMETER Dir
    Override the install directory (skips interactive prompt).
.PARAMETER NoShortcut
    Skip Start Menu shortcut creation.
.PARAMETER Silent
    Install silently to the default user directory with no prompts.
#>
param(
    [switch]$Uninstall,
    [string]$Dir      = "",
    [switch]$NoShortcut,
    [switch]$Silent
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─── Constants ────────────────────────────────────────────
$APP_NAME     = "CodeSync"
$APP_VERSION  = "1.0.0"
$GITHUB_REPO  = "your-org/codesync"
$RELEASES_URL = "https://github.com/$GITHUB_REPO/releases/latest/download"
$EXE_ASSET    = "${APP_NAME}-${APP_VERSION}-Setup.exe"

$DEFAULT_USER_DIR   = Join-Path $env:LOCALAPPDATA "Programs\$APP_NAME"
$DEFAULT_SYSTEM_DIR = Join-Path $env:ProgramFiles   $APP_NAME
$START_MENU_DIR     = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\CodeSync'
$UNINSTALL_REG      = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$APP_NAME"

$script:SpinnerJob  = $null

# ─── Colour helpers ───────────────────────────────────────
function Write-C {
    param([string]$Text, [ConsoleColor]$Fg = 'White', [switch]$NoNewline)
    $prev = [Console]::ForegroundColor
    [Console]::ForegroundColor = $Fg
    if ($NoNewline) { Write-Host $Text -NoNewline } else { Write-Host $Text }
    [Console]::ForegroundColor = $prev
}

function Write-Step { param([string]$m) Write-C "  `u{25B6}  $m" -Fg Cyan }
function Write-Ok   { param([string]$m) Write-C "  `u{2713}  $m" -Fg Green }
function Write-Info { param([string]$m) Write-C "  i  $m" -Fg DarkGray }
function Write-Warn { param([string]$m) Write-C "  !  $m" -Fg Yellow }
function Write-Hr   { Write-C "  ──────────────────────────────────────────────" -Fg DarkGray }
function Write-Fail {
    param([string]$m)
    Write-C "`n  X  Ошибка: $m`n" -Fg Red
    exit 1
}

# ─── Banner ───────────────────────────────────────────────
function Show-Banner {
    Clear-Host
    Write-C ""
    Write-C "  +=========================================================+" -Fg Magenta
    Write-C "  |                                                         |" -Fg Magenta
    Write-C "  |" -Fg Magenta -NoNewline
    Write-C "   CodeSync Desktop" -Fg Cyan -NoNewline
    Write-C "  --  Collaborative IDE                 " -Fg White -NoNewline
    Write-C "|" -Fg Magenta
    Write-C "  |                                                         |" -Fg Magenta
    Write-C "  |" -Fg Magenta -NoNewline
    Write-C "   v$APP_VERSION   *   Встроенный сервер   *   SQLite         " -Fg DarkGray -NoNewline
    Write-C "|" -Fg Magenta
    Write-C "  +=========================================================+" -Fg Magenta
    Write-C ""
}

# ─── Spinner ──────────────────────────────────────────────
function Start-Spinner { param([string]$Msg)
    $script:SpinnerJob = Start-Job -ScriptBlock {
        param($m)
        $f = '-','\\','|','/'
        $i = 0
        while ($true) {
            Write-Host ("`r  {0}  {1}..." -f $f[$i % 4], $m) -NoNewline
            $i++
            Start-Sleep -Milliseconds 120
        }
    } -ArgumentList $Msg
}

function Stop-Spinner {
    if ($script:SpinnerJob) {
        Stop-Job  $script:SpinnerJob -ErrorAction SilentlyContinue
        Remove-Job $script:SpinnerJob -ErrorAction SilentlyContinue
        $script:SpinnerJob = $null
        Write-Host ("`r" + (' ' * 60) + "`r") -NoNewline
    }
}

# ─── Download with progress bar ──────────────────────────
function Get-FileWithProgress {
    param([string]$Url, [string]$Dest)
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "CodeSync-Installer/$APP_VERSION")

    Register-ObjectEvent $wc DownloadProgressChanged -SourceIdentifier DLProgress -Action {
        $pct    = $Event.SourceEventArgs.ProgressPercentage
        $rcvd   = $Event.SourceEventArgs.BytesReceived
        $total  = $Event.SourceEventArgs.TotalBytesToReceive
        $filled = [int]([Math]::Round($pct * 28 / 100))
        $empty  = 28 - $filled
        $bar    = '|' * $filled + '.' * $empty
        $label  = if ($total -gt 0) {
            "{0:N1} / {1:N1} MB" -f ($rcvd/1MB), ($total/1MB)
        } else { "$([int]($rcvd/1KB)) KB" }
        Write-Host ("`r  [{0}] {1,3}%  {2}  " -f $bar, $pct, $label) -NoNewline
    } | Out-Null

    $task = $wc.DownloadFileTaskAsync($Url, $Dest)
    while (-not $task.IsCompleted) { Start-Sleep -Milliseconds 100 }
    Unregister-Event DLProgress -ErrorAction SilentlyContinue

    Write-Host ""
    if ($task.IsFaulted) { throw $task.Exception.InnerException }
}

# ─── Folder picker dialog ─────────────────────────────────
function Select-FolderDialog {
    param([string]$Desc, [string]$Initial)
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
    $dlg.Description         = $Desc
    $dlg.SelectedPath        = $Initial
    $dlg.ShowNewFolderButton = $true
    if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dlg.SelectedPath
    }
    return $Initial
}

# ─── Confirm prompt ───────────────────────────────────────
function Confirm-Prompt {
    param([string]$Msg, [string]$Default = 'y')
    $opts = if ($Default -eq 'y') { '[Y/n]' } else { '[y/N]' }
    Write-C "  ? " -Fg Cyan -NoNewline
    Write-Host "$Msg $opts`: " -NoNewline
    $a = Read-Host
    if (-not $a) { $a = $Default }
    return $a -imatch '^y'
}

# ─── Choose install dir ───────────────────────────────────
function Choose-InstallDir {
    Write-C ""
    Write-Hr
    Write-C ""
    Write-C "  Куда установить ${APP_NAME}?" -Fg White
    Write-C ""
    Write-C "  " -NoNewline; Write-C "  1)" -Fg Magenta -NoNewline
    Write-Host "  $DEFAULT_USER_DIR" -NoNewline
    Write-C "  (только текущий пользователь, рекомендуется)" -Fg DarkGray
    Write-C "  " -NoNewline; Write-C "  2)" -Fg Magenta -NoNewline
    Write-Host "  $DEFAULT_SYSTEM_DIR" -NoNewline
    Write-C "  (для всех пользователей, требуются права администратора)" -Fg DarkGray
    Write-C "  " -NoNewline; Write-C "  3)" -Fg Magenta -NoNewline
    Write-Host "  Выбрать папку через диалог"
    Write-C "  " -NoNewline; Write-C "  4)" -Fg Magenta -NoNewline
    Write-Host "  Ввести путь вручную"
    Write-C ""
    Write-C "  ? " -Fg Cyan -NoNewline
    Write-Host "Выбор [1-4, Enter = 1]: " -NoNewline
    $ch = Read-Host

    switch ($ch) {
        '2' {
            $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
                [Security.Principal.WindowsBuiltInRole]::Administrator)
            if (-not $isAdmin) {
                Write-Warn "Для Program Files нужны права администратора."
                Write-Info "Используется папка пользователя."
                return $DEFAULT_USER_DIR
            }
            return $DEFAULT_SYSTEM_DIR
        }
        '3' { return Select-FolderDialog -Desc "Выберите папку для установки CodeSync" -Initial $DEFAULT_USER_DIR }
        '4' {
            Write-C "  ? " -Fg Cyan -NoNewline
            Write-Host "Введите путь [$DEFAULT_USER_DIR]: " -NoNewline
            $p = Read-Host
            return if ($p) { $p } else { $DEFAULT_USER_DIR }
        }
        default { return $DEFAULT_USER_DIR }
    }
}

# ─── Locate or download binary ───────────────────────────
function Get-Binary {
    $scriptDir  = Split-Path -Parent $PSCommandPath
    $localBuild = Join-Path $scriptDir "artifacts\desktop\dist\electron\$EXE_ASSET"

    if (Test-Path $localBuild) {
        Write-Info "Найдена локальная сборка: $localBuild"
        return $localBuild
    }

    Write-Step "Загрузка $EXE_ASSET"
    $url  = "$RELEASES_URL/$EXE_ASSET"
    $dest = Join-Path ([System.IO.Path]::GetTempPath()) $EXE_ASSET
    Write-Info "URL: $url"

    try {
        Get-FileWithProgress -Url $url -Dest $dest
    } catch {
        Write-Fail "Не удалось загрузить файл: $_`n  Проверьте интернет-соединение."
    }

    return $dest
}

# ─── Run NSIS silent installer ────────────────────────────
function Install-App {
    param([string]$InstallerPath, [string]$InstallDir)
    Write-Step "Запуск установщика (режим без окон)"
    Write-Info "Папка: $InstallDir"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = $InstallerPath
    # NSIS: /S = silent, /D = destination (must be last, no quotes around path)
    $psi.Arguments = "/S /D=$InstallDir"
    $psi.Verb      = "runas"
    $psi.UseShellExecute = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    Start-Spinner "Установка"
    $proc.WaitForExit()
    Stop-Spinner

    if ($proc.ExitCode -ne 0) {
        Write-Warn "Установщик завершился с кодом $($proc.ExitCode)"
    } else {
        Write-Ok "Файлы приложения установлены"
    }
}

# ─── Add shortcuts ────────────────────────────────────────
function Add-Shortcut {
    param([string]$LnkPath, [string]$ExePath, [string]$Desc)
    $dir = Split-Path $LnkPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $sh       = New-Object -ComObject WScript.Shell
    $lnk      = $sh.CreateShortcut($LnkPath)
    $lnk.TargetPath        = $ExePath
    $lnk.WorkingDirectory  = Split-Path $ExePath
    $lnk.Description       = $Desc
    $lnk.Save()
}

# ─── Add to PATH (user scope) ─────────────────────────────
function Add-ToUserPath {
    param([string]$NewDir)
    $cur = [Environment]::GetEnvironmentVariable('PATH', 'User')
    if ($cur -notlike "*$NewDir*") {
        [Environment]::SetEnvironmentVariable('PATH', "$cur;$NewDir", 'User')
        $env:PATH += ";$NewDir"
        Write-Ok "Добавлено в PATH пользователя"
    } else {
        Write-Info "Уже есть в PATH"
    }
}

# ─── Register in Apps & Features ─────────────────────────
function Register-App {
    param([string]$InstallDir, [string]$ExePath)
    $uninstaller = Join-Path $InstallDir "Uninstall.exe"
    try {
        New-Item -Path $UNINSTALL_REG -Force | Out-Null
        $props = @{
            DisplayName     = "$APP_NAME Desktop"
            DisplayVersion  = $APP_VERSION
            Publisher       = "CodeSync Team"
            InstallLocation = $InstallDir
            UninstallString = $uninstaller
            DisplayIcon     = $ExePath
            NoModify        = 1
            NoRepair        = 1
        }
        foreach ($k in $props.Keys) {
            Set-ItemProperty -Path $UNINSTALL_REG -Name $k -Value $props[$k]
        }
        Write-Ok "Зарегистрировано в «Приложения и возможности»"
    } catch { Write-Info "Не удалось записать в реестр (не критично)" }
}

# ─── Find installed EXE ───────────────────────────────────
function Find-Exe {
    param([string]$InstallDir)
    $names = @("$APP_NAME.exe", "${APP_NAME} Desktop.exe", "codesync.exe")
    foreach ($n in $names) {
        $p = Join-Path $InstallDir $n
        if (Test-Path $p) { return $p }
    }
    $found = Get-ChildItem -Path $InstallDir -Filter "*.exe" -ErrorAction SilentlyContinue |
             Where-Object { $_.Name -notmatch -join('Uninstall','|','Update') } |
             Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

# ─── Uninstall ────────────────────────────────────────────
function Invoke-Uninstall {
    Show-Banner
    Write-Warn "Режим удаления"; Write-Hr; Write-C ""

    $exe = $null
    try {
        $reg = Get-ItemProperty -Path $UNINSTALL_REG -ErrorAction Stop
        $exe = Join-Path $reg.InstallLocation "$APP_NAME.exe"
        if (-not (Test-Path $exe)) { $exe = $null }
    } catch {}

    if (-not $exe) {
        foreach ($d in @($DEFAULT_USER_DIR, $DEFAULT_SYSTEM_DIR)) {
            $e = Find-Exe -InstallDir $d
            if ($e) { $exe = $e; break }
        }
    }

    if (-not $exe) { Write-Info "CodeSync не найден в стандартных местах.`n"; return }

    $installDir = Split-Path $exe
    Write-Info "Найдено: $exe"
    Write-C ""

    if (-not (Confirm-Prompt "Удалить CodeSync Desktop?")) { Write-C "  Отменено.`n"; return }

    $uninstExe = Join-Path $installDir "Uninstall.exe"
    if (Test-Path $uninstExe) {
        Write-Step "Запуск деинсталлятора"
        Start-Process $uninstExe -ArgumentList "/S" -Wait -Verb RunAs
        Write-Ok "Деинсталлятор завершён"
    } else {
        Write-Step "Удаление файлов"
        Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok "Файлы удалены: $installDir"
    }

    foreach ($lnk in @(
        (Join-Path $START_MENU_DIR "$APP_NAME.lnk"),
        (Join-Path ([Environment]::GetFolderPath('Desktop')) "$APP_NAME.lnk")
    )) { if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Ok "Ярлык удалён: $lnk" } }

    Remove-Item -Path $UNINSTALL_REG -Force -ErrorAction SilentlyContinue
    Write-Ok "Запись реестра удалена"

    $cur = [Environment]::GetEnvironmentVariable('PATH','User')
    $cleaned = ($cur -split ';' | Where-Object { $_ -ne $installDir }) -join ';'
    [Environment]::SetEnvironmentVariable('PATH', $cleaned, 'User')

    Write-C ""
    Write-Ok "CodeSync Desktop удалён.`n"
}

# ─── Summary ──────────────────────────────────────────────
function Show-Summary {
    param([string]$InstallDir, [string]$ExePath)
    Write-C ""
    Write-C "  +-------------------------------------------------+" -Fg Green
    Write-C "  |   CodeSync Desktop успешно установлен!          |" -Fg Green
    Write-C "  +-------------------------------------------------+" -Fg Green
    Write-C ""
    if ($ExePath) { Write-Info "Запустить: $ExePath" }
    Write-Info "Или найдите «CodeSync» в меню Пуск"
    Write-C ""
    Write-Info "При первом запуске откроются настройки API-ключей"
    Write-C ""

    if ($ExePath -and (Confirm-Prompt "Запустить CodeSync сейчас?")) {
        Start-Process $ExePath
    }
}

# ════════════════════════════════════════════════════════════
#   MAIN
# ════════════════════════════════════════════════════════════
Show-Banner

if ($Uninstall) { Invoke-Uninstall; exit 0 }

if ($env:OS -ne 'Windows_NT') {
    Write-Warn "Этот скрипт только для Windows."
    Write-Info "На Linux/macOS используйте:  bash install.sh"
    exit 1
}

Write-C "  Система: Windows $env:PROCESSOR_ARCHITECTURE`n" -Fg DarkGray
Write-Hr

# ── Choose directory ──────────────────────────────────────
if ($Dir) {
    $installDir = $Dir
    Write-C ""; Write-Ok "Папка установки: $installDir"
} elseif ($Silent) {
    $installDir = $DEFAULT_USER_DIR
    Write-C ""; Write-Ok "Тихая установка в: $installDir"
} else {
    $installDir = Choose-InstallDir
    Write-C ""; Write-Ok "Папка установки: $installDir"
}

if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# ── Confirm ───────────────────────────────────────────────
Write-C ""; Write-Hr; Write-C ""
Write-C "  Параметры установки:" -Fg White; Write-C ""
Write-C "    Приложение : $APP_NAME Desktop v$APP_VERSION"
Write-C "    Папка      : $installDir"
Write-C "    Система    : Windows / $env:PROCESSOR_ARCHITECTURE"
Write-C ""

if (-not $Silent -and -not (Confirm-Prompt "Начать установку?")) {
    Write-C "`n  Установка отменена.`n" -Fg Yellow; exit 0
}

Write-C ""; Write-Hr; Write-C ""

# ── Get + install ─────────────────────────────────────────
$installerPath = Get-Binary
Write-Ok "Файл: $(Split-Path -Leaf $installerPath)"
Write-C ""
Install-App -InstallerPath $installerPath -InstallDir $installDir

# ── Find EXE ─────────────────────────────────────────────
Write-C ""
Write-Hr
Write-Step "Проверка установки"
$exePath = Find-Exe -InstallDir $installDir
if ($exePath) { Write-Ok "Найдено: $exePath" } else { Write-Warn "EXE не обнаружен в $installDir" }

# ── Shortcuts ────────────────────────────────────────────
if (-not $NoShortcut -and $exePath) {
    if ($Silent -or (Confirm-Prompt "Создать ярлык в меню Пуск?")) {
        Add-Shortcut -LnkPath (Join-Path $START_MENU_DIR "$APP_NAME.lnk") `
                     -ExePath $exePath -Desc "CodeSync — Collaborative IDE"
        Write-Ok "Ярлык в меню Пуск создан"
    }
    if (-not $Silent -and (Confirm-Prompt "Создать ярлык на рабочем столе?")) {
        $desktop = [Environment]::GetFolderPath('Desktop')
        Add-Shortcut -LnkPath (Join-Path $desktop "$APP_NAME.lnk") `
                     -ExePath $exePath -Desc "CodeSync — Collaborative IDE"
        Write-Ok "Ярлык на рабочем столе создан"
    }
}

# ── PATH ─────────────────────────────────────────────────
if (-not $Silent -and (Confirm-Prompt "Добавить папку установки в PATH?")) {
    Add-ToUserPath -NewDir $installDir
}

# ── Registry ─────────────────────────────────────────────
if ($exePath) { Register-App -InstallDir $installDir -ExePath $exePath }

# ── Done ─────────────────────────────────────────────────
Show-Summary -InstallDir $installDir -ExePath $exePath
