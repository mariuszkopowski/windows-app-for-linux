# Windows App for Linux

## Overview
High-level technical overview of windows-app-for-linux: the Main/Renderer split, the two-layer User-Agent spoof, the Chromium-flag / GPU strategy, the Phase-1-done project state, and the documentation split between the code repo and the vault.

> An unofficial Electron wrapper for the `windows.cloud.microsoft` service (Windows App / Azure Virtual Desktop / Windows 365), built with Linux systems in mind. The application aims to provide an experience close to a native-feeling desktop app, eliminating the need to use a web browser.

The application is distributed as **AppImage**, **Flatpak** (Flathub: `io.github.mariuszkopowski.WindowsAppForLinux`), and **Snap**.

---

## Architecture and technical concept

The project is structurally split into the Main Process controlling the application lifecycle and the Renderer Processes handling the interface and the individual Windows App sessions.

### 1. Process and module structure (`app/`)
- `index.js` — The application's main entry point. Sets Chromium flags before the `app.ready` event, manages the single-instance lock and the system tray.
- `config/` (`options.js` + `index.js`) — A configuration system combining built-in cloud-environment templates (`commercial`, `gcchigh`, `dod`), the user's configuration file, and command-line arguments parsed with `yargs`.
- `mainAppWindow/` — Defines the application's main window (`BrowserWindow`), manages the session, and routes `window.open` calls through a dedicated handler (`windowOpenHandler`).
- `settings/` — A separate, secure settings window with its own preload (`contextBridge`), letting the user change the configuration (e.g., the URL, cloud environment, User-Agent string) and save it directly to `config.json`.
- `browser/` — Contains the key `preload.js` script responsible for masking the platform on the client side.

### 2. Two-layer User-Agent spoofing
Many Microsoft-service tenants enforce restrictive conditional-access policies (Conditional Access / Intune MAM), allowing only the Edge browser on Windows. To work around this, the wrapper implements two-level spoofing:
- **HTTP layer**: The `session.setUserAgent()` method and explicitly passing the header in `loadURL()` force it to report itself as Windows and the Edge browser in all network requests. Additionally, the `onBeforeSendHeaders` event modifies the Client Hints headers (`sec-ch-ua`, `sec-ch-ua-platform`, `sec-ch-ua-platform-version`).
- **JavaScript layer (`preload.js`)**: Overrides the `navigator` object's properties in the page context (`Navigator.prototype.platform` as `"Win32"`, `navigator.userAgentData` with the appropriate Edge brands and the `"Windows"` platform). This requires the `contextIsolation: false` flag in the main window so the preload script can directly modify the web page's global window object.

---

## System integration and Chromium flags

To ensure optimal performance and support for the graphics standards required by the web AVD client, the application configures the following Chromium flags in the main process:
- `SharedArrayBuffer` and `CrossOriginOpenerPolicy` — necessary for the WebAssembly RDP codec to work correctly.
- `VaapiVideoDecoder` — forces hardware H.264 video decoding (for Intel/AMD cards), which drastically reduces CPU load during desktop streaming.
- Support for the native **Wayland** protocol (via Ozone) and **PipeWire** screen capture (activated automatically when the `WAYLAND_DISPLAY` variable is detected), except on NVIDIA-card configurations, where the application forces X11 to avoid proprietary-driver problems (`EGL_BAD_MATCH`).

For the Flatpak distribution, GPU hardware acceleration is disabled by default due to the sandbox and potential graphics-driver conflicts (the application then uses SwiftShader WebGL). The user can force GPU enablement by setting the environment variable `WINDOWS_APP_ENABLE_GPU=1`.

---

## Project state and documentation split (Phase 1 Done)

The project successfully completed Phase 1 in July 2026. The change history is fully integrated in the git repositories.

### 1. Code repository (`~/Projects/windows-app-for-linux/`)
The application has full unit tests in Jest (80/80 tests green), verifying the correctness of UA-header parsing, URL classification, and configuration logic.
- `docs/ARCHITECTURE.md` — a public description of the window model, GPU strategy, and security (in English).
- `docs/DEVELOPMENT.md` — a public developer guide describing the process of building packages locally and in CI.
- `docs/PLAN.md` and `docs/TASKS.md` — development plans and task lists.

### 2. Obsidian Vault — Internal documentation
Unpublished notes and the history of agent interactions live solely locally:
- [project-state](PROJECT-STATE.md) — infrastructure details (the GitHub `origin` and OneDev `onedev` remotes), branch-history discrepancies (PR #8), and specific limitations (e.g., the non-working webcam issue, which stems from a lack of redirection support in Microsoft's web client, not an application bug).

### 3. Development direction (Phase 2)
The next key milestone is implementing a tab manager (**Tab Manager**). Instead of opening each AVD session in a new system window (as is currently the case), the application will move to a multi-tab model based on `WebContentsView` embedded in a single main window with a custom tab bar written in HTML/CSS.

---

## Links
- [Vault configuration](vault-setup.md)
- [Project map](projects-map.md)
- [pyfmd project](Projects/pyfmd/README.md)
- [Linux system](Projects/linux/README.md)
- [GNOME Shell extension](Projects/hermes-gnome-extention/README.md)
- [Project State](PROJECT-STATE.md)
