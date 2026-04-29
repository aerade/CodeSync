; CodeSync Custom NSIS Installer Include
; Referenced by electron-builder via nsis.include
; electron-builder calls the macros: customInstall, customUninstall, customRemoveFiles

; -----------------------------------------------------------------------
; Welcome page text overrides (read by electron-builder MUI template)
; -----------------------------------------------------------------------

!define MUI_WELCOMEPAGE_TITLE "Welcome to CodeSync Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of CodeSync — the collaborative IDE that lets your team code together in real time.$\r$\n$\r$\nCodeSync keeps every keystroke in sync, every file in version control, and every developer on the same page.$\r$\n$\r$\nClick Next to continue."

!define MUI_FINISHPAGE_TITLE "CodeSync Installation Complete"
!define MUI_FINISHPAGE_TEXT "CodeSync has been successfully installed on your computer.$\r$\n$\r$\nClick Finish to close this wizard."
!define MUI_FINISHPAGE_LINK "Visit codesync.app"
!define MUI_FINISHPAGE_LINK_LOCATION "https://codesync.app"

!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Are you sure you want to quit the CodeSync Setup Wizard?"

; -----------------------------------------------------------------------
; Post-install: write registry entries for version tracking
; -----------------------------------------------------------------------

!macro customInstall
  WriteRegStr HKCU "Software\CodeSync" "InstallPath" "$INSTDIR"
  WriteRegStr HKCU "Software\CodeSync" "Version"     "${VERSION}"
!macroend

; -----------------------------------------------------------------------
; Uninstall: clean up registry entries
; -----------------------------------------------------------------------

!macro customUninstall
  DeleteRegKey HKCU "Software\CodeSync"
!macroend
