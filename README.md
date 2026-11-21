# Windows App for Linux

An unofficial Electron wrapper for [windows.cloud.microsoft](https://windows.cloud.microsoft) (Windows App / Azure Virtual Desktop / Windows 365), for people who want a native-feeling desktop app on Linux instead of a browser tab.

This is not affiliated with or endorsed by Microsoft.

## Features

- Connects to the Windows App portal and launches AVD / Cloud PC sessions in their own windows
- Edge-on-Windows user-agent spoofing (HTTP header + JS Client Hints) so Conditional Access / Intune MAM checks pass
- System tray integration — show the portal, jump to any open session, quit (with or without clearing the session)
- Federated sign-in (ADFS, Okta, Ping, …) stays in-app instead of falling back to your system browser
- Hardware video decode (VAAPI on Intel/AMD) for the RDP graphics stream
- Wayland and X11 support
- Settings window for switching cloud environment (Commercial / GCC High / DoD), default window size, and clearing cookies/cache
- Local camera and microphone preflight with camera preview, live microphone level, and package diagnostics
- Distributed as AppImage, Flatpak, and Snap

## Installation

Prebuilt packages are attached to [GitHub Releases](https://github.com/mariuszkopowski/windows-app-for-linux/releases).

### AppImage

```bash
chmod +x "Windows App-*.AppImage"
./"Windows App-*.AppImage"
```

### Flatpak

```bash
flatpak install --user "Windows App-*.flatpak"
flatpak run io.github.mariuszkopowski.WindowsAppForLinux
```

(Once published on Flathub: `flatpak install flathub io.github.mariuszkopowski.WindowsAppForLinux`.)

### Snap

```bash
sudo snap install --dangerous "windows-app-for-linux_*.snap"
```
**WARNING - Builds have been tested on Fedora, not on Ubuntu, so things may not work**

## Configuration

No in-app URL bar — configuration lives in `~/.config/windows-app-for-linux/config.json`, editable directly or through **tray → Settings** (or **File → Settings**, `Ctrl+,`, if the menu bar is visible — it auto-hides by default, tap `Alt` to reveal it).

```json
{
  "cloudEnvironment": "gcchigh",
  "window": { "width": 1600, "height": 900 }
}
```

| Key | CLI flag | Description |
|---|---|---|
| `cloudEnvironment` | `--cloud-environment` | `commercial` (default), `gcchigh`, or `dod` — resolves to the matching portal URL |
| `url` | `--url` | Explicit connection URL; overrides `cloudEnvironment` when set |
| `userAgent` | `--user-agent` | Override the spoofed user-agent string |
| `window.width` / `window.height` | — | Default window size |

The Settings window covers `cloudEnvironment`, the connection URL (only editable when the environment is set to Custom), window size, and a "Clear Cookies and Cache" button. Most changes take effect after restarting the app.

Launch only the local device checker with `windows-app-for-linux --media-check`.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+,` | Settings |
| `Ctrl+Shift+M` | Camera and microphone check |
| `Ctrl+Q` | Quit |
| `Ctrl+R` | Reload |
| `F11` | Fullscreen |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset |
| `Alt+Left` / `Alt+Right` | Back / forward |
| `Ctrl+Shift+I` | Developer tools |

## Known limitations

These are limitations of the Windows App **web client** itself (windows.cloud.microsoft), not something this wrapper can fix:

- **Webcam redirection is unreliable.** The app grants the `camera` permission automatically, but whether a camera actually shows up inside a remote session depends on Microsoft's web client support, which is still incomplete — it works more reliably in the native (non-web) Windows App. This isn't a bug in this wrapper; there's no code-level fix available on our side.
- No multi-monitor support, no RDP Shortpath (UDP), no screen-capture protection — all native-client-only features.

Use **tray → Camera & Microphone Check** (or `Ctrl+Shift+M`) before connecting. A passing
test confirms that the Linux wrapper can capture the selected devices locally; the remote-session
toolbar and host policy must still enable redirection. For Snap, verify the `camera` and
`audio-record` interfaces with `snap connections windows-app-for-linux`. For Flatpak, inspect
`flatpak info --show-permissions io.github.mariuszkopowski.WindowsAppForLinux`.

See [docs/PLAN.md](docs/PLAN.md) for the full comparison against the native client.

## Building from source

Requires Node.js 20+.

```bash
npm install
npm start              # run in development
npm test                # run the test suite

npm run build:appimage
npm run build:flatpak   # requires flatpak + flatpak-builder on the host
npm run build:snap      # requires squashfs-tools on the host
npm run build            # all three targets
```

## License

[MIT](LICENSE)
