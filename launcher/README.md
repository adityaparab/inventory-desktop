# Machine setup launcher

This is a small .NET 8 / WinForms application that replaces the original
PowerShell-script-compiled-to-EXE setup flow. It is built **once on a Windows
runner** (GitHub Actions), published as a release asset, and downloaded by the
Linux Docker image at build time. The Nest server then appends a per-user
configuration footer at download time, so each user gets a personalised `.exe`
without any runtime PowerShell-to-EXE compilation on Linux (which was
unreliable across `ps2exe`, `ps12exe`, and Roslyn version mismatches).

## What it does

When run on the target Windows machine, the launcher:

1. Reads the appended footer to recover its embedded `ApiBaseUrl` and
   single-use `SetupToken`. See [LauncherConfig.cs](LauncherConfig.cs).
2. Exchanges the setup token for a short-lived JWT (`POST /setup/exchange`).
3. Detects the machine's hardware UUID via WMI (`Win32_ComputerSystemProduct`).
4. Detects the hostname (`Environment.MachineName`).
5. Registers the machine (`POST /machines`).
6. Starts the machine-specific installer build (`GET /generate/:uuid`) and
  streams the SSE build log in the launcher window.
7. Downloads the completed installer (`GET /download/:uuid`).
8. Runs the downloaded installer silently.
9. Deletes the downloaded installer and revokes the setup token in a `finally`
  block (`POST /setup/revoke`).

The UI is a dark-themed WinForms window with a step sidebar, log panel and
progress bar, mirroring the previous PowerShell UI.

## Building locally

You need the **.NET 8 SDK** (https://dot.net/download). To produce the same
artefact the CI publishes:

```powershell
cd launcher
dotnet publish -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
# Result:
#   bin\Release\net8.0-windows\win-x64\publish\machine-setup.exe
```

The resulting EXE is a self-contained ~60 MB single file. It works on any
Windows 10/11 machine without a separate .NET runtime install.

## Footer configuration format

The Nest server appends this to the end of the EXE at download time:

```
+---------------------------------------------+
| UTF-8 JSON: {"ApiBaseUrl":..,"SetupToken":..} |  (N bytes)
+---------------------------------------------+
| little-endian uint32 = N                    |  (4 bytes)
+---------------------------------------------+
| ASCII magic "INVCFG01"                      |  (8 bytes)
+---------------------------------------------+
```

PE files tolerate trailing garbage after the last section, so Windows still
loads the resulting EXE normally.
