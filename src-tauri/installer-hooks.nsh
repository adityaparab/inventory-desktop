!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "MUI2.nsh"

; ── Machine-specific license ──────────────────────────────────────────────────
; Before building this installer, replace PLACEHOLDER-UUID with the UUID of the
; target machine.  Obtain it by running on the target machine:
;
;     wmic csproduct get UUID
;
; Example:
;     !define LICENSED_MACHINE_UUID "4C4C4544-0046-4210-8031-CAC04F575931"
!define LICENSED_MACHINE_UUID "PLACEHOLDER-UUID"

; ── Page order ────────────────────────────────────────────────────────────────
; 1. LicenseCheckPage  — invisible; validates machine UUID before any UI appears
Page custom LicenseCheckPageShow

; ── Machine UUID validation ───────────────────────────────────────────────────
; This page is never displayed.  In NSIS, calling Abort from a Page custom
; "show" function silently skips the page and advances to the next one.
; We use this to run the UUID check before any wizard UI is rendered.
Function LicenseCheckPageShow
  ; Query machine UUID via PowerShell — produces a clean single-line UUID string.
  nsExec::ExecToStack 'powershell -NoProfile -NonInteractive -Command "(Get-WmiObject Win32_ComputerSystemProduct).UUID"'
  Pop $R0  ; exit code
  Pop $R1  ; UUID, e.g. "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX$\r$\n"

  ; Trim to 36 chars to remove any trailing whitespace / line endings.
  StrCpy $R1 $R1 36

  ; StrCmp is case-insensitive in NSIS — covers uppercase/lowercase variants.
  StrCmp $R1 "${LICENSED_MACHINE_UUID}" uuid_ok

  ; UUID did not match — inform the user and exit immediately.
  MessageBox MB_OK|MB_ICONSTOP \
    "This installer is not licensed for this machine.$\n$\nThis copy was built for a different machine. Please contact the distributor to obtain an installer for your machine."
  Quit

  uuid_ok:
  ; UUID matches — skip this invisible validation page and show the next page.
  Abort
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
!macroend

!macro NSIS_HOOK_POSTINSTALL
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -Command "$configDir = Join-Path $env:USERPROFILE ''.inventory''; $configPath = Join-Path $configDir ''config.json''; if (Test-Path $configPath) { try { $config = Get-Content -Raw -Path $configPath | ConvertFrom-Json } catch { $config = $null } if ($config -and $config.dbPath) { $dbPath = [string]$config.dbPath; if (-not [string]::IsNullOrWhiteSpace($dbPath) -and (Test-Path $dbPath)) { Remove-Item -LiteralPath $dbPath -Recurse -Force -ErrorAction SilentlyContinue } } } if (Test-Path $configDir) { Remove-Item -LiteralPath $configDir -Recurse -Force -ErrorAction SilentlyContinue }"'
  ${EndIf}
!macroend