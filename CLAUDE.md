# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Electron wrapper for `https://windows.cloud.microsoft` (Windows App / Azure Virtual Desktop) targeting Linux desktops. Distributed as AppImage, Flatpak (Flathub: `io.github.mariuszkopowski.WindowsAppForLinux`) and Snap.

Reference projects (same architecture): [teams-for-linux](https://github.com/IsmaelMartinez/teams-for-linux), [outlook-for-linux](https://github.com/mahmoudbahaa/outlook-for-linux).

## Commands

```bash
npm install          # first time setup
npm start            # run in development
npm run build:appimage
npm run build:flatpak
npm run build:snap
npm run build        # all three targets
```

Building the flatpak/snap targets locally requires `flatpak-builder`/`snapcraft` on the host — see `.github/workflows/build.yml` for the exact setup steps used in CI.

## Architecture

```
app/
├── index.js                   # main process entry; Chromium flags set here before app.ready
├── config/
│   ├── options.js             # defaults (UA string, URLs, window size)
│   └── index.js               # merges: config.json file → CLI args → defaults (yargs)
├── mainAppWindow/
│   └── index.js               # BrowserWindow lifecycle, UA injection, windowOpenHandler, session setup
├── settings/
│   ├── index.js               # settings BrowserWindow + ipcMain handlers, reads/writes config.json
│   ├── preload.js             # contextBridge — exposes window.settingsAPI only
│   └── settings.html          # light-themed settings UI
└── browser/
    └── preload.js             # navigator.platform + userAgentData (Client Hints) spoof for Edge/Windows
```

**Planned additions (Phase 2+):**
- `mainAppWindow/tabManager.js` — WebContentsView per AVD session
- `tabBar/` — custom HTML tab bar overlay
- `app/menus/appMenu.js` — keyboard shortcuts (Ctrl+T, Ctrl+W, F11)

## Critical design decisions

**User-Agent spoof is mandatory.** Conditional Access / Intune MAM policies on many tenants require Edge on Windows. The spoof is two-layered:
1. `session.setUserAgent()` + `loadURL({userAgent})` — HTTP header level
2. `preload.js` patches `Navigator.prototype.platform` and `navigator.userAgentData` — JS level (Client Hints)

**Session partition `persist:windows-app` is shared** across all windows (main + auth popups + AVD sessions). This is intentional — Entra ID auth cookies must be visible to all child windows.

**`contextIsolation: false`** is required so the preload can patch the page's `navigator` directly. `webSecurity: true` must stay enabled — the AVD web client requires COOP/COEP headers for SharedArrayBuffer.

**Chromium flags** set in `app/index.js` before `app.ready`:
- `VaapiVideoDecoder` — hardware H.264 decode for the RDP graphics stream
- `SharedArrayBuffer` + `CrossOriginOpenerPolicy` — required by the RDP WebAssembly codec
- `UseOzonePlatform` + `WebRTCPipeWireCapturer` — Wayland support (conditional on `WAYLAND_DISPLAY`)

**AVD sessions open as tabs (Phase 2).** The entry panel is `/#/devices`. Clicking a machine navigates to `/webclient/avd/[guid...]`. In Phase 1 this loads in the main window; Phase 2 uses `WebContentsView` per session with a custom tab bar.

**Fullscreen keyboard passthrough** is handled by the web app itself once Electron enters fullscreen — no custom key interception needed. F11 will toggle Electron fullscreen.

**Auth popups from federated IdPs (ADFS, Okta, Ping, ...) can't be allow-listed by domain** — `isAuthUrl()` only covers Microsoft's own domains. `isLikelyAuthPopup()` (window size/disposition heuristic) is a fallback that lets these stay in-app as a modal instead of falling through to `shell.openExternal`.

**`window.open('about:blank', …, 'popup')` is allowed as a modal auth popup** (`isBlankAuthPopup`). MSAL-style sign-in opens a blank popup first and navigates it to the IdP afterwards; denying it returns `null` to the page and the sign-in never appears (issue #12, AVD permission consent). Plain `about:blank` without popup hints is still denied, and requests from tracked auth popups (`authPopupIds`) are exempt from `createAboutBlankInterceptor`.

**AVD session windows clear indexeddb/sessionstorage/serviceworkers/cachestorage before `loadURL`** (`clearAvdSessionState`) to avoid a grey screen on reconnect. `localStorage` and cookies are deliberately excluded — they hold the portal's first-run flags (`preload.js`) and SSO state, which live on the same shared origin.

**Camera doesn't always work in AVD sessions, and it's not a bug in this wrapper.** `permissionAllowed()` grants the `camera` permission unconditionally, but whether the device actually shows up inside the remote session depends entirely on the Windows App **web client**'s webcam-redirection support, which is still incomplete on Microsoft's side (works more reliably in the native, non-web Windows App). Don't try to "fix" camera issues here — there is no code-level fix on the wrapper side. See `docs/PLAN.md` → "Znane ograniczenia".

## Settings window

`app/settings/` — a BrowserWindow (contextIsolation: true, its own preload with contextBridge) reachable via the tray menu ("Ustawienia"/"Settings", always visible) and the File menu (hidden behind `autoHideMenuBar`, so don't rely on it as the only entry point). Lets the user edit the same `config.json` that `app/config/` reads — cloud environment, connection URL (when environment is "custom"), default window size — plus a "Clear Cookies and Cache" button wired to `clearSession()`. Changes are written to disk immediately but most only take effect after an app restart (no live-reload of session/UA).

## Config file location

`~/.config/windows-app-for-linux/config.json` — overrides any value from `options.js`. Editable directly, or through the Settings window (see above); no separate GUI-vs-file distinction, they read/write the same file.

`cloudEnvironment` (`commercial` | `gcchigh` | `dod`, also `--cloud-environment` on the CLI) resolves to a preset URL in `options.js`. An explicit `url` (file or `--url`) always wins over the preset.
