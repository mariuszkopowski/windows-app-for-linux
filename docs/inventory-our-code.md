---
created: 2026-08-05
updated: 2026-08-05
tags: [windows-app-for-linux, inventory, documentation, our-code]
---

# Inwentaryzacja kodu "naszego" (windows-app-for-linux)

> Utworzone w ramach inwentaryzacji `apps/*` (Zasada 1). Indeks — szczegóły w
> `CLAUDE.md` + `docs/ARCHITECTURE.md` (repo ma już pełną dokumentację). Stan
> 2026-08-05. Główna dokumentacja: `../CLAUDE.md`, `docs/ARCHITECTURE.md`,
> `docs/DEVELOPMENT.md`. Ten plik wypunktowuje elementy "nasze" wg Zasady 1.

## Co to jest "nasze"

**Windows App for Linux** — Electron wrapper dla `https://windows.cloud.microsoft`
(Windows App / Azure Virtual Desktop). AppImage + Flatpak (Flathub) + Snap.
Target: Linux desktopy (Nobara/Wayland).

## Spis elementów

| Element | Plik | Co robi | Po co |
|---|---|---|---|
| Main | `app/index.js` | Entry; Chromium flags (Vaapi, SharedArrayBuffer, Ozone) przed app.ready | H.264 decode + RDP codec + Wayland |
| Config | `app/config/options.js`, `index.js` | Defaults (UA, URL, size) + merge (config.json → CLI → defaults) | Konfiguracja |
| Main window | `app/mainAppWindow/index.js` | BrowserWindow lifecycle, UA injection, windowOpenHandler, session | AVD web client |
| Settings | `app/settings/` | BrowserWindow + preload (contextBridge) + settings.html | Edycja config.json |
| Browser preload | `app/browser/preload.js` | Spoof `navigator.platform` + `userAgentData` (Client Hints) | Edge/Windows UA (Conditional Access) |
| CI | `.gitlab-ci.yml`, `.github/workflows/build.yml` | Build appimage/flatpak/snap | Dystrybucja |

## Kluczowe decyzje (Zasada 1 — warunki)
- **UA spoof mandatory** (2-warstwowy: `setUserAgent` + JS patch) — Intune MAM.
- **Session partition `persist:windows-app` shared** — Entra ID cookies między oknami.
- **`contextIsolation: false`** (preload patchuje navigator) + `webSecurity: true`
  (AVD wymaga COOP/COEP).
- **Auth popups:** `isAuthUrl()` (MS) + `isLikelyAuthPopup()` (heurystyka dla ADFS/Okta).
- **AVD state clear** (indexeddb/sessionstorage/sw) przed loadURL — bez localStorage/cookies.

## Pułapki (z CLAUDE.md)
- Camera w AVD to ograniczenie MS web clienta, NIE wrappera — nie "fixować".
- Fullscreen (F11) → web app sam przechwytuje klawisze.
- `autoHideMenuBar` ukrywa File menu → Settings tylko przez tray.

## Uwagi
- Symlink Obsidian założony 2026-08-05 (`Projects/lifeos/apps/windows-app-for-linux/docs →
  ~/Projects/apps/windows-app-for-linux/docs`).
- Branch repo = **`github-fix`** (lokalnie; remote `github/main` + `origin/main`).
- Repo ma już CLAUDE.md — ten indeks tylko wskaźnik Zasady 1.
