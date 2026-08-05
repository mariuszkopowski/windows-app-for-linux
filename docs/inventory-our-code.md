---
created: 2026-08-05
updated: 2026-08-05
tags: [windows-app-for-linux, inventory, documentation, our-code]
---

# Inventory of "Our Code" (windows-app-for-linux)

> Created under the `apps/*` inventory (Rule 1). Index — details in
> `CLAUDE.md` + `docs/ARCHITECTURE.md` (repo already has full docs). Status
> 2026-08-05. Main docs: `../CLAUDE.md`, `docs/ARCHITECTURE.md`,
> `docs/DEVELOPMENT.md`. This file lists the "our" elements per Rule 1.

## What is "ours"

**Windows App for Linux** — an Electron wrapper for `https://windows.cloud.microsoft`
(Windows App / Azure Virtual Desktop). AppImage + Flatpak (Flathub) + Snap.
Target: Linux desktops (Nobara/Wayland).

## Element list

| Element | File | What it does | Why |
|---|---|---|---|
| Main | `app/index.js` | Entry; Chromium flags (Vaapi, SharedArrayBuffer, Ozone) before app.ready | H.264 decode + RDP codec + Wayland |
| Config | `app/config/options.js`, `index.js` | Defaults (UA, URL, size) + merge (config.json → CLI → defaults) | Configuration |
| Main window | `app/mainAppWindow/index.js` | BrowserWindow lifecycle, UA injection, windowOpenHandler, session | AVD web client |
| Settings | `app/settings/` | BrowserWindow + preload (contextBridge) + settings.html | Edit config.json |
| Browser preload | `app/browser/preload.js` | Spoof `navigator.platform` + `userAgentData` (Client Hints) | Edge/Windows UA (Conditional Access) |
| CI | `.gitlab-ci.yml`, `.github/workflows/build.yml` | Build appimage/flatpak/snap | Distribution |

## Key decisions (Rule 1 — conditions)
- **UA spoof mandatory** (2-layer: `setUserAgent` + JS patch) — Intune MAM.
- **Session partition `persist:windows-app` shared** — Entra ID cookies across windows.
- **`contextIsolation: false`** (preload patches navigator) + `webSecurity: true`
  (AVD requires COOP/COEP).
- **Auth popups:** `isAuthUrl()` (MS) + `isLikelyAuthPopup()` (heuristic for ADFS/Okta).
- **AVD state clear** (indexeddb/sessionstorage/sw) before loadURL — no localStorage/cookies.

## Pitfalls (from CLAUDE.md)
- Camera in AVD is a limitation of the MS web client, NOT the wrapper — don't "fix" it.
- Fullscreen (F11) → the web app captures keys itself.
- `autoHideMenuBar` hides the File menu → Settings only via tray.

## Notes
- Obsidian symlink created 2026-08-05 (`Projects/lifeos/apps/windows-app-for-linux/docs →
  ~/Projects/apps/windows-app-for-linux/docs`).
- Repo branch = **`github-fix`** (local; remote `github/main` + `origin/main`).
- Repo already has CLAUDE.md — this index is only a Rule 1 pointer.
