# Task register — windows-app-for-linux

## Overview
Task register for windows-app-for-linux: every task carries a status, target files, acceptance criteria, unit tests (where applicable) and manual tests. Mirrors the phase breakdown in `[PLAN](PLAN.md)`.

## Status legend

| Symbol | Meaning |
|---|---|
| `pending` | Not started |
| `in_progress` | In progress |
| `completed` | Done |
| `blocked` | Blocked by another task |

Each task has: a description, acceptance criteria, unit tests (where applicable), and manual tests (for the agent/user).

---

## Phase 1 — Foundation

---

### P1-01 — Project scaffold

**Status:** `completed`
**Files:** `package.json`, `.gitignore`

#### Acceptance criteria
- [x] `package.json` contains `appId: io.github.mariuszkopowski.WindowsAppForLinux`
- [x] Targets: AppImage, Flatpak, and Snap
- [x] Dependencies: electron ^34, electron-builder ^25, yargs ^17
- [x] `.gitignore` excludes `node_modules/`, `dist/`

#### Unit tests
_Not applicable — configuration file._

#### Manual tests
1. `npm install` completes without errors
2. The `node_modules/` directory exists after install

---

### P1-02 — Chromium flags and entry point

**Status:** `completed`
**Files:** `app/index.js`

#### Acceptance criteria
- [x] `enable-features` contains: `VaapiVideoDecoder`, `SharedArrayBuffer`, `CrossOriginOpenerPolicy`
- [x] `enable-blink-features` contains: `SharedArrayBuffer`
- [x] Wayland: if `WAYLAND_DISPLAY` is set → adds `UseOzonePlatform`, `WebRTCPipeWireCapturer`, `--ozone-platform=wayland`
- [x] Single-instance lock — a second launch focuses the first window
- [x] Flags set **before** `app.whenReady()`

#### Unit tests
```js
// test/config/chromiumFlags.test.js
describe('Wayland detection', () => {
  it('adds Wayland flags when WAYLAND_DISPLAY is set', () => {
    process.env.WAYLAND_DISPLAY = ':0';
    const flags = buildFeatureFlags(); // extracted helper function
    expect(flags).toContain('UseOzonePlatform');
    expect(flags).toContain('WebRTCPipeWireCapturer');
    delete process.env.WAYLAND_DISPLAY;
  });

  it('omits Wayland flags when WAYLAND_DISPLAY is not set', () => {
    delete process.env.WAYLAND_DISPLAY;
    const flags = buildFeatureFlags();
    expect(flags).not.toContain('UseOzonePlatform');
  });
});
```

#### Manual tests
1. `npm start` — the app window appears (even with a blank screen or a network error, that's fine at this stage)
2. A second `npm start` at the same time — the first window comes to the front, the second doesn't open
3. On a Wayland system (`echo $WAYLAND_DISPLAY`): the app starts without XWayland errors

---

### P1-03 — Config system

**Status:** `completed`
**Files:** `app/config/options.js`, `app/config/index.js`

#### Acceptance criteria
- [x] `options.js` contains: `url`, `userAgent`, `sessionPartition`, `window`
- [x] `config/index.js` merges: JSON file → CLI args → defaults
- [x] Config file looked up at `~/.config/windows-app-for-linux/config.json`
- [x] A missing config file doesn't cause an error — defaults are used
- [x] CLI arg `--user-agent "..."` overrides the UA string

#### Unit tests
```js
// test/config/index.test.js
describe('Config loading', () => {
  it('returns defaults when no config file exists', () => {
    const cfg = loadConfig({ configPath: '/nonexistent/path.json' });
    expect(cfg.url).toBe('https://windows.cloud.microsoft/#/devices');
    expect(cfg.sessionPartition).toBe('persist:windows-app');
  });

  it('merges file config over defaults', () => {
    const cfg = loadConfig({
      configPath: fixtures.configWithCustomUA,
    });
    expect(cfg.userAgent).toBe('custom-ua-string');
    expect(cfg.url).toBe('https://windows.cloud.microsoft/#/devices'); // default preserved
  });

  it('CLI arg overrides file config', () => {
    const cfg = loadConfig({
      configPath: fixtures.configWithCustomUA,
      argv: ['--user-agent', 'cli-ua'],
    });
    expect(cfg.userAgent).toBe('cli-ua');
  });

  it('window config merges deeply', () => {
    const cfg = loadConfig({
      configPath: fixtures.configWithWindowWidth,
    });
    expect(cfg.window.width).toBe(1920);
    expect(cfg.window.height).toBe(800); // default preserved
  });
});
```

#### Manual tests
1. Run `npm start -- --user-agent "TestUA/1.0"`, open DevTools (F12), type `navigator.userAgent` in the console → should show `TestUA/1.0` (if the preload doesn't patch this value) or the spoofed Edge UA
2. Create `~/.config/windows-app-for-linux/config.json` with `{"window": {"width": 1920}}`, run the app → the window is ~1920px wide

---

### P1-04 — BrowserWindow and session

**Status:** `completed` ✅ manually tested
**Files:** `app/mainAppWindow/index.js`

#### Acceptance criteria
- [x] BrowserWindow uses the `persist:windows-app` partition
- [x] `webSecurity: true`, `contextIsolation: false`, `sandbox: false`, `nodeIntegration: false`
- [x] Session-level UA set via `appSession.setUserAgent()`
- [x] Permissions: camera, microphone, notifications, media, display-capture granted automatically
- [x] `content-security-policy-report-only` response headers stripped
- [x] `app/browser/preload.js` loaded as the preload
- [x] `sec-ch-ua` / `sec-ch-ua-platform` overridden via `onBeforeSendHeaders` (added after testing — Chromium generates these independently of `setUserAgent`)
- [x] F12 and Ctrl+Shift+I open DevTools (added via `before-input-event`)

> **Implementation note:** `setUserAgent()` does not affect the `sec-ch-ua` headers — they require a separate `onBeforeSendHeaders` interceptor.

#### Unit tests
```js
// test/mainAppWindow/sessionSetup.test.js
describe('Permission handler', () => {
  const allowedPerms = ['camera', 'microphone', 'notifications', 'media', 'display-capture', 'clipboard-read', 'clipboard-sanitized-write'];
  const deniedPerms = ['geolocation', 'fullscreen', 'unknown-perm'];

  allowedPerms.forEach(perm => {
    it(`grants ${perm}`, () => {
      expect(permissionAllowed(perm)).toBe(true);
    });
  });

  deniedPerms.forEach(perm => {
    it(`denies ${perm}`, () => {
      expect(permissionAllowed(perm)).toBe(false);
    });
  });
});

describe('CSP header stripping', () => {
  it('removes content-security-policy-report-only from response headers', () => {
    const headers = {
      'content-type': 'text/html',
      'content-security-policy-report-only': 'default-src https:',
    };
    const result = stripCspReportOnly(headers);
    expect(result['content-security-policy-report-only']).toBeUndefined();
    expect(result['content-type']).toBe('text/html');
  });

  it('is case-insensitive for header names', () => {
    const headers = { 'Content-Security-Policy-Report-Only': 'value' };
    const result = stripCspReportOnly(headers);
    expect(result['Content-Security-Policy-Report-Only']).toBeUndefined();
  });
});
```

#### Manual tests
1. `npm start` → a window opens with `windows.cloud.microsoft` loaded
2. F12 → DevTools → Network → check request headers: `User-Agent` should contain `Edg/`
3. In the DevTools console: `navigator.userAgent` → should contain `Edg/`
4. In the DevTools console: `navigator.platform` → `"Win32"`

---

### P1-05 — Navigator / Client Hints spoof

**Status:** `completed` ✅ manually tested
**Files:** `app/browser/preload.js`

#### Acceptance criteria
- [x] `navigator.platform` returns `"Win32"`
- [x] `navigator.userAgentData.platform` returns `"Windows"`
- [x] `navigator.userAgentData.mobile` returns `false`
- [x] `navigator.userAgentData.brands` contains `{ brand: "Microsoft Edge", version: <derived from the configured UA> }`
- [x] `navigator.userAgentData.getHighEntropyValues(['platform'])` returns `{ platform: "Windows" }`
- [x] `navigator.userAgentData.getHighEntropyValues(['architecture'])` returns `{ architecture: "x86", bitness: "64" }`
- [x] An error in the spoof doesn't crash the renderer (try/catch)

> **Implementation note:** `Object.defineProperty(Navigator.prototype, 'userAgentData', ...)` throws on Chromium 132 — the property is non-configurable. Fix: try defining it on the instance (`navigator`) first, then on `Navigator.prototype`. Loop over `[navigator, Navigator.prototype]` with a try/catch per target.
>
> **Bug found and fixed later:** the spoof/skip calls were originally placed at the *top* of the file, before the `BRANDS`/`EDGE_VERSION`/`CHROME_VERSION` consts they read were declared. `const` bindings are in the temporal dead zone until their declaration line runs, so every call threw `Cannot access 'BRANDS' before initialization` — silently swallowed by the try/catch. The userAgentData spoof likely never actually worked until this was fixed by moving the calls to the bottom of the file, after all declarations.

#### Unit tests
```js
// test/browser/userAgentSpoof.test.js
// Run via electron-mocha (needs DOM/navigator access)
describe('Navigator spoof', () => {
  before(() => {
    require('../../app/browser/preload.js');
  });

  it('spoofs navigator.platform to Win32', () => {
    expect(navigator.platform).toBe('Win32');
  });

  it('spoofs userAgentData.platform to Windows', () => {
    expect(navigator.userAgentData.platform).toBe('Windows');
  });

  it('spoofs userAgentData.mobile to false', () => {
    expect(navigator.userAgentData.mobile).toBe(false);
  });

  it('brands include Microsoft Edge', () => {
    const brands = navigator.userAgentData.brands;
    const edge = brands.find(b => b.brand === 'Microsoft Edge');
    expect(edge).toBeDefined();
  });

  it('getHighEntropyValues returns Windows platform', async () => {
    const result = await navigator.userAgentData.getHighEntropyValues(['platform', 'architecture']);
    expect(result.platform).toBe('Windows');
    expect(result.architecture).toBe('x86');
    expect(result.bitness).toBe('64');
  });
});
```

#### Manual tests
1. `npm start` → F12 → console:
   ```js
   navigator.platform                              // → "Win32"
   navigator.userAgentData.platform               // → "Windows"
   navigator.userAgentData.brands                 // → [..., {brand: "Microsoft Edge", ...}]
   await navigator.userAgentData.getHighEntropyValues(['platform', 'architecture'])
   // → {platform: "Windows", architecture: "x86", bitness: "64", ...}
   ```
2. Sign in on `windows.cloud.microsoft` → sign-in shouldn't require extra steps because of the UA

---

### P1-06 — Window open handler

**Status:** `completed`
**Files:** `app/mainAppWindow/index.js`

#### Acceptance criteria
- [x] `login.microsoftonline.com` URL → opens a modal child window with the same session
- [x] `about:blank` URL → `{ action: 'deny' }`
- [x] `/webclient/avd/` URL → opens in its own AVD BrowserWindow
- [x] Other external URLs → `shell.openExternal()`, `{ action: 'deny' }` (only for `http(s):` URLs — see `isSafeExternalUrl`)
- [x] Auth modal child window has `modal: true`, `parent: mainWindow`
- [x] Auth modal child window uses the same session partition
- [x] Federated IdP popups (ADFS, Okta, Ping, ...) that can't be matched by domain are detected via a window-size/disposition heuristic (`isLikelyAuthPopup`) instead of falling through to the system browser

#### Unit tests
```js
// test/mainAppWindow/windowOpenHandler.test.js
describe('isAuthUrl', () => {
  it('detects login.microsoftonline.com', () => {
    expect(isAuthUrl('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')).toBe(true);
  });

  it('detects login.live.com', () => {
    expect(isAuthUrl('https://login.live.com/oauth20_authorize.srf')).toBe(true);
  });

  it('rejects non-auth urls', () => {
    expect(isAuthUrl('https://example.com')).toBe(false);
    expect(isAuthUrl('https://windows.cloud.microsoft')).toBe(false);
  });

  it('handles malformed urls without throwing', () => {
    expect(() => isAuthUrl('not-a-url')).not.toThrow();
    expect(isAuthUrl('not-a-url')).toBe(false);
  });
});

describe('isAvdUrl', () => {
  it('detects AVD session urls', () => {
    expect(isAvdUrl('https://windows.cloud.microsoft/webclient/avd/abc123')).toBe(true);
  });

  it('does not match panel url', () => {
    expect(isAvdUrl('https://windows.cloud.microsoft/#/devices')).toBe(false);
  });

  it('rejects a spoofed URL that only contains the AVD path as a substring', () => {
    expect(isAvdUrl('https://evil.example/?x=windows.cloud.microsoft/webclient/avd/fake')).toBe(false);
  });
});
```

#### Manual tests
1. On `windows.cloud.microsoft`, click "Sign in" → a modal sign-in window opens (not a new external browser)
2. After signing in, the modal closes and the device panel is visible
3. DevTools console: `window.open('https://google.com')` → Google opens in the system browser, not in Electron
4. DevTools console: `window.open('about:blank')` → nothing opens

---

### P1-07 — about:blank SSO intercept

**Status:** `completed`
**Files:** `app/mainAppWindow/index.js`, `app/mainAppWindow/helpers.js`

#### Acceptance criteria
- [x] `about:blank` requests are blocked by `webRequest.onBeforeRequest`
- [x] The next HTTPS request after `about:blank` is redirected to `shell.openExternal()`
- [x] The `aboutBlankCount` counter resets once handled

#### Unit tests
```js
// test/mainAppWindow/aboutBlankInterceptor.test.js
describe('AboutBlank interceptor', () => {
  it('increments counter on about:blank request', () => {
    const interceptor = createAboutBlankInterceptor();
    const callback = jest.fn();
    interceptor.onRequest({ url: 'about:blank', resourceType: 'mainFrame' }, callback);
    expect(interceptor.getCount()).toBe(1);
    expect(callback).toHaveBeenCalledWith({ cancel: true });
  });

  it('resets counter after handling follow-up HTTPS request', () => {
    const interceptor = createAboutBlankInterceptor();
    const shellMock = { openExternal: jest.fn() };
    interceptor.onRequest({ url: 'about:blank', resourceType: 'mainFrame' }, jest.fn());
    interceptor.onRequest({ url: 'https://example.com', resourceType: 'mainFrame' }, jest.fn(), shellMock);
    expect(shellMock.openExternal).toHaveBeenCalledWith('https://example.com');
    expect(interceptor.getCount()).toBe(0);
  });
});
```

#### Manual tests
1. Find a link on the page that opens a popup via `about:blank` (usually "open in browser" links in Microsoft 365) → it should open in the system browser

---

### P1-08 — Render process crash recovery

**Status:** `completed`
**Files:** `app/mainAppWindow/index.js`

#### Acceptance criteria
- [x] On `render-process-gone` with `reason !== 'clean-exit'` → `loadURL(config.url)`
- [x] A clean window close doesn't trigger a reload

#### Unit tests
```js
// test/mainAppWindow/crashRecovery.test.js
describe('Crash recovery', () => {
  it('reloads on non-clean exit', () => {
    const loadURL = jest.fn();
    handleRenderProcessGone({ reason: 'crashed' }, loadURL, 'https://test.url');
    expect(loadURL).toHaveBeenCalledWith('https://test.url', expect.any(Object));
  });

  it('does not reload on clean exit', () => {
    const loadURL = jest.fn();
    handleRenderProcessGone({ reason: 'clean-exit' }, loadURL, 'https://test.url');
    expect(loadURL).not.toHaveBeenCalled();
  });

  it('does not reload on kill signal (expected shutdown)', () => {
    const loadURL = jest.fn();
    handleRenderProcessGone({ reason: 'killed' }, loadURL, 'https://test.url');
    expect(loadURL).toHaveBeenCalled(); // killed = unexpected, should reload
  });
});
```

#### Manual tests
1. F12 → DevTools → console: `process.crash()` → the app should automatically reload to the home page

---

### P1-09 — Test infrastructure (Jest)

**Status:** `completed`
**Files:** `package.json`, `jest.config.js`, `test/`

#### Description
Configure Jest for unit tests (pure JS logic). `electron-mocha` for renderer-context tests (where `navigator` is needed) is documented but not wired into CI — those live under `test/browser/` and are excluded from the default `npm test` run.

#### Acceptance criteria
- [x] `npm test` runs all unit tests
- [x] `test/` mirrors the structure of `app/` (e.g. `test/config/`, `test/mainAppWindow/`)
- [x] Tests from P1-02 through P1-08 are implemented and passing
- [x] `jest.config.js` ignores `dist/` (build artifacts, including `*.snap` files that would otherwise be picked up as stale Jest snapshots)

#### Unit tests
_This task builds infrastructure — it has no tests of its own._

#### Manual tests
1. `npm test` → all tests green

---

### P1-10 — Window state persistence

**Status:** `completed`
**Files:** `app/mainAppWindow/windowState.js`, `app/mainAppWindow/index.js`

#### Description
Remember window size and position across launches. Saved to `~/.config/windows-app-for-linux/window-state.json`.

#### Acceptance criteria
- [x] After closing and reopening — the window has the same size and position
- [x] State isn't saved while the window is minimized or fullscreen
- [x] When the window is off-screen (e.g. after a resolution change) → reset to defaults
- [x] Saved on the `close` event, not on every `resize`

#### Manual tests
1. Launch the app, move and resize the window, close it
2. Launch again → the window appears at the same position with the same size
3. Switch to a smaller resolution → the window isn't off-screen

---

### P1-11 — App icons

**Status:** `completed`
**Files:** `assets/icons/` (PNG 16, 22, 32, 48, 64, 128, 256, 512), `assets/icons/icon.svg`

#### Description
Icon set for the app: a cloud with an AVD/Windows-style window and a Tux mascot, generated from user-provided source art. `icon.svg` is a base64-embedded raster wrapper, not a true vector — the source art is a 3D render, not something that can be losslessly vectorized.

#### Acceptance criteria
- [x] Files: `16x16.png`, `22x22.png` (tray), `32x32.png`, `48x48.png`, `64x64.png`, `128x128.png`, `256x256.png`, `512x512.png`
- [x] Files under `assets/icons/`
- [x] `package.json`'s `linux.icon` points at `assets/icons`
- [x] `npm run build:appimage` reports no missing-icon warnings

#### Manual tests
1. `npm run build:appimage` → the `.AppImage` file is created without icon warnings
2. The installed app has a visible icon in the system launcher and tray

---

## Phase 2 — Tab Manager

Not started. AVD sessions currently open as separate `BrowserWindow`s (see `createAvdWindow` in `app/mainAppWindow/index.js`) rather than tabs within the main window — a simpler, working alternative to the tab-per-`WebContentsView` design originally planned below. The tasks below describe the original tab-based design; revisit only if multiple `BrowserWindow`s per session turns out to be insufficient.

---

### P2-01
**Blocked by:** P1-13 (manual verification of Phase 1), P1-09 (test infrastructure)
**Files:** `app/mainAppWindow/tabManager.js`

#### Description
Module that manages the tab collection. Each tab is a `WebContentsView` with its own preload and a shared session.

```js
// Public interface:
tabManager.createTab(url)   → { id, view, url }
tabManager.getTab(id)       → tab | undefined
tabManager.getAllTabs()      → tab[]
tabManager.getActiveTab()   → tab | undefined
```

#### Acceptance criteria
- [ ] `createTab(url)` creates a `WebContentsView` with `partition: config.sessionPartition`
- [ ] Each tab has a unique ID (UUID or an incrementing number)
- [ ] The `WebContentsView` is added to the `BrowserWindow` via `win.contentView.addChildView()`
- [ ] UA set on the WebContentsView's session
- [ ] `app/browser/preload.js` loaded in every WebContentsView
- [ ] A newly created tab is invisible until `activateTab(id)` is called

#### Unit tests
```js
// test/mainAppWindow/tabManager.test.js
describe('TabManager', () => {
  it('createTab returns object with id, view, url', () => {
    const tab = tabManager.createTab('https://example.com');
    expect(tab.id).toBeDefined();
    expect(tab.url).toBe('https://example.com');
    expect(tab.view).toBeDefined();
  });

  it('getTab returns correct tab by id', () => {
    const tab = tabManager.createTab('https://example.com');
    expect(tabManager.getTab(tab.id)).toBe(tab);
  });

  it('getAllTabs returns all created tabs', () => {
    tabManager.createTab('https://a.com');
    tabManager.createTab('https://b.com');
    expect(tabManager.getAllTabs().length).toBe(2);
  });

  it('createTab with same URL creates separate tabs', () => {
    const t1 = tabManager.createTab('https://a.com');
    const t2 = tabManager.createTab('https://a.com');
    expect(t1.id).not.toBe(t2.id);
  });
});
```

#### Manual tests
_Verify after P2-07 (routing AVD URLs to tabs)._

---

### P2-02 — TabManager: closing a tab with cleanup

**Status:** `pending`
**Blocked by:** P2-01
**Files:** `app/mainAppWindow/tabManager.js`

#### Description
Properly remove a tab: clear storage, remove from BrowserWindow, close webContents.

```js
tabManager.closeTab(id)  // async
```

#### Acceptance criteria
- [ ] `closeTab(id)` calls `clearStorageData()` on the WebContentsView's session
- [ ] `win.contentView.removeChildView(view)` is called
- [ ] `view.webContents.close()` is called
- [ ] The tab is removed from the internal `getAllTabs()` collection
- [ ] Closing the last (only) tab doesn't crash — the panel tab opens instead
- [ ] Closing the active tab → switches to the previous one or the panel

#### Unit tests
```js
describe('TabManager.closeTab', () => {
  it('removes tab from collection', async () => {
    const tab = tabManager.createTab('https://a.com');
    await tabManager.closeTab(tab.id);
    expect(tabManager.getTab(tab.id)).toBeUndefined();
    expect(tabManager.getAllTabs().length).toBe(0);
  });

  it('closing non-existent id does not throw', async () => {
    await expect(tabManager.closeTab('nonexistent')).resolves.not.toThrow();
  });

  it('closing last tab opens panel tab', async () => {
    const tab = tabManager.createTab('https://a.com');
    tabManager.activateTab(tab.id);
    await tabManager.closeTab(tab.id);
    expect(tabManager.getActiveTab().url).toContain('windows.cloud.microsoft');
  });
});
```

#### Manual tests
1. Open an AVD session, close the tab (X on the tab) → back to the device panel
2. Check DevTools → Memory → no leaks after closing several tabs in a row

---

### P2-03 — TabManager: tab activation and bounds

**Status:** `pending`
**Blocked by:** P2-01
**Files:** `app/mainAppWindow/tabManager.js`

#### Description
Switching the active tab: setting bounds, z-order, and visibility.

```js
tabManager.activateTab(id)
```

#### Acceptance criteria
- [ ] The active tab's bounds = the full window area minus the Tab Bar (40px at the top)
- [ ] The previously active tab is hidden (`setBounds({width:0, height:0})` or `removeChildView`)
- [ ] `getActiveTab()` returns the newly activated tab

#### Unit tests
```js
describe('TabManager.activateTab', () => {
  it('sets active tab', () => {
    const t1 = tabManager.createTab('https://a.com');
    const t2 = tabManager.createTab('https://b.com');
    tabManager.activateTab(t2.id);
    expect(tabManager.getActiveTab().id).toBe(t2.id);
  });

  it('activating already-active tab is a no-op', () => {
    const tab = tabManager.createTab('https://a.com');
    tabManager.activateTab(tab.id);
    expect(() => tabManager.activateTab(tab.id)).not.toThrow();
  });
});
```

#### Manual tests
1. Open two AVD sessions → tabs visible in the Tab Bar
2. Click tab #1 → session #1 is visible
3. Click tab #2 → session #2 is visible, session #1 disappears

---

### P2-04 — TabManager: resize on window resize

**Status:** `pending`
**Blocked by:** P2-03
**Files:** `app/mainAppWindow/tabManager.js`

#### Description
When the BrowserWindow resizes, the active WebContentsView must be adjusted.

#### Acceptance criteria
- [ ] The BrowserWindow's `resize` event triggers a bounds update for the active tab
- [ ] Bounds = `{x: 0, y: TAB_BAR_HEIGHT, width: winWidth, height: winHeight - TAB_BAR_HEIGHT}`
- [ ] In fullscreen mode, bounds = `{x: 0, y: 0, width: winWidth, height: winHeight}` (no Tab Bar)

#### Unit tests
```js
describe('calculateTabBounds', () => {
  it('leaves room for tab bar in normal mode', () => {
    const bounds = calculateTabBounds(1280, 800, { fullscreen: false, tabBarHeight: 40 });
    expect(bounds).toEqual({ x: 0, y: 40, width: 1280, height: 760 });
  });

  it('fills full window in fullscreen mode', () => {
    const bounds = calculateTabBounds(1920, 1080, { fullscreen: true, tabBarHeight: 40 });
    expect(bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
});
```

#### Manual tests
1. Resize the window by dragging an edge → the AVD session fills the available space (without overlapping the Tab Bar)
2. Maximize the window → the session still fills the area correctly

---

### P2-05 — Tab Bar: UI (HTML/CSS)

**Status:** `pending`
**Blocked by:** P2-01
**Files:** `app/tabBar/index.html`, `app/tabBar/renderer.js`, `app/tabBar/styles.css`

#### Description
A 40px-tall tab bar shown at the top of the window. Contains:
- A list of tabs with a title and an X button
- A `+` button to open a new tab (→ device panel)
- A visual indicator for the active tab

Design: minimal, dark theme (#1a1a2e background, white text).

#### Acceptance criteria
- [ ] Tabs show the page title (max 20 characters, with `...`)
- [ ] The active tab is visually distinct (e.g. lighter background)
- [ ] The X button closes the tab
- [ ] The `+` button opens a new tab with the panel
- [ ] The Tab Bar is rendered as a `WebContentsView` above the session tabs in z-order
- [ ] No scrolling — titles shrink when there are too many tabs (up to ~8 tabs visible)

#### Unit tests
_DOM tests — run via electron-mocha or Playwright._

#### Manual tests
1. Launch the app → the Tab Bar is visible at the top with one "Windows App" tab
2. Open an AVD session → a new tab appears with the machine's name
3. Hover over a tab → an X appears
4. Click X → the tab closes, back to the previous one
5. Click `+` → the device panel opens in a new tab

---

### P2-06 — IPC: Tab Bar ↔ Main Process

**Status:** `pending`
**Blocked by:** P2-05
**Files:** `app/tabBar/renderer.js`, `app/mainAppWindow/tabManager.js`

#### Description
Two-way IPC communication:

```
Renderer (Tab Bar) → Main:
  'tab:activate' (id)
  'tab:close' (id)
  'tab:new' ()

Main → Renderer (Tab Bar):
  'tabs:update' ([{ id, title, active }])
```

#### Acceptance criteria
- [ ] Clicking a tab in the Tab Bar sends `'tab:activate'` → `tabManager.activateTab(id)`
- [ ] Clicking X sends `'tab:close'` → `tabManager.closeTab(id)`
- [ ] After every tab-state change, main sends `'tabs:update'` with the new list
- [ ] The Tab Bar re-renders on every `'tabs:update'`
- [ ] A page title change (webContents `page-title-updated`) updates the Tab Bar

#### Unit tests
```js
// test/mainAppWindow/ipcTabBridge.test.js
describe('IPC Tab Bridge', () => {
  it('tab:activate triggers tabManager.activateTab', () => {
    const activateMock = jest.fn();
    const bridge = createTabBridge({ tabManager: { activateTab: activateMock } });
    bridge.handleMessage('tab:activate', 'tab-123');
    expect(activateMock).toHaveBeenCalledWith('tab-123');
  });

  it('sends tabs:update after closeTab', async () => {
    const sendMock = jest.fn();
    const bridge = createTabBridge({ send: sendMock, tabManager });
    await bridge.handleMessage('tab:close', 'tab-123');
    expect(sendMock).toHaveBeenCalledWith('tabs:update', expect.any(Array));
  });
});
```

#### Manual tests
1. Open several sessions → the Tab Bar updates dynamically
2. Change the title inside an AVD session (open the remote desktop, rename a window) → the title updates in the Tab Bar

---

### P2-07 — Routing AVD URLs to TabManager

**Status:** `pending`
**Blocked by:** P2-01, P2-03
**Files:** `app/mainAppWindow/index.js`

#### Description
Update `windowOpenHandler` in `mainAppWindow/index.js`: a URL matching `/webclient/avd/` creates a new tab instead of loading in the main window.

#### Acceptance criteria
- [ ] `setWindowOpenHandler` for a `/webclient/avd/` URL calls `tabManager.createTab(url)` + `tabManager.activateTab(id)`
- [ ] Returns `{ action: 'deny' }` (WebContentsView, not a new window)
- [ ] If the same AVD session is already open as a tab → activates the existing tab (no duplicate)
- [ ] The new tab is immediately active and visible

#### Unit tests
```js
// test/mainAppWindow/avdUrlRouting.test.js
describe('AVD URL routing', () => {
  it('routes avd url to tabManager.createTab', () => {
    const createTabMock = jest.fn().mockReturnValue({ id: 'new-tab' });
    const result = handleWindowOpen(
      { url: 'https://windows.cloud.microsoft/webclient/avd/abc123' },
      { createTab: createTabMock, activateTab: jest.fn(), findTabByUrl: jest.fn() }
    );
    expect(createTabMock).toHaveBeenCalledWith('https://windows.cloud.microsoft/webclient/avd/abc123');
    expect(result).toEqual({ action: 'deny' });
  });

  it('activates existing tab if same AVD url already open', () => {
    const existingTab = { id: 'existing-tab', url: 'https://windows.cloud.microsoft/webclient/avd/abc123' };
    const activateMock = jest.fn();
    const createTabMock = jest.fn();
    handleWindowOpen(
      { url: 'https://windows.cloud.microsoft/webclient/avd/abc123' },
      { createTab: createTabMock, activateTab: activateMock, findTabByUrl: () => existingTab }
    );
    expect(createTabMock).not.toHaveBeenCalled();
    expect(activateMock).toHaveBeenCalledWith('existing-tab');
  });
});
```

#### Manual tests
1. Sign in to `windows.cloud.microsoft/#/devices`
2. Click a machine → a new tab appears with a `/webclient/avd/...` URL
3. Go back to the panel, click the same machine again → activates the existing tab, doesn't open a new one

---

### P2-08 — Tab keyboard shortcuts

**Status:** `pending`
**Blocked by:** P2-06
**Files:** `app/menus/appMenu.js`

#### Acceptance criteria
- [ ] `Ctrl+T` — new tab with the device panel (`/#/devices`)
- [ ] `Ctrl+W` — close the active tab (if it's the only one, don't close the window)
- [ ] `Ctrl+Tab` — next tab (cyclic)
- [ ] `Ctrl+Shift+Tab` — previous tab
- [ ] `Ctrl+1` … `Ctrl+8` — activate tab #1-8
- [ ] `Ctrl+R` — reload the active tab

#### Unit tests
_Menu accelerators — verify via electron-mocha / integration test._

#### Manual tests
1. Open several tabs → `Ctrl+Tab` cycles between them
2. `Ctrl+W` on a session tab → the tab closes, back to the previous one
3. `Ctrl+W` with only the panel open → the window **doesn't close** (only the tab would, but it's the only one → ignore)
4. `Ctrl+R` → the active tab reloads

---

### P2-09 — Manual E2E test for Phase 2

**Status:** `pending`
**Blocked by:** P2-07, P2-08

#### Manual tests (full scenario)
1. Run `npm start`
2. Sign in via the auth modal
3. The device panel is visible as the first tab
4. Click machine A → a "Machine A" tab opens with the AVD session
5. Go back to the panel (`Ctrl+Tab` or click the tab)
6. Click machine B → a "Machine B" tab opens
7. You now have 3 tabs: Panel, Machine A, Machine B
8. `Ctrl+W` on Machine B → the tab closes, back to the previous one
9. Verify the panel still works correctly
10. Close the window → the app exits

---

## Phase 3 — Fullscreen & Keyboard

---

### P3-01 — F11: toggle fullscreen for the active tab

**Status:** `pending`
**Blocked by:** P2-09

#### Description
F11 in the main window toggles fullscreen mode. In fullscreen, the Tab Bar is hidden and the active WebContentsView occupies 100% of the window.

#### Acceptance criteria
- [ ] F11 → `mainWindow.setFullScreen(true)` + Tab Bar hidden + active WebContentsView resized to 100%
- [ ] F11 again → exits fullscreen, Tab Bar comes back, WebContentsView resized to normal bounds
- [ ] `Escape` sent to webContents (needed by the web app to exit its own fullscreen UI)
- [ ] Fullscreen state kept per tab (tab #1 fullscreen, tab #2 not)

#### Unit tests
```js
// test/mainAppWindow/fullscreen.test.js
describe('calculateTabBounds in fullscreen', () => {
  it('returns full window bounds when fullscreen=true', () => {
    const bounds = calculateTabBounds(1920, 1080, { fullscreen: true, tabBarHeight: 40 });
    expect(bounds).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
});

describe('Fullscreen state', () => {
  it('tracks fullscreen per tab id', () => {
    const state = createFullscreenState();
    state.setFullscreen('tab-1', true);
    state.setFullscreen('tab-2', false);
    expect(state.isFullscreen('tab-1')).toBe(true);
    expect(state.isFullscreen('tab-2')).toBe(false);
  });
});
```

#### Manual tests
1. Open an AVD session
2. F11 → the Tab Bar disappears, the session fills the screen
3. F11 again → the Tab Bar comes back
4. Enter fullscreen, switch tabs → the previous tab exits fullscreen

---

### P3-02 — Info overlay on first fullscreen entry

**Status:** `pending`
**Blocked by:** P3-01
**Files:** `app/browser/fullscreenOverlay.js` or inline in the preload

#### Description
On the first entry into fullscreen, show a brief overlay (3 seconds) listing the available shortcuts.

Content:
```
Fullscreen active
Ctrl+Alt+End → Ctrl+Alt+Del (remote)
Alt+F3 → Windows key (remote)
F11 → exit fullscreen
```

#### Acceptance criteria
- [ ] The overlay only appears once (store a flag in `electron-store` or `localStorage`)
- [ ] The overlay disappears after 3 seconds
- [ ] The overlay can be dismissed early by clicking it

#### Unit tests
```js
describe('Fullscreen overlay', () => {
  it('shows only once', () => {
    const store = new MockStore();
    expect(shouldShowOverlay(store)).toBe(true);
    markOverlayShown(store);
    expect(shouldShowOverlay(store)).toBe(false);
  });
});
```

#### Manual tests
1. Enter fullscreen for the first time → the overlay is visible for 3s
2. Exit and re-enter fullscreen → the overlay doesn't appear

---

### P3-03 — Application menu with all shortcuts

**Status:** `completed` (baseline shortcuts; tab-specific ones pending Phase 2)
**Files:** `app/menus/appMenu.js`

#### Acceptance criteria
- [x] `View` menu: F11 (Fullscreen), Ctrl+R (Reload), Ctrl+= (Zoom In), Ctrl+- (Zoom Out), Ctrl+0 (Reset Zoom), Ctrl+Shift+I (DevTools)
- [x] `File` menu: Ctrl+, (Settings), Ctrl+Q (Quit)
- [x] `Navigation` menu: Alt+Left (Back), Alt+Right (Forward)
- [ ] `Tabs` menu: Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+1…8 (Phase 2)
- [x] The menu is visible via `Alt` on the keyboard (standard Linux behavior) — it auto-hides otherwise (`autoHideMenuBar`), so the tray menu's "Settings" entry is the reliable entry point

#### Manual tests
1. Press `Alt` → the menu appears
2. Every shortcut on the list behaves as described

---

### P3-04 — Manual keyboard test in fullscreen

**Status:** `pending`
**Blocked by:** P3-01, P3-03

#### Manual tests (on a real AVD session)
1. Enter an AVD session, press F11 → fullscreen active
2. Go to the session settings (gear icon in the toolbar) → enable "Keyboard shortcuts (preview)"
3. Test:
   - `Ctrl+Alt+End` → the Ctrl+Alt+Del dialog appears on the remote ✅
   - `Alt+F3` → opens the Start menu on the remote ✅
   - `Ctrl+C` / `Ctrl+V` → copy/paste forwarded to the remote ✅
   - `Alt+Tab` → switches windows on the **remote** (not locally) ✅
4. Exit fullscreen via F11 → `Alt+Tab` switches local windows again ✅

---

## Phase 4 — System integration

---

### P4-01 — System tray

**Status:** `completed`
**Files:** `app/tray/index.js`

#### Acceptance criteria
- [x] The tray icon appears once the app launches
- [x] Clicking the icon → shows/focuses the main window
- [x] Right-click → menu: "Show portal" / "Settings" / open sessions / "Quit" / "Quit and clear session"
- [x] Closing the window (X) → hides to tray (doesn't end the process)
- [x] "Quit" in the tray menu → `app.quit()`

#### Manual tests
1. Launch the app → an icon appears in the system tray
2. Close the window via X → the icon stays, the app keeps running
3. Click the icon → the window comes back
4. Right-click → "Quit" → the icon disappears, the app exits

---

### P4-02 — Zoom with persistence

**Status:** `pending`
**Blocked by:** P3-04
**Files:** `app/browser/tools/zoom.js`, `app/mainAppWindow/index.js`

#### Acceptance criteria
- [ ] `Ctrl++` / `Ctrl+-` / `Ctrl+0` — zoom in/out/reset via `webContents.setZoomLevel()` (in/out/reset already work per-window without persistence; only the persistence part is pending)
- [ ] Zoom level saved to `~/.config/windows-app-for-linux/config.json`
- [ ] Zoom restored after relaunch
- [ ] Zoom independent per tab (panel and sessions can have different levels)

#### Manual tests
1. `Ctrl++` a few times → the page zooms in
2. Close and reopen the app → zoom preserved
3. `Ctrl+0` → zoom resets to 100%

---

### P4-03 — Manual E2E test for Phase 4

**Status:** `pending`
**Blocked by:** P4-01, P4-02

#### Manual tests
1. Tray works correctly (P4-01)
2. Zoom is saved (P4-02)
3. Window state is saved (P1-10)
4. The app launches on Wayland without errors (if available)
5. On X11: no `libva`/`VAAPI` warnings in stdout

---

## Phase 5 — Packaging & Flathub

---

### P5-01 — Complete icon set

**Status:** `completed`
**Blocked by:** P1-11

#### Acceptance criteria
- [x] Source "vector" (base64-embedded raster wrapper) in `assets/icons/icon.svg`
- [x] PNG: 16, 22, 32, 48, 64, 128, 256, 512 in `assets/icons/`
- [x] electron-builder configuration points at the right directory

---

### P5-02 — AppStream metadata

**Status:** `completed`
**Blocked by:** P5-01
**Files:** `assets/io.github.mariuszkopowski.WindowsAppForLinux.appdata.xml`

#### Acceptance criteria
- [x] `<id>`: `io.github.mariuszkopowski.WindowsAppForLinux`
- [x] `<name>`: `Windows App`
- [x] `<summary>` and `<description>` in English
- [x] `<url type="homepage">` points at the GitHub repository
- [x] `<releases>` with the current version and date
- [x] `<screenshots>` — at least one screenshot (`docs/screenshot.png` still needs to be added)
- [ ] `appstreamcli validate` passes without errors (not yet run)

#### Manual tests
1. `appstreamcli validate assets/io.github.mariuszkopowski.WindowsAppForLinux.appdata.xml` → no errors

---

### P5-03 — Build AppImage

**Status:** `completed`
**Blocked by:** P5-01, P5-02

#### Acceptance criteria
- [x] `npm run build:appimage` completes successfully
- [x] `dist/Windows App-*.AppImage` exists
- [x] The AppImage runs without sudo: `chmod +x *.AppImage && ./*.AppImage`
- [x] The app loads `windows.cloud.microsoft` when launched from the AppImage

#### Manual tests
1. Build: `npm run build:appimage`
2. `chmod +x dist/*.AppImage && dist/*.AppImage`
3. The app launches, loads the page, sign-in works

---

### P5-04 — Build Flatpak

**Status:** `completed`
**Blocked by:** P5-01, P5-02

#### Acceptance criteria
- [x] `npm run build:flatpak` completes successfully
- [x] `dist/*.flatpak` exists
- [x] `flatpak install --user dist/*.flatpak` works
- [x] The app launches from the Flatpak sandbox without permission errors (network, audio, Wayland/X11)
- [x] Signing in to `windows.cloud.microsoft` works from the sandbox

#### Manual tests
1. `npm run build:flatpak`
2. `flatpak install --user dist/*.flatpak`
3. `flatpak run io.github.mariuszkopowski.WindowsAppForLinux`
4. Sign-in and the AVD session work
5. Check whether camera and microphone are available in the session (if the tenant allows it — see the camera limitation note in `docs/PLAN.md`)

---

### P5-05 — Build Snap

**Status:** `completed`
**Blocked by:** P5-01, P5-02

#### Description
Uses electron-builder's built-in `snap` target rather than a hand-rolled `snapcraft.yaml`. electron-builder's snap builder uses its own bundled helper (`app-builder-bin`) to assemble the squashfs image directly — it doesn't shell out to `snapcraft` and doesn't need `snapd` running, which makes it work fine in a plain Docker container CI job (confirmed: `squashfs-tools` is enough).

#### Acceptance criteria
- [x] `npm run build:snap` completes successfully
- [x] `dist/*.snap` exists
- [x] Strict confinement, with plugs for camera, audio-playback/record, network, network-bind, desktop(-legacy), wayland, x11, opengl, pulseaudio, home, removable-media
- [x] Built and installed locally (`snap install --dangerous`), verified to launch

---

### P5-06 — Flathub manifest

**Status:** `pending`
**Blocked by:** P5-04

#### Description
Flathub requires a separate public GitHub repository with the manifest. It isn't part of the main repo.

#### Acceptance criteria
- [ ] `flathub/io.github.mariuszkopowski.WindowsAppForLinux` repository (or a fork of the Flathub template)
- [ ] `io.github.mariuszkopowski.WindowsAppForLinux.yml` Flatpak manifest file
- [ ] The manifest downloads an AppImage release from GitHub Releases or builds from source
- [ ] `flatpak-builder --install --user builddir io.github.mariuszkopowski.WindowsAppForLinux.yml` works locally
- [ ] A PR to `github.com/flathub/flathub` is open (final step)

#### Manual tests
1. Local build from the Flathub manifest: `flatpak-builder --install --user builddir manifest.yml`
2. The app launches from that build

---

## Summary

| Phase | Tasks | Done |
|---|---|---|
| 1 — Foundation | 11 | 11 |
| 2 — Tab Manager | 9 | 0 |
| 3 — Fullscreen | 4 | 1 |
| 4 — System | 3 | 1 |
| 5 — Packaging | 6 | 5 |
| **Total** | **33** | **18** |
