# Project state — windows-app-for-linux

## Remotes and CI

| Remote | URL | Role |
|---|---|---|
| `origin` | `https://github.com/mariuszkopowski/windows-app-for-linux.git` | Public repo of record (Flathub/Snap publish from it); CI in `.github/workflows/build.yml` |
| `onedev` | `http://git.koprowski.cc/windows-app-for-linux` | Self-hosted OneDev (QNAP NAS); CI in `.onedev-buildspec.yml` |

- GitHub account: **mariuszkopowski** (App ID `io.github.mariuszkopowski.WindowsAppForLinux`).
- The old Gitea instance and its `.gitea/` workflow are gone; there is no GitLab pipeline.

## Branch history

- The two remotes had drifted into unrelated histories: OneDev carried a snapshot from 2026-07 plus its own refactor (`classifyWindowOpen`, `--smoke-test`, docs) and CI, while GitHub gained Electron 43, community fixes (fullscreen, window icon, blank auth popups) and `navigationHistory`.
- 2026-11-23: both sides were merged into one tree on top of GitHub `main` (branch `consolidate`). `onedev/main` still has the old unrelated history until it is replaced or reset to match.

## Functional state

- Jest: 98 tests / 6 suites, all green.
- Done: UA spoof, per-session AVD windows (incl. Windows 365 `webclient/ent/` URLs), tray, Settings, window state, crash recovery, about:blank SSO interceptor with auth-popup exemption, fullscreen handling, window icon, i18n pl/en, `--smoke-test`.

## Unpublished decisions / context

- **Flatpak without GPU by default** (`app.disableHardwareAcceleration` + SwiftShader) — driver problems in the sandbox; opt-in `WINDOWS_APP_ENABLE_GPU=1`.
- **NVIDIA + Wayland -> forced X11** (EGL_BAD_MATCH crashes on the proprietary driver).
- Camera in AVD sessions: a limitation of Microsoft's web client, do NOT fix on the wrapper side.
- `--publish never` in all build scripts — electron-builder tried to publish releases on its own.
- Package builds run sequentially (`npm run build` chains the three targets) to avoid resource exhaustion.

## What's next (backlog, per PLAN.md Phase 2+)

1. **Phase 2 — Tab Manager**: `WebContentsView` per AVD session + a custom tab bar, Ctrl+T/W/Tab. Today sessions open in separate windows.
2. **Phase 3 — fullscreen per tab** (F11), an overlay hinting at the shortcuts.
3. **Phase 5 — Flathub**: a manifest for a separate Flathub repo (appdata.xml is already in assets/).
4. Zoom with persistence, connection-loss detection + retry.
