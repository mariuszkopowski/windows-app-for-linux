# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Electron wrapper for `https://windows.cloud.microsoft` (Windows App / Azure Virtual Desktop) targeting Linux desktops. Distributed as AppImage, Flatpak (Flathub: `io.github.mariuszkopowski.WindowsAppForLinux`) and Snap.

Reference projects (same architecture): [teams-for-linux](https://github.com/IsmaelMartinez/teams-for-linux), [outlook-for-linux](https://github.com/mahmoudbahaa/outlook-for-linux).

## Commands

```bash
npm install          # first time setup
npm start            # run in development
npm test             # Jest test suite
npm run test:watch
npm run build:appimage
npm run build:flatpak
npm run build:snap
npm run build        # all three targets
```

Building the flatpak/snap targets locally requires `flatpak-builder`/`squashfs-tools` on the host — see `.github/workflows/build.yml` for the exact setup steps used in CI. CI is GitHub Actions only (`.github/workflows/build.yml`); GitHub is the repo of record and Flathub and the Snap Store publish from it. There is no OneDev, Gitea or GitLab pipeline.

Both pipelines share the same shape: `pre-build-test` (Jest, every push) → `build-packages` (AppImage/Flatpak/Snap, gated to `main` + tags `v*`) → `verify` (three jobs in parallel, one per format, each installs/extracts its package and runs it headless with `--smoke-test` to confirm it actually boots post-install). See `docs/DEVELOPMENT.md` → CI for the full breakdown, including why `--smoke-test` needed a packaged-vs-dev `process.argv` fix in `config/index.js` (`hideBin()` assumes the dev-mode two-entry argv shape and silently eats the first real flag otherwise) and why Snap verification unpacks+runs the binary directly instead of going through snapd.

## Architecture

```
app/
├── index.js                   # main process entry; Chromium flags set here before app.ready; single-instance lock, lifecycle hooks
├── chromiumFlags.js           # buildFeatureFlags() — pure helper (Wayland/NVIDIA matrix), unit-tested
├── i18n.js                    # load()/t() — reads app/locales/<locale>.json, falls back to en.json
├── locales/                   # en.json, pl.json — all user-facing strings
├── config/
│   ├── options.js             # defaults (UA string, URLs, window size)
│   └── index.js               # merges: config.json file → CLI args → defaults (yargs)
├── mainAppWindow/
│   ├── index.js               # main BrowserWindow + per-session AVD BrowserWindows, session setup, windowOpenHandler
│   ├── helpers.js             # pure logic: URL classification, UA parsing, permission policy, about:blank interceptor — unit-tested
│   └── windowState.js         # persists/restores main window size+position+maximized to ~/.config/windows-app-for-linux/window-state.json
├── menus/
│   └── appMenu.js             # application menu + keyboard shortcuts (Ctrl+, / Ctrl+Q / Ctrl+R / F11 / zoom / back-forward / devtools)
├── tray/
│   └── index.js               # system tray: show portal, jump to open AVD sessions, settings, quit (with/without clearing session)
├── settings/
│   ├── index.js               # settings BrowserWindow + ipcMain handlers, reads/writes config.json
│   ├── preload.js             # contextBridge — exposes window.settingsAPI only
│   └── settings.html          # light-themed settings UI
└── browser/
    └── preload.js             # navigator.platform + userAgentData (Client Hints) spoof for Edge/Windows
```

Design rule: pure decision logic lives in helper modules (`mainAppWindow/helpers.js`, `chromiumFlags.js`, `config/index.js`) and is unit-tested without Electron; Electron-touching modules stay thin. `test/` mirrors this layout. See `docs/ARCHITECTURE.md` for the full technical map and `docs/DEVELOPMENT.md` for the dev/test/release workflow.

## Critical design decisions

**User-Agent spoof is mandatory.** Conditional Access / Intune MAM policies on many tenants require Edge on Windows. The spoof is two-layered:
1. `session.setUserAgent()` + `loadURL({userAgent})` — HTTP header level
2. `preload.js` patches `Navigator.prototype.platform` and `navigator.userAgentData` — JS level (Client Hints)

**Session partition `persist:windows-app` is shared** across all windows (main + auth popups + AVD sessions). This is intentional — Entra ID auth cookies must be visible to all child windows.

**`contextIsolation: false`** is required so the preload can patch the page's `navigator` directly. `webSecurity: true` must stay enabled — the AVD web client requires COOP/COEP headers for SharedArrayBuffer.

**Chromium flags** set in `app/index.js` before `app.ready`, via `chromiumFlags.js`'s `buildFeatureFlags()`:
- `VaapiVideoDecoder` — hardware H.264 decode for the RDP graphics stream; skipped on NVIDIA (unstable there)
- `SharedArrayBuffer` + `CrossOriginOpenerPolicy` — required by the RDP WebAssembly codec
- `WebRTCPipeWireCapturer` — Wayland screen-sharing (conditional on `WAYLAND_DISPLAY`)
- On native Wayland + NVIDIA: forces `ozone-platform=x11` instead (proprietary driver + native Wayland → `EGL_BAD_MATCH` GPU crashes)
- In Flatpak: hardware acceleration is **off by default** (sandbox GPU driver issues) with SwiftShader software WebGL; opt back in with `WINDOWS_APP_ENABLE_GPU=1`

**AVD sessions open as separate `BrowserWindow`s, not tabs.** The entry panel is `/#/devices`. Clicking a machine navigates to `/webclient/<resourceType>/<resourceId...>` — `avd` for classic Azure Virtual Desktop host-pool sessions, `ent` for Windows 365 Enterprise Cloud PCs (other resource-type segments may exist; Microsoft doesn't publish the full list). `isAvdUrl()` in `helpers.js` matches any `/webclient/<segment>/<segment...>` path on the exact `windows.cloud.microsoft` host rather than enumerating known types — an unrecognized prefix here previously fell through to `shell.openExternal` and opened outside Electron (see the `fix/new-window-opening-outside-of-electron` history). `windowOpenHandler` routes matches to `createAvdWindow()` in `app/mainAppWindow/index.js`, which opens a dedicated window per session, tracked in a `Set` and listed in the tray. A tab-per-`WebContentsView` design (`tabManager.js` + a custom tab bar) was planned and speced in `docs/TASKS.md` (Phase 2) but never started — the multi-window approach shipped instead as a simpler working alternative. Don't assume the tab manager exists; revisit `docs/TASKS.md` only if multiple windows prove insufficient.

**Fullscreen keyboard passthrough** is handled by the web app itself once Electron enters fullscreen — no custom key interception needed. F11 will toggle Electron fullscreen.

**Auth popups from federated IdPs (ADFS, Okta, Ping, ...) can't be allow-listed by domain** — `isAuthUrl()` only covers Microsoft's own domains. `isLikelyAuthPopup()` (window size/disposition heuristic) is a fallback that lets these stay in-app as a modal instead of falling through to `shell.openExternal`.

**AVD session windows clear indexeddb/sessionstorage/serviceworkers/cachestorage before `loadURL`** (`clearAvdSessionState`) to avoid a grey screen on reconnect. `localStorage` and cookies are deliberately excluded — they hold the portal's first-run flags (`preload.js`) and SSO state, which live on the same shared origin.

**Camera doesn't always work in AVD sessions, and it's not a bug in this wrapper.** `permissionAllowed()` grants the `camera` permission unconditionally, but whether the device actually shows up inside the remote session depends entirely on the Windows App **web client**'s webcam-redirection support, which is still incomplete on Microsoft's side (works more reliably in the native, non-web Windows App). Don't try to "fix" camera issues here — there is no code-level fix on the wrapper side. See `docs/PLAN.md` → "Known limitations (web client vs. native client)".

**User-facing strings go through `app/i18n.js`**, not inline literals — add new copy to both `app/locales/en.json` and `app/locales/pl.json`. `t()` falls back to the raw key when a translation is missing, so missing entries fail loud, not silent.

## Settings window

`app/settings/` — a BrowserWindow (contextIsolation: true, its own preload with contextBridge) reachable via the tray menu (always visible) and the File menu (hidden behind `autoHideMenuBar`, so don't rely on it as the only entry point — `Alt` reveals it, or `Ctrl+,`). Lets the user edit the same `config.json` that `app/config/` reads — cloud environment, connection URL (when environment is "custom"), default window size, User-Agent override — plus a "Clear Cookies and Cache" button wired to `clearSession()`. Changes are written to disk immediately but most only take effect after an app restart (no live-reload of session/UA). Settings UI strings are collected server-side via `app/i18n.js` and sent to the renderer over IPC — the settings window has no direct `require` access (full `contextIsolation`).

## Config file location

`~/.config/windows-app-for-linux/config.json` — overrides any value from `options.js`. Editable directly, or through the Settings window (see above); no separate GUI-vs-file distinction, they read/write the same file.

`cloudEnvironment` (`commercial` | `gcchigh` | `dod`, also `--cloud-environment` on the CLI) resolves to a preset URL in `options.js`. An explicit `url` (file or `--url`) always wins over the preset.
