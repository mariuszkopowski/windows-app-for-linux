# Implementation plan — windows-app-for-linux

## Overview
Phased implementation plan for windows-app-for-linux: technology decisions, architecture (multi-tab `WebContentsView` model, fullscreen-per-tab), the critical UA-spoof and Chromium-flag requirements, and the five implementation phases (Foundation done; Tab Manager / Fullscreen / System / Packaging remaining).

## Project goal

A native Linux application wrapping `https://windows.cloud.microsoft` (Windows App / Azure Virtual Desktop). Lets you work with the Windows cloud like a local app: multi-tab interface, keyboard handling in fullscreen, system integration.

Distribution: **AppImage** (standalone), **Flatpak** (Flathub: `io.github.mariuszkopowski.WindowsAppForLinux`), and **Snap**.

---

## Technology decisions

### Electron, not a PWA

A PWA doesn't give access to:
- `app.commandLine.appendSwitch` — without it, VAAPI and SharedArrayBuffer can't be enabled
- `session.setUserAgent()` at the session level (rather than a single window)
- `setWindowOpenHandler` for full control over new windows
- native integration (tray, global shortcuts, URL protocol)

### Codebase

Architecture modeled on [teams-for-linux](https://github.com/IsmaelMartinez/teams-for-linux) and [outlook-for-linux](https://github.com/mahmoudbahaa/outlook-for-linux) — the same `BrowserWindow` + preload + `setWindowOpenHandler` + `webRequest` interceptor pattern.

Key differences from those projects:
- Multi-tab interface (`WebContentsView` per AVD session) instead of a single window
- Fullscreen per tab (not per window)
- Custom tab bar (HTML overlay) instead of a native menu

---

## Architecture

### Process structure

```
Electron Main Process
├── app/index.js                  — Chromium flags, single-instance lock, lifecycle
├── app/config/                   — configuration (defaults + JSON file + CLI)
├── app/mainAppWindow/
│   ├── index.js                  — BrowserWindow, session, windowOpenHandler
│   └── tabManager.js             — WebContentsView per AVD session [Phase 2]
└── app/menus/appMenu.js          — application menu, shortcuts [Phase 3]

Renderer / Preload (per WebContentsView)
└── app/browser/preload.js        — navigator.platform + userAgentData spoof

Tab Bar (own renderer)
└── app/tabBar/                   — HTML/CSS/JS overlay above windows [Phase 2]
```

### Tab model (Phase 2+)

```
BrowserWindow
├── [Tab Bar WebContentsView] ← always on top, 40px tall
├── [WebContentsView #0]      ← https://windows.cloud.microsoft/#/devices (panel)
├── [WebContentsView #1]      ← /webclient/avd/[guid1] (session 1)
└── [WebContentsView #2]      ← /webclient/avd/[guid2] (session 2, optional)
```

All WebContentsViews share **one session** (`persist:windows-app`). This is required — Entra ID tokens must be visible across every tab.

### Fullscreen (Phase 3)

In fullscreen mode for the active tab:
1. The Tab Bar is hidden
2. The active WebContentsView occupies 100% of the window
3. The web app itself takes over the keyboard once fullscreen is entered
4. ESC or F11 restores the Tab Bar and previous sizes

---

## Critical technical requirements

### UA spoof — two levels

**Level 1 (HTTP headers):** `session.setUserAgent()` + `loadURL({ userAgent })` — every HTTP request sends the Edge/Windows UA.

**Level 2 (JavaScript):** `preload.js` patches:
- `Navigator.prototype.platform` → `"Win32"`
- `navigator.userAgentData.platform` → `"Windows"`
- `navigator.userAgentData.brands` → Edge brands (version derived from the configured UA string)
- `navigator.userAgentData.getHighEntropyValues()` → returns Windows architecture and version

Level 2 is required because Entra ID and Conditional Access use the Client Hints API instead of (or alongside) the legacy UA string.

### Chromium flags

Set before `app.ready` in `app/index.js`:

| Flag | Reason |
|---|---|
| `VaapiVideoDecoder` | Hardware H.264 decode for the RDP graphics stream (without it — CPU) |
| `SharedArrayBuffer` | Required by the RDP WebAssembly codec |
| `CrossOriginOpenerPolicy` | Required by the page for SharedArrayBuffer |
| `WebRTCPipeWireCapturer` | Screen sharing on Wayland (conditional) |
| `UseOzonePlatform` | Native Wayland (conditional on `WAYLAND_DISPLAY`) |

### Session security

- `webSecurity: true` — **must not be changed** — the page requires COOP/COEP for SharedArrayBuffer
- `contextIsolation: false` — required so the preload can patch the page's `navigator`
- `sandbox: false` — required so the preload has access to Node.js APIs
- `nodeIntegration: false` — the page itself has no access to Node.js

---

## Implementation phases

### Phase 1 — Foundation ✅ (partially)

Working Electron app loading Windows App, with UA spoof and auth support.

**Done:**
- package.json (AppImage + Flatpak + Snap targets)
- Chromium flags with Wayland detection
- Config system (options.js + index.js with yargs)
- BrowserWindow with persistent session
- UA spoof — HTTP and JS (preload)
- windowOpenHandler — auth, AVD, external
- CSP header stripping (SSO)
- about:blank SSO intercept
- Render process crash recovery
- Settings window (cloud environment, window size, User-Agent, clear session)
- App icons (assets/)
- Test infrastructure (Jest)

**Remaining:**
- Window state persistence (size/position) — done
- Full CI (GitHub Actions) — done; the OneDev mirror was dropped on 2026-11-23

### Phase 2 — Tab Manager

Each AVD session opens as a tab. Custom Tab Bar as an HTML overlay.

Key elements:
- `TabManager` — creates/destroys/switches WebContentsViews
- `TabBar` — HTML/CSS, IPC with the main process
- windowOpenHandler routes `/webclient/avd/` to TabManager
- Ctrl+T (new tab to the panel), Ctrl+W (close tab), Ctrl+Tab (next tab)
- Tab titles from `webContents.getTitle()`

### Phase 3 — Fullscreen & Keyboard

Fullscreen per tab with the Tab Bar hidden.

- F11 → fullscreen the active tab → Tab Bar disappears → WebContentsView = 100% of window
- ESC / F11 again → exit fullscreen → Tab Bar comes back
- Info overlay on first entry (which shortcuts work: Ctrl+Alt+End, Alt+F3, etc.)
- Complete application menu with shortcuts

### Phase 4 — System integration

- System tray (icon + Show/Quit) — done
- Window state persistence (saving size/position) — done
- Zoom (Ctrl+/-/0) with per-partition persistence
- Alt+←/→ navigation — done
- Connection-loss detection + retry

### Phase 5 — Packaging & Flathub

- Complete icon set (16–512px, PNG + SVG source) — done
- AppStream metadata (appdata.xml) — done
- .desktop file (generated by electron-builder)
- Working AppImage build — done
- Working Flatpak build — done
- Working Snap build — done
- Manifest for a separate Flathub repo

---

## Known limitations (web client vs. native client)

| Feature | Web client | Native Windows App |
|---|---|---|
| Multiple monitors | ❌ | ✅ |
| RDP Shortpath (UDP) | ❌ | ✅ |
| Teams WebRTC optimization | ❌ | ✅ |
| Screen capture protection | ❌ | ✅ |
| Intune MAM (full) | ⚠️ Edge only | ✅ |
| Camera redirection (webcam redirection) | ⚠️ Unreliable | ✅ |

Web client limitations — we can't fix these from Electron.

**Camera:** the app grants the `camera` permission automatically (`permissionAllowed()` in `app/mainAppWindow/helpers.js`), but whether the camera actually connects inside an AVD session depends on the Windows App web client, which **doesn't yet have full support for camera redirection** — the device sometimes doesn't show up in the remote session despite the granted permission, even when it works fine in the native (non-web) Windows App client. This is a limitation on Microsoft's side; it can't be fixed in this wrapper.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A tenant requires real Edge | Medium | Documentation; UI alert when the spoof might not be enough |
| COOP/COEP blocks auth popups | Medium | Shared session in a modal child window |
| Fullscreen behaves differently on Wayland | High | Test on both XWayland and native Wayland |
| Two concurrent AVD sessions collide | Low | Each session has its own WebSocket to the AVD gateway |
| Edge updates change the Client Hints API | Low | UA string configurable in config.json / Settings window |
