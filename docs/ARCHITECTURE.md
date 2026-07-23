# Architecture — windows-app-for-linux

Technical reference for how the wrapper is put together. For the roadmap and
phase breakdown see [PLAN.md](PLAN.md); for per-task acceptance criteria see
[TASKS.md](TASKS.md); for build/test instructions see
[DEVELOPMENT.md](DEVELOPMENT.md).

## Process structure

```
Electron Main Process
├── app/index.js                  entry point — Chromium flags (before app.ready),
│                                 single-instance lock, lifecycle hooks
├── app/chromiumFlags.js          buildFeatureFlags() — pure helper, unit-tested
├── app/config/
│   ├── options.js                defaults: cloud environment URLs, UA string,
│   │                             session partition, window geometry
│   └── index.js                  merge order: config.json file → CLI args → defaults (yargs)
├── app/mainAppWindow/
│   ├── index.js                  main BrowserWindow + AVD session windows,
│   │                             session setup, windowOpenHandler routing
│   ├── helpers.js                pure logic: URL classification, UA parsing,
│   │                             permission policy, about:blank interceptor
│   └── windowState.js            persists window size/position/maximized
├── app/menus/appMenu.js          application menu + keyboard shortcuts
├── app/tray/index.js             system tray: show portal, jump to sessions, quit
├── app/settings/
│   ├── index.js                  settings BrowserWindow + ipcMain handlers
│   ├── preload.js                contextBridge — exposes window.settingsAPI only
│   └── settings.html             settings UI
├── app/i18n.js + app/locales/    en/pl translations
└── app/browser/preload.js        navigator spoof injected into every portal window
```

## Window model

- **Main window** loads the portal (`/#/devices` on commercial cloud).
- **AVD session windows**: clicking a machine in the portal navigates to
  `/webclient/avd/<guid>`; `setWindowOpenHandler` intercepts it and opens a
  dedicated `BrowserWindow` per session (`createAvdWindow`). All session
  windows are tracked in a set, exposed in the tray menu, and destroyed on quit.
- **Auth popups** (Entra ID and federated IdPs) open as modal children of the
  requesting window, sharing the same session partition.
- Closing the main window hides it (tray keeps the app alive); "Quit" from the
  tray/menu sets `forceClose` and actually exits.

### windowOpenHandler routing

For every `window.open` / target=_blank the handler decides, in order:

1. `about:blank` (and `#blocked`) → deny (see the about:blank interceptor below)
2. `isAvdUrl()` → new AVD session window, deny the default popup
3. `isAuthUrl()` (Microsoft login domains) **or** `isLikelyAuthPopup()`
   (popup disposition / small window-features heuristic — catches federated
   IdPs like ADFS/Okta/Ping that cannot be allow-listed by domain)
   → allow as an in-app modal sharing the session partition
4. any other safe http(s) URL → `shell.openExternal`, deny in-app

## User-Agent spoof (mandatory)

Conditional Access / Intune MAM policies on many tenants require Edge on
Windows. The spoof has three layers that must stay consistent:

1. **HTTP**: `session.setUserAgent()` + `loadURL({ userAgent })`.
2. **Client Hints request headers**: Chromium generates `sec-ch-ua*`
   independently of `setUserAgent()`, so `onBeforeSendHeaders` rewrites
   `sec-ch-ua`, `sec-ch-ua-platform`, `sec-ch-ua-mobile`,
   `sec-ch-ua-platform-version` on every request.
3. **JavaScript**: `app/browser/preload.js` patches
   `Navigator.prototype.platform` ("Win32") and `navigator.userAgentData`
   (brands, platform, `getHighEntropyValues()`).

The Edge/Chromium major versions used in layers 2–3 are **derived from the
configured UA string** (`parseUaVersions()`), so a user-edited UA in Settings
keeps all layers in sync — there is no second hardcoded copy.

## Session & security

- One persistent partition, `persist:windows-app`, shared by the main window,
  auth popups, and every AVD session window. Intentional: Entra ID cookies must
  be visible to all child windows.
- `contextIsolation: false` + `sandbox: false` — required so the preload can
  patch the page's `navigator` directly. `nodeIntegration` stays `false`.
- `webSecurity: true` — **must not be disabled**; the AVD web client requires
  COOP/COEP for SharedArrayBuffer.
- Permission requests are answered from an allow-list
  (`camera`, `microphone`, `notifications`, `media`, `display-capture`,
  clipboard read/sanitized-write); everything else is denied.
- `Content-Security-Policy-Report-Only` response headers are stripped
  (they break parts of the SSO flow).

### about:blank interceptor

The portal's SSO flow opens `about:blank` and then navigates it to an external
URL. A stateful `onBeforeRequest` interceptor cancels the `about:blank` load
and, when the *next* main-frame https request arrives, cancels it in-app and
hands the URL to the system browser instead.

### AVD session state clearing

Before loading the **first** AVD session window, indexeddb / sessionstorage /
serviceworkers / cachestorage are cleared (`clearAvdSessionState`) — this fixes
a grey screen on reconnect. `localStorage` and cookies are deliberately kept:
they hold the portal's first-run flags and SSO state on the same shared origin.
When other session windows are already open, nothing is cleared (it would
corrupt their state).

## Chromium flags & GPU strategy (app/index.js, before app.ready)

| Environment | Behaviour |
|---|---|
| Flatpak | Hardware acceleration **off** by default (sandbox GPU driver issues); SwiftShader WebGL enabled. Opt back in with `WINDOWS_APP_ENABLE_GPU=1`. Wayland flags come from the electron wrapper script (`useWaylandFlags`). |
| Native + NVIDIA | `VaapiVideoDecoder` skipped; on Wayland forces `ozone-platform=x11` (NVIDIA proprietary + native Wayland → EGL_BAD_MATCH GPU crashes). |
| Native + Intel/AMD | `VaapiVideoDecoder` (hardware H.264 decode for the RDP stream); on Wayland: `ozone-platform=wayland`, `UseOzonePlatform`, `WebRTCPipeWireCapturer`. |
| Always (native) | `SharedArrayBuffer` + `CrossOriginOpenerPolicy` features and `SharedArrayBuffer` blink feature — required by the RDP WebAssembly codec; `disable-dev-shm-usage`. |

## Crash recovery

`render-process-gone` on the main window reloads the portal unless the reason
was `clean-exit`.

## Configuration

`~/.config/windows-app-for-linux/config.json`, merged as
**file → CLI args → defaults**. `cloudEnvironment`
(`commercial`/`gcchigh`/`dod`) resolves to a preset URL; an explicit `url`
always wins. The Settings window edits the same file; most changes need an app
restart (no live reload of session/UA).

## Known limitations

Web-client limitations (no wrapper-side fix): unreliable webcam redirection,
no multi-monitor, no RDP Shortpath (UDP), no screen-capture protection.
See the comparison table in [PLAN.md](PLAN.md#known-limitations-web-client-vs-native-client).
