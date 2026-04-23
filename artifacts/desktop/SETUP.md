# CodeSync Desktop — Setup & Build Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- For macOS builds: Xcode Command Line Tools
- For Windows builds: Visual Studio Build Tools (C++ workload)

## Development

```bash
# Install dependencies from the workspace root
pnpm install

# Start the desktop app in development mode (Vite + Electron)
cd artifacts/desktop
pnpm run electron:dev
```

The renderer runs at `http://localhost:21098/desktop/` and Electron connects to it automatically.

## Building a distributable

```bash
cd artifacts/desktop

# All platforms (current host only)
pnpm run electron:build

# Per-platform
pnpm run electron:build:mac    # macOS DMG + ZIP
pnpm run electron:build:win    # Windows NSIS installer + portable
pnpm run electron:build:linux  # Linux AppImage
```

Build output is written to `dist/electron/`.

## Auto-updates

CodeSync uses `electron-updater` to check for new versions automatically on every launch (production builds only).

### How it works

1. On startup, the app silently calls GitHub Releases for the configured repository (`electron-builder.yml` → `publish.owner` / `publish.repo`).
2. If a newer release is found, the update downloads in the background and the user sees a toast notification: **"Update available — vX.Y.Z"**.
3. Once the download finishes, a second notification appears: **"Update ready to install"** with a **Restart now** button.
4. Clicking **Restart now** (or quitting and relaunching the app) applies the update automatically.

Updates are never forced — users can dismiss the notification and continue working.

### Publishing a release

1. Bump the version in `artifacts/desktop/package.json`.
2. Build the distributables: `pnpm run electron:build`.
3. Create a GitHub Release tagged `v<version>` and attach the build artifacts.
4. `electron-updater` will discover the new release and notify running instances within minutes.

### Configuration

The publish target is declared in `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: your-org
  repo: codesync
```

Replace `your-org` and `codesync` with the actual GitHub organisation and repository names before publishing.

For private repositories, set the `GH_TOKEN` environment variable to a GitHub personal access token with `repo` scope when building.
