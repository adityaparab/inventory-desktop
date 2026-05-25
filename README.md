# Inventory Manager

Desktop inventory application built with Tauri, React, TypeScript, and an embedded local MongoDB setup.

## Development

- `yarn install`
- `yarn dev`
- `yarn tauri dev`

## Releases

The project now has a GitHub Actions release workflow at [.github/workflows/release-desktop.yml](.github/workflows/release-desktop.yml).

It supports two release paths:

1. Push a version tag such as `v0.1.0`.
2. Run the `Release desktop app` workflow manually and provide a tag name.

The workflow builds Windows installers and publishes them to a GitHub Release as assets:

- NSIS `.exe`
- WiX `.msi`

To build the same release bundles locally on Windows:

```powershell
yarn install
yarn release:windows
```

Generated installers are written under `src-tauri/target/release/bundle`.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
