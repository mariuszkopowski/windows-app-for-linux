# Development guide — windows-app-for-linux

## Overview
Developer guide: prerequisites, everyday commands, project layout, the Jest test strategy, package builds (AppImage/Flatpak/Snap) and the dual CI pipelines (GitHub Actions + GitLab CI/CD) with the headless `--smoke-test` verification step.

## Prerequisites

- Node.js 20+ and npm
- For packaging only: `flatpak` + `flatpak-builder` (Flatpak target),
  `squashfs-tools` (Snap target). The AppImage target needs nothing extra.

## Everyday commands

```bash
npm install          # first-time setup
npm start            # run in development (electron .)
npm test             # Jest test suite
npm run test:watch   # Jest in watch mode
```

## Project layout

```
app/        main-process code (see docs/ARCHITECTURE.md for the module map)
assets/     icons (16–512px PNG + SVG source), AppStream metadata
docs/       PLAN.md (roadmap), TASKS.md (task register), ARCHITECTURE.md, this file
test/       Jest suites, mirroring the app/ structure
```

Design rule that keeps the code testable: **pure logic lives in helper modules**
(`app/mainAppWindow/helpers.js`, `app/chromiumFlags.js`, `app/config/index.js`)
and is unit-tested without Electron; the Electron-touching modules stay thin.
When adding behaviour, put the decision logic in a helper and test it.

## Tests

```bash
npm test
```

Suites cover: Chromium flag building (Wayland/NVIDIA matrix), config merging
(file → CLI → defaults), windowOpenHandler routing (auth/AVD/external),
session setup (UA + Client Hints headers, CSP stripping, permissions),
the about:blank SSO interceptor, and render-process crash recovery.

Acceptance criteria and manual test scripts for each task live in
[TASKS](TASKS.md).

## Building packages

```bash
npm run build:appimage
npm run build:flatpak    # requires flatpak + flatpak-builder on the host
npm run build:snap       # requires squashfs-tools on the host
npm run build            # all three targets
```

All build scripts pass `--publish never` — electron-builder must never
auto-publish from a local build; releases are produced by CI.

Artifacts land in `dist/` (gitignored).

## CI

One pipeline: `.github/workflows/build.yml` (GitHub Actions). GitHub is the
repo of record because Flathub and the Snap Store publish from it. The former
OneDev mirror was removed on 2026-11-23; there is no Gitea, GitLab or OneDev
pipeline.

Stages, in order:

1. **`test`** — `npm test`. Runs on every push to `main`/`rewrite`, tags `v*`, and
   on pull requests targeting `main` (PRs based on another branch get no CI;
   use `workflow_dispatch` on the branch instead).
2. **`build`** — a single combined job building AppImage + Flatpak + Snap,
   uploading them as the `build-output` artifact. Release assets are attached
   on `v*` tag builds only.

There is currently no post-install `verify` stage; installing each package and
launching it headless with `--smoke-test` (see below) is a known gap that used
to be covered only by the removed OneDev pipeline.

### `--smoke-test`

A CLI flag (`app/index.js` + `app/config/index.js`) that boots the app fully
(window, session, preload, tray/menu/i18n) and then exits — `app.exit(0)` on
success, `app.exit(1)` if startup throws — without loading the real
windows.cloud.microsoft portal, so it doesn't depend on network access or
login. It's what the `verify-*` CI jobs run against each installed package to
catch "the binary doesn't even launch" failures (missing native libs, broken
packaging) independent of whether the actual remote service is reachable.

Packaged builds only get **one** leading `process.argv` entry
(`[execPath, ...args]`) instead of the two `electron .` provides in dev
(`[execPath, appPath, ...args]`), which yargs' `hideBin()` always strips
assuming the dev-mode shape — `defaultArgv()` in `config/index.js` detects a
packaged Electron process (`process.versions.electron` set,
`process.defaultApp` unset) and pads argv back to the shape `hideBin()`
expects, otherwise the first real CLI flag gets silently eaten. This was
verified against a real locally-built AppImage, not just `electron .`.

Flatpak and Snap can't be installed/run the "real" way inside a plain CI
container — Snap needs a running snapd/systemd, Flatpak's bubblewrap sandbox
is unreliable in Docker — so `verify-flatpak` does a real `flatpak install`
but `verify-snap` unpacks the squashfs payload with `unsquashfs` and runs the
bundled binary directly (entry point read from the snap's own
`meta/snap.yaml`, not hardcoded). This proves the packaged binary and its
native deps work; it does not exercise snapd's actual confinement.

`verify-appimage` runs the AppImage with `--appimage-extract-and-run`
(self-extracts to a temp dir and execs `AppRun` with `$APPDIR`/`$APPIMAGE`
set correctly) — there's no FUSE in a plain container, so the AppImage can't
mount itself the normal way. Don't "simplify" this to a manual
`--appimage-extract` + running `squashfs-root/AppRun` directly: `AppRun`'s
`$APPDIR` auto-detection, when `$APPDIR` isn't already set, walks up the
directory tree looking for a file named after `argv[1]` — if that first CLI
flag isn't a real filename (e.g. `--smoke-test`), it walks all the way to
`/`, `APPDIR` ends up empty, and it tries to exec `/windows-app-for-linux`.

## Release checklist

1. Bump `version` in `package.json`.
2. `npm test` and a local `npm run build:appimage` smoke test.
3. Tag `vX.Y.Z` and push the tag — CI builds and attaches AppImage/Flatpak/Snap.
4. Flathub (`io.github.mariuszkopowski.WindowsAppForLinux`) has its own
   manifest repo — update it separately after a GitHub release exists.

## Conventions

- App ID everywhere: `io.github.mariuszkopowski.WindowsAppForLinux`.
- User-facing strings go through `app/i18n.js` (`app/locales/en.json`,
  `app/locales/pl.json`).
- Do not weaken `webSecurity`, the shared session partition, or the UA-spoof
  layers — see [ARCHITECTURE](ARCHITECTURE.md) for why each exists.
