# Decisions — windows-app-for-linux

## Overview
Append-only decision log for the windows-app-for-linux project (D-001…D-007), ported from the vault. Each entry records a decision and its rationale; follow-ups point at the task register.

> Append-only. Format: `D-xxx (YYYY-MM-DD) — decision — rationale`. Follow-ups → [Tasks](TASKS.md).

- **D-001 (2026-07)** — Two-layer UA spoofing (HTTP + JS Client Hints) mandatory — Conditional Access/Intune tenants allow only Edge on Windows.
- **D-002 (2026-07)** — `contextIsolation: false` in main window — preload must patch page's `navigator` directly; `webSecurity` stays on (COOP/COEP for SharedArrayBuffer).
- **D-003 (2026-07)** — Flatpak ships without GPU accel by default (SwiftShader); opt-in `WINDOWS_APP_ENABLE_GPU=1` — sandbox driver conflicts.
- **D-004 (2026-07)** — NVIDIA + Wayland → force X11 — EGL_BAD_MATCH crashes on proprietary driver.
- **D-005 (2026-07)** — Camera issues in AVD = Microsoft web client limitation — do NOT fix on wrapper side.
- **D-006 (2026-07)** — `--publish never` in all build scripts — electron-builder tried to self-publish releases.
- **D-007 (2026-07-23)** — GitHub/Gitea histories merged via `github-fix` branch (PR #8 rewrite had diverged them) — one shared history now.
