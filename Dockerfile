# ─────────────────────────────────────────────────────────────────────────────
# NOTE: Railway (and all major cloud container platforms) only support Linux
# containers.  Windows containers are not available.
#
# This image runs on Ubuntu 22.04 and cross-compiles the Windows NSIS installer
# using the MinGW-w64 toolchain.  Tauri uses Wine to execute the Windows NSIS
# tools (makensis.exe) that produce the final .exe installer.
# ─────────────────────────────────────────────────────────────────────────────
FROM ubuntu:22.04

# ── Environment ───────────────────────────────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    # Suppress Wine debug noise
    WINEDEBUG=-all \
    WINEPREFIX=/root/.wine \
    # Rust toolchain location (system-wide so both root and non-root can use it)
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    # MinGW cross-linker for the Windows GNU target
    CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc \
    PKG_CONFIG_ALLOW_CROSS=1

ENV PATH=/usr/local/cargo/bin:$PATH

# ── 0. Make apt resilient to transient mirror failures ────────────────────────
RUN echo 'Acquire::Retries "3";' > /etc/apt/apt.conf.d/80-retries

# ── 1. System packages ────────────────────────────────────────────────────────
RUN dpkg --add-architecture i386 \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
    # Essentials
    curl wget ca-certificates git unzip file patchelf \
    build-essential pkg-config libssl-dev \
    # MinGW cross-compilation toolchain  (Linux → Windows x64)
    gcc-mingw-w64-x86-64 g++-mingw-w64-x86-64 \
    binutils-mingw-w64-x86-64 \
    # NSIS — native Linux NSIS compiler; creates Windows installers from Linux.
    # Tauri resolves the system 'makensis' binary via $PATH.  We also add a
    # 'makensis.exe' symlink so older Tauri codepaths that look for the Windows
    # binary name still work without Wine.
    nsis \
    # Wine — fallback for any Tauri NSIS plugin that must run as a Windows exe
    wine wine64 wine32 \
    # GTK/WebKit — required by Tauri's build system even for cross-compilation
    libwebkit2gtk-4.0-dev libgtk-3-dev \
    libayatana-appindicator3-dev librsvg2-dev \
    # Virtual display so Wine console tools don't error on missing DISPLAY
    xvfb \
 && ln -sf /usr/bin/makensis /usr/local/bin/makensis.exe \
 && rm -rf /var/lib/apt/lists/*

# ── 2. Node.js 20 + Yarn ─────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y nodejs \
 && npm install -g yarn \
 && rm -rf /var/lib/apt/lists/*

# ── 3. PowerShell Core (pwsh) ─────────────────────────────────────────────────
# Required by build-installer.ps1 which is spawned by the NestJS build service
# at runtime.  The Microsoft package repo must be added first because Ubuntu's
# default apt sources do not include the powershell package.
RUN wget -q https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb \
 && dpkg -i packages-microsoft-prod.deb \
 && rm packages-microsoft-prod.deb \
 && apt-get update \
 && apt-get install -y --no-install-recommends powershell \
 && rm -rf /var/lib/apt/lists/* \
 && pwsh --version

# ── 4. Rust + Windows cross-compilation target ───────────────────────────────
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --default-toolchain stable \
 && rustup target add x86_64-pc-windows-gnu

# ── 5. Initialise Wine prefix ─────────────────────────────────────────────────
# Tauri runs NSIS (a Windows .exe) through Wine to create the installer.
# We initialise the Wine prefix now so the first build request is not delayed.
RUN Xvfb :99 -screen 0 1024x768x24 & \
    export DISPLAY=:99 && \
    wineboot --init 2>/dev/null || true

# ── 7. Copy project + install JS dependencies ────────────────────────────────
WORKDIR /app
COPY . .

# ── 7a. Machine-setup launcher EXE (pre-built on Windows in CI) ──────────────
# The launcher is a small .NET 8 self-contained WinForms app built on a
# Windows GitHub Actions runner (.github/workflows/build-launcher.yml) and
# attached to the floating `launcher-latest` GitHub release.  At runtime the
# Nest server appends a per-user configuration footer to this binary and
# streams it as the response to GET /setup/download.
#
# Keep this download after COPY so a new app deployment does not reuse a stale
# Docker layer containing an older launcher binary.
#
# Building a Windows EXE from a Linux container was attempted with both
# ps2exe and ps12exe; ps2exe shells out to powershell.exe (Windows only) and
# ps12exe relies on a Roslyn version newer than what pwsh on Linux bundles
# (`Microsoft.CodeAnalysis.ResourceDescriptionKind` missing).  Pre-building
# on Windows sidesteps all of this.
ARG LAUNCHER_RELEASE_TAG=launcher-latest
ARG LAUNCHER_REPO=adityaparab/tauri-mongodb-template
RUN curl -fsSL --retry 3 \
    "https://github.com/${LAUNCHER_REPO}/releases/download/${LAUNCHER_RELEASE_TAG}/machine-setup.exe" \
    -o /app/setup-launcher.exe \
 && ls -la /app/setup-launcher.exe

RUN yarn install --frozen-lockfile

# ── 7b. Build the React admin UI served by Nest at runtime ───────────────────
WORKDIR /app/client
RUN yarn install --frozen-lockfile
RUN yarn build

WORKDIR /app

# ── 8. Pre-warm the Rust / Tauri build cache ─────────────────────────────────
# Running a full build here compiles all Rust crates and bundles the frontend.
# Subsequent /generate/:uuid requests hit the incremental Cargo cache and only
# re-run the fast NSIS packaging step (seconds, not minutes).
# "|| true" ensures a packaging failure doesn't break the image build.
RUN DISPLAY=:99 Xvfb :99 -screen 0 1024x768x24 & \
    sleep 2 && \
    yarn tauri build --target x86_64-pc-windows-gnu --bundles nsis || true

# ── 9. Build the NestJS service ───────────────────────────────────────────────
WORKDIR /app/server
RUN yarn install --frozen-lockfile
RUN yarn build

# ── 10. Runtime ───────────────────────────────────────────────────────────────
# Start Xvfb (needed by Wine at runtime) then launch the NestJS server.
EXPOSE 3000
CMD ["sh", "-c", "Xvfb :99 -screen 0 1024x768x24 & export DISPLAY=:99 && node /app/server/dist/main.js"]
