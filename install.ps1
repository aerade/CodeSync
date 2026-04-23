#Requires -Version 5.1
<#
.SYNOPSIS
    CodeSync Desktop -- Installer for Windows
.DESCRIPTION
    Installs CodeSync Desktop with directory selection,
    Start Menu and Desktop shortcuts, and PATH registration.
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
    [string]$Dir = "",
    [switch]$NoShortcut,
    [switch]$Silent
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
$APP_NAME     = "CodeSync"
$APP_VERSION  = "1.0.0"
$GITHUB_REPO  = "your-org/codesync"
$RELEASES_URL = "https://github.com/$GITHUB_REPO/releases/latest/download"
$EXE_ASSET    = "$APP_NAME-$APP_VERSION-Setup.exe"

$DEFAULT_USER_DIR   = Join-Path $env:LOCALAPPDATA "Programs\$APP_NAME"
$DEFAULT_SYSTEM_DIR = Join-Path $env:ProgramFiles  $APP_NAME
$START_MENU_DIR     = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\CodeSync'
$UNINSTALL_REG      = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$APP_NAME"

$script:SpinnerJob  = $null

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
function Clr {
    param([string]$Text, [ConsoleColor]$Fg = 'White', [switch]$NoNewline)
    $old = [Console]::ForegroundColor
    [Console]::ForegroundColor = $Fg
    if ($NoNewline) { Write-Host $Text -NoNewline } else { Write-Host $Text }
    [Console]::ForegroundColor = $old
}

function Write-Step { param([string]$m) Clr "  >>  $m" Cyan }
function Write-Ok   { param([string]$m) Clr "  OK  $m" Green }
function Write-Info { param([string]$m) Clr "   i  $m" DarkGray }
function Write-Warn { param([string]$m) Clr "  **  $m" Yellow }
function Write-Hr   { Clr "  -----------------------------------------------" DarkGray }
function Write-Fail {
    param([string]$m)
    Clr "`n  !!  Oshibka: $m`n" Red
    exit 1
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
function Show-Banner {
    Clear-Host
    Clr ""
    Clr "  +=========================================================+" Magenta
    Clr "  |                                                         |" Magenta
    Clr "  |" Magenta -NoNewline; Clr "   CodeSync Desktop" Cyan -NoNewline
    Clr "  --  Collaborative IDE                 |" Magenta
    Clr "  |                                                         |" Magenta
    Clr "  |" Magenta -NoNewline
    Clr ("   v" + $APP_VERSION + "   *   Embedded server   *   SQLite         |") DarkGray
    Clr "  +=========================================================+" Magenta
    Clr ""
}

# ---------------------------------------------------------------------------
# Spinner (background job)
# ---------------------------------------------------------------------------
function Start-Spin {
    param([string]$Msg)
    $script:SpinnerJob = Start-Job -ScriptBlock {
        param($m)
        $i = 0
        while ($true) {
            $c = @('-', '\', '|', '/')[$i % 4]
            Write-Host ("`r  $c  $m...   ") -NoNewline
            $i++
            Start-Sleep -Milliseconds 120
        }
    } -ArgumentList $Msg
}

function Stop-Spin {
    if ($null -ne $script:SpinnerJob) {
        Stop-Job   $script:SpinnerJob -ErrorAction SilentlyContinue
        Remove-Job $script:SpinnerJob -ErrorAction SilentlyContinue
        $script:SpinnerJob = $null
        Write-Host ("`r" + (" " * 60) + "`r") -NoNewline
    }
}

# ---------------------------------------------------------------------------
# Download with console progress bar
# ---------------------------------------------------------------------------
function Get-FileProgress {
    param([string]$Url, [string]$Dest)

    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add("User-Agent", "CodeSync-Installer/$APP_VERSION")

    $global:_dlDone = $false

    Register-ObjectEvent -InputObject $wc -EventName DownloadProgressChanged `
        -SourceIdentifier "_DLP" -Action {
            $pct    = $Event.SourceEventArgs.ProgressPercentage
            $rcvd   = $Event.SourceEventArgs.BytesReceived
            $total  = $Event.SourceEventArgs.TotalBytesToReceive
            $filled = [int]([Math]::Round($pct * 28 / 100))
            $empty  = 28 - $filled
            $bar    = ('|' * $filled) + ('.' * $empty)
            if ($total -gt 0) {
                $lbl = "{0:N1}/{1:N1} MB" -f ($rcvd / 1MB), ($total / 1MB)
            } else {
                $lbl = "{0} KB" -f [int]($rcvd / 1KB)
            }
            Write-Host ("`r  [{0}] {1,3}%  {2}  " -f $bar, $pct, $lbl) -NoNewline
        } | Out-Null

    Register-ObjectEvent -InputObject $wc -EventName DownloadFileCompleted `
        -SourceIdentifier "_DLC" -Action {
            $global:_dlDone = $true
        } | Out-Null

    $wc.DownloadFileAsync($Url, $Dest)
    while (-not $global:_dlDone) { Start-Sleep -Milliseconds 100 }

    Unregister-Event "_DLP" -ErrorAction SilentlyContinue
    Unregister-Event "_DLC" -ErrorAction SilentlyContinue
    Write-Host ""

    if (-not (Test-Path $Dest)) {
        throw "Fail ne zagruzhen"
    }
}

# ---------------------------------------------------------------------------
# Folder picker dialog (Windows Forms)
# ---------------------------------------------------------------------------
function Select-Folder {
    param([string]$Desc, [string]$Initial)
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
    $dlg.Description         = $Desc
    $dlg.SelectedPath        = $Initial
    $dlg.ShowNewFolderButton = $true
    $result = $dlg.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dlg.SelectedPath
    }
    return $Initial
}

# ---------------------------------------------------------------------------
# Yes/No prompt
# ---------------------------------------------------------------------------
function Confirm-Prompt {
    param([string]$Msg, [string]$Default = 'y')
    $opts = if ($Default -eq 'y') { '[Y/n]' } else { '[y/N]' }
    Clr "  ? " Cyan -NoNewline
    Write-Host "$Msg $opts`: " -NoNewline
    $a = Read-Host
    if ([string]::IsNullOrWhiteSpace($a)) { $a = $Default }
    return $a -imatch '^y'
}

# ---------------------------------------------------------------------------
# Choose install directory
# ---------------------------------------------------------------------------
function Choose-Dir {
    Clr ""
    Write-Hr
    Clr ""
    Clr "  Kuda ustanovit $APP_NAME`?" White
    Clr ""
    Clr "  " -NoNewline; Clr "  1)" Magenta -NoNewline
    Write-Host "  $DEFAULT_USER_DIR" -NoNewline
    Clr "  (tolko tekushchiy polzovatel, rekomenduetsya)" DarkGray

    Clr "  " -NoNewline; Clr "  2)" Magenta -NoNewline
    Write-Host "  $DEFAULT_SYSTEM_DIR" -NoNewline
    Clr "  (dlya vsekh polzovateley, nuzhny prava admina)" DarkGray

    Clr "  " -NoNewline; Clr "  3)" Magenta -NoNewline
    Write-Host "  Vybrat papku cherez dialog Windows"

    Clr "  " -NoNewline; Clr "  4)" Magenta -NoNewline
    Write-Host "  Vvesti put vruchnuyu"

    Clr ""
    Clr "  ? " Cyan -NoNewline
    Write-Host "Vybor [1-4, Enter = 1]: " -NoNewline
    $ch = Read-Host

    if ($ch -eq '2') {
        $isAdmin = ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
            [Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdmin) {
            Write-Warn "Dlya Program Files nuzhny prava administratora."
            Write-Info "Ispolzuetsya papka polzovatelya."
            return $DEFAULT_USER_DIR
        }
        return $DEFAULT_SYSTEM_DIR
    }
    elseif ($ch -eq '3') {
        return (Select-Folder -Desc "Vyberite papku dlya ustanovki CodeSync" -Initial $DEFAULT_USER_DIR)
    }
    elseif ($ch -eq '4') {
        Clr "  ? " Cyan -NoNewline
        Write-Host "Put [$DEFAULT_USER_DIR]: " -NoNewline
        $p = Read-Host
        if ([string]::IsNullOrWhiteSpace($p)) {
            return $DEFAULT_USER_DIR
        }
        return $p
    }
    else {
        return $DEFAULT_USER_DIR
    }
}

# ---------------------------------------------------------------------------
# Get installer (local build or download)
# ---------------------------------------------------------------------------
function Get-Installer {
    $scriptDir  = Split-Path -Parent $MyInvocation.ScriptName
    if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = $PSScriptRoot }
    $localBuild = Join-Path $scriptDir "artifacts\desktop\dist\electron\$EXE_ASSET"

    if (Test-Path $localBuild) {
        Write-Info "Lokalnaya sborka: $localBuild"
        return $localBuild
    }

    Write-Step "Zagruzka $EXE_ASSET"
    $url  = "$RELEASES_URL/$EXE_ASSET"
    $dest = Join-Path ([System.IO.Path]::GetTempPath()) $EXE_ASSET
    Write-Info "URL: $url"

    try {
        Get-FileProgress -Url $url -Dest $dest
    }
    catch {
        Write-Fail "Ne udalos zaguzit fayl. Proverte internet."
    }
    return $dest
}

# ---------------------------------------------------------------------------
# Run NSIS installer silently
# ---------------------------------------------------------------------------
function Install-App {
    param([string]$Installer, [string]$InstallDir)
    Write-Step "Zapusk ustanovshchika"
    Write-Info "Papka: $InstallDir"

    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    # NSIS silent: /S = silent, /D= must be the very last argument with no quotes
    $argStr = "/S /D=$InstallDir"
    try {
        $proc = Start-Process -FilePath $Installer -ArgumentList $argStr `
            -Wait -PassThru -Verb RunAs
    }
    catch {
        # If runas fails (e.g. no UAC), try without elevation
        $proc = Start-Process -FilePath $Installer -ArgumentList $argStr `
            -Wait -PassThru
    }

    Start-Spin "Ustanavlivayu"
    Start-Sleep -Seconds 1   # give NSIS time to finish writing
    Stop-Spin

    if ($null -ne $proc -and $proc.ExitCode -ne 0) {
        Write-Warn "Ustanovshchik zavershilsya s kodom $($proc.ExitCode)"
    }
    else {
        Write-Ok "Fayly prilozheniya ustanovleny"
    }
}

# ---------------------------------------------------------------------------
# Create shortcut (.lnk)
# ---------------------------------------------------------------------------
function Add-Shortcut {
    param([string]$LnkPath, [string]$ExePath, [string]$Desc)
    $dir = Split-Path $LnkPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $sh  = New-Object -ComObject WScript.Shell
    $lnk = $sh.CreateShortcut($LnkPath)
    $lnk.TargetPath       = $ExePath
    $lnk.WorkingDirectory = Split-Path $ExePath
    $lnk.Description      = $Desc
    $lnk.Save()
}

# ---------------------------------------------------------------------------
# Add directory to user PATH
# ---------------------------------------------------------------------------
function Add-ToPath {
    param([string]$NewDir)
    $cur = [Environment]::GetEnvironmentVariable('PATH', 'User')
    if ($cur -notlike "*$NewDir*") {
        [Environment]::SetEnvironmentVariable('PATH', "$cur;$NewDir", 'User')
        $env:PATH = "$env:PATH;$NewDir"
        Write-Ok "Dobavleno v PATH polzovatelya"
    }
    else {
        Write-Info "Uzhe est v PATH"
    }
}

# ---------------------------------------------------------------------------
# Register in Apps & Features (HKCU uninstall key)
# ---------------------------------------------------------------------------
function Register-App {
    param([string]$InstallDir, [string]$ExePath)
    try {
        New-Item -Path $UNINSTALL_REG -Force | Out-Null
        Set-ItemProperty $UNINSTALL_REG "DisplayName"    "$APP_NAME Desktop"
        Set-ItemProperty $UNINSTALL_REG "DisplayVersion" $APP_VERSION
        Set-ItemProperty $UNINSTALL_REG "Publisher"      "CodeSync Team"
        Set-ItemProperty $UNINSTALL_REG "InstallLocation" $InstallDir
        Set-ItemProperty $UNINSTALL_REG "UninstallString" (Join-Path $InstallDir "Uninstall.exe")
        Set-ItemProperty $UNINSTALL_REG "DisplayIcon"    $ExePath
        Set-ItemProperty $UNINSTALL_REG "NoModify"       1
        Set-ItemProperty $UNINSTALL_REG "NoRepair"       1
        Write-Ok "Zaregistrirovano v 'Prilozheniia i vozmozhnosti'"
    }
    catch {
        Write-Info "Ne udalos zapisat v reestr (ne kriticno)"
    }
}

# ---------------------------------------------------------------------------
# Find installed .exe in a directory
# ---------------------------------------------------------------------------
function Find-Exe {
    param([string]$InstallDir)
    if (-not (Test-Path $InstallDir)) { return $null }
    foreach ($name in @("$APP_NAME.exe", "$APP_NAME Desktop.exe", "codesync.exe")) {
        $p = Join-Path $InstallDir $name
        if (Test-Path $p) { return $p }
    }
    $found = Get-ChildItem -Path $InstallDir -Filter "*.exe" -ErrorAction SilentlyContinue |
             Where-Object { $_.Name -notmatch "(?i)(uninstall|update)" } |
             Select-Object -First 1
    if ($null -ne $found) { return $found.FullName }
    return $null
}

# ---------------------------------------------------------------------------
# Uninstall mode
# ---------------------------------------------------------------------------
function Invoke-Uninstall {
    Show-Banner
    Write-Warn "Rezhim udaleniya"
    Write-Hr
    Clr ""

    $exePath = $null
    try {
        $reg = Get-ItemProperty -Path $UNINSTALL_REG -ErrorAction Stop
        $exePath = Join-Path $reg.InstallLocation "$APP_NAME.exe"
        if (-not (Test-Path $exePath)) { $exePath = $null }
    }
    catch { }

    if ($null -eq $exePath) {
        foreach ($d in @($DEFAULT_USER_DIR, $DEFAULT_SYSTEM_DIR)) {
            $e = Find-Exe -InstallDir $d
            if ($null -ne $e) { $exePath = $e; break }
        }
    }

    if ($null -eq $exePath) {
        Write-Info "CodeSync ne najden v standartnych mestakh."
        return
    }

    $installDir = Split-Path $exePath
    Write-Info "Nayden: $exePath"
    Clr ""

    if (-not (Confirm-Prompt "Udalit CodeSync Desktop?")) {
        Clr "  Otmeneno.`n"; return
    }

    $uninst = Join-Path $installDir "Uninstall.exe"
    if (Test-Path $uninst) {
        Write-Step "Zapusk deinstalliatora"
        Start-Process $uninst -ArgumentList "/S" -Wait -Verb RunAs
        Write-Ok "Deinstalliator zavershen"
    }
    else {
        Write-Step "Udalenie fajlov"
        Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok "Fajly udaleny: $installDir"
    }

    foreach ($lnk in @(
        (Join-Path $START_MENU_DIR "$APP_NAME.lnk"),
        (Join-Path ([Environment]::GetFolderPath('Desktop')) "$APP_NAME.lnk")
    )) {
        if (Test-Path $lnk) { Remove-Item $lnk -Force; Write-Ok "Yarlik udalen: $lnk" }
    }

    Remove-Item -Path $UNINSTALL_REG -Force -ErrorAction SilentlyContinue
    Write-Ok "Zapis reestra udalena"

    $cur = [Environment]::GetEnvironmentVariable('PATH', 'User')
    $cleaned = ($cur -split ';' | Where-Object { $_ -ne $installDir }) -join ';'
    [Environment]::SetEnvironmentVariable('PATH', $cleaned, 'User')

    Clr ""
    Write-Ok "CodeSync Desktop udalen.`n"
}

# ---------------------------------------------------------------------------
# Summary after install
# ---------------------------------------------------------------------------
function Show-Summary {
    param([string]$InstallDir, [string]$ExePath)
    Clr ""
    Clr "  +-------------------------------------------------+" Green
    Clr "  |   CodeSync Desktop uspeshno ustanovlen!         |" Green
    Clr "  +-------------------------------------------------+" Green
    Clr ""
    if (-not [string]::IsNullOrEmpty($ExePath)) {
        Write-Info "Zapustit: $ExePath"
    }
    Write-Info "Ili naydite 'CodeSync' v menyu Pusk"
    Clr ""
    Write-Info "Pri pervom zapuske otktoyutsya nastrojki API-klyuchej"
    Clr ""

    if (-not [string]::IsNullOrEmpty($ExePath)) {
        if (Confirm-Prompt "Zapustit CodeSync sejchas?") {
            Start-Process $ExePath
        }
    }
}

# ===========================================================================
# MAIN
# ===========================================================================
Show-Banner

if ($Uninstall) { Invoke-Uninstall; exit 0 }

if ($env:OS -ne 'Windows_NT') {
    Write-Warn "Etot skript tolko dlya Windows."
    Write-Info "Na Linux/macOS ispolzujte:  bash install.sh"
    exit 1
}

Clr "  Sistema: Windows $env:PROCESSOR_ARCHITECTURE`n" DarkGray
Write-Hr

# -- Choose directory --------------------------------------------------------
if (-not [string]::IsNullOrEmpty($Dir)) {
    $installDir = $Dir
    Clr ""; Write-Ok "Papka ustanovki: $installDir"
}
elseif ($Silent) {
    $installDir = $DEFAULT_USER_DIR
    Clr ""; Write-Ok "Tichaja ustanovka v: $installDir"
}
else {
    $installDir = Choose-Dir
    Clr ""; Write-Ok "Papka ustanovki: $installDir"
}

# -- Confirm -----------------------------------------------------------------
Clr ""; Write-Hr; Clr ""
Clr "  Parametry ustanovki:" White; Clr ""
Clr "    Prilozhenie : $APP_NAME Desktop v$APP_VERSION"
Clr "    Papka       : $installDir"
Clr "    Sistema     : Windows / $env:PROCESSOR_ARCHITECTURE"
Clr ""

if (-not $Silent) {
    if (-not (Confirm-Prompt "Nachat ustanovku?")) {
        Clr "`n  Ustanovka otmenena.`n" Yellow; exit 0
    }
}

Clr ""; Write-Hr; Clr ""

# -- Download / locate -------------------------------------------------------
$installerPath = Get-Installer
Write-Ok "Fajl: $(Split-Path -Leaf $installerPath)"
Clr ""

# -- Install -----------------------------------------------------------------
Install-App -Installer $installerPath -InstallDir $installDir

# -- Find EXE ----------------------------------------------------------------
Clr ""; Write-Hr
Write-Step "Proverka ustanovki"
$exePath = Find-Exe -InstallDir $installDir
if ($null -ne $exePath) {
    Write-Ok "Najdeno: $exePath"
}
else {
    Write-Warn "EXE ne obnaruzhen v $installDir"
}

# -- Shortcuts ---------------------------------------------------------------
if (-not $NoShortcut -and ($null -ne $exePath)) {
    if ($Silent -or (Confirm-Prompt "Sozdat yarlik v menyu Pusk?")) {
        Add-Shortcut -LnkPath (Join-Path $START_MENU_DIR "$APP_NAME.lnk") `
                     -ExePath $exePath `
                     -Desc "CodeSync -- Collaborative IDE"
        Write-Ok "Yarlik v menyu Pusk sozdan"
    }
    if (-not $Silent -and (Confirm-Prompt "Sozdat yarlik na rabochem stole?")) {
        $desktop = [Environment]::GetFolderPath('Desktop')
        Add-Shortcut -LnkPath (Join-Path $desktop "$APP_NAME.lnk") `
                     -ExePath $exePath `
                     -Desc "CodeSync -- Collaborative IDE"
        Write-Ok "Yarlik na rabochem stole sozdan"
    }
}

# -- PATH --------------------------------------------------------------------
if (-not $Silent -and (Confirm-Prompt "Dobavit papku ustanovki v PATH?")) {
    Add-ToPath -NewDir $installDir
}

# -- Registry ----------------------------------------------------------------
if ($null -ne $exePath) {
    Register-App -InstallDir $installDir -ExePath $exePath
}

# -- Done --------------------------------------------------------------------
Show-Summary -InstallDir $installDir -ExePath $exePath
