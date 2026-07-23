# Development guide — windows-app-for-linux

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
[TASKS.md](TASKS.md).

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

Two mirrored workflows build and test on push:

- `.github/workflows/build.yml` — GitHub Actions
- `.gitea/workflows/build.yml` — Gitea Actions

Both run the test suite and the package builds on pushes to `main` (and
version tags `v*`); release artifacts are attached on tag builds.

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
  layers — see [ARCHITECTURE.md](ARCHITECTURE.md) for why each exists.
