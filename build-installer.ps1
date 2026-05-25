<#
.SYNOPSIS
    Builds a machine-specific installer locked to the given machine UUID.

.DESCRIPTION
    1. Substitutes the target machine UUID into installer-hooks.nsh.
    2. Runs `yarn tauri build`:
       - Linux/macOS (cross-compile): --bundles nsis  → produces an NSIS .exe installer
       - Windows (native):            --bundles msi   → produces a WiX  .msi installer
    3. Copies the output to inventory_<UUID>.exe/.msi for easy identification.
    4. Restores the PLACEHOLDER-UUID in installer-hooks.nsh so the source file
       stays clean for version control.

.PARAMETER UUID
    The UUID of the target machine. Obtain it on that machine by running:

        wmic csproduct get UUID

.EXAMPLE
    .\build-installer.ps1 -UUID "4C4C4544-0046-4210-8031-CAC04F575931"
#>
param(
    [Parameter(Mandatory = $true, HelpMessage = "Target machine UUID (from: wmic csproduct get UUID)")]
    [ValidatePattern('^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$')]
    [string]$UUID
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Use IO.Path.Combine so paths work correctly on both Windows and Linux (pwsh).
$hooksFile     = [IO.Path]::Combine($PSScriptRoot, "src-tauri", "installer-hooks.nsh")
$definePattern = '(?m)^(\s*!define LICENSED_MACHINE_UUID\s+")[^"]*(")'
$utf8NoBom     = New-Object System.Text.UTF8Encoding $false

function Set-LicensedUUID {
    param([string]$Value)
    $raw = [System.IO.File]::ReadAllText($hooksFile, $utf8NoBom)
    if ($raw -notmatch $definePattern) {
        throw "LICENSED_MACHINE_UUID define not found in $hooksFile"
    }
    $patched = $raw -replace $definePattern, "`${1}$Value`${2}"
    [System.IO.File]::WriteAllText($hooksFile, $patched, $utf8NoBom)
}

# --- Patch -------------------------------------------------------------------
Write-Host "Patching installer-hooks.nsh with UUID: $UUID"
Set-LicensedUUID -Value $UUID

try {
    # --- Build ---------------------------------------------------------------
    # On Linux/macOS we cross-compile for the Windows x64 GNU target; Wine is
    # used by Tauri to run the NSIS tools that create the .exe installer.
    $onLinux = [bool](Get-Variable -Name IsLinux -ValueOnly -ErrorAction SilentlyContinue)
    $onMacOS = [bool](Get-Variable -Name IsMacOS -ValueOnly -ErrorAction SilentlyContinue)

    if ($onLinux -or $onMacOS) {
        Write-Host "Running: yarn tauri build --target x86_64-pc-windows-gnu --bundles nsis"
        yarn tauri build --target x86_64-pc-windows-gnu --bundles nsis
        $bundleDir = [IO.Path]::Combine(
            $PSScriptRoot, "src-tauri", "target",
            "x86_64-pc-windows-gnu", "release", "bundle", "nsis"
        )
    } else {
        Write-Host "Running: yarn tauri build --bundles msi"
        yarn tauri build --bundles msi
        $bundleDir = [IO.Path]::Combine(
            $PSScriptRoot, "src-tauri", "target", "release", "bundle", "msi"
        )
    }

    if ($LASTEXITCODE -ne 0) {
        throw "yarn tauri build failed with exit code $LASTEXITCODE"
    }

    # --- Copy output to UUID-named file --------------------------------------
    $fileFilter = if ($onLinux -or $onMacOS) { "*.exe" } else { "*.msi" }
    $fileExt    = if ($onLinux -or $onMacOS) { "exe"   } else { "msi"   }

    $built = Get-ChildItem $bundleDir -Filter $fileFilter |
             Sort-Object LastWriteTime -Descending |
             Select-Object -First 1

    if ($built) {
        $dest = [IO.Path]::Combine($bundleDir, "inventory_${UUID}.${fileExt}")
        Copy-Item $built.FullName $dest -Force
        Write-Host ""
        Write-Host "Build successful."
        Write-Host "Installer : $dest"
    } else {
        throw "Build succeeded but no *.$fileExt was found in $bundleDir"
    }
} finally {
    # --- Restore -------------------------------------------------------------
    Write-Host "Restoring PLACEHOLDER-UUID in installer-hooks.nsh"
    Set-LicensedUUID -Value "PLACEHOLDER-UUID"
}
