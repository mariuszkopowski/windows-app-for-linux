// Runs in the isolated preload context (contextIsolation: true) before page scripts

const { contextBridge } = require('electron');
const { parseUaVersions } = require('../mainAppWindow/helpers');

function skipFirstRunExperience() {
  try {
    if (!location.hostname.includes('windows.cloud.microsoft')) return;

    // redux-persist serializes Redux state values as JSON strings within the object.
    // "false" here is a string (Redux state value), not a boolean.
    const PERSIST_META = JSON.stringify({ version: -1, rehydrated: true });

    const patch = (key, updates) => {
      const existing = JSON.parse(localStorage.getItem(key) || 'null') || {};
      localStorage.setItem(key, JSON.stringify({
        ...existing,
        ...updates,
        _persist: existing._persist || PERSIST_META,
      }));
    };

    patch('persist:up_home', {
      shouldRunFRE: 'false',
      showQuickTourNextTime: 'false',
      shouldRunFREWithUserSettings: 'false',
    });
    patch('persist:up_apex', { apexFirstRunCompleted: 'true' });
    patch('persist:up_header_bubble', { helpBubbleShownForAvdWebAuto: 'true' });
    patch('persist:nativeClient', {
      firstRun: 'false',
      cardTeachingPopoverDismissed: 'true',
    });
  } catch { /* non-fatal */ }
}

// ---------------------------------------------------------------------------

// Derived from the actual (possibly user-configured) UA string rather than a
// hardcoded version, so a UA changed via Settings doesn't drift out of sync
// with the Client Hints this preload reports.
const { edge: EDGE_VERSION, chrome: CHROME_VERSION } = parseUaVersions(navigator.userAgent);
const BRANDS = [
  { brand: 'Microsoft Edge', version: EDGE_VERSION },
  { brand: 'Chromium', version: CHROME_VERSION },
  { brand: 'Not_A Brand', version: '99' },
];

// contextIsolation keeps this preload's JS context separate from the page's
// main world, so patching Navigator.prototype here would be invisible to the
// page — run the actual spoofing inside the main world via contextBridge.
// (executeInMainWorld serializes `func`, so it can't close over outer vars —
// everything it needs is passed through `args`.)
contextBridge.executeInMainWorld({
  args: [BRANDS, EDGE_VERSION, CHROME_VERSION],
  func: (brands, edgeVersion, chromeVersion) => {
    try {
      Object.defineProperty(Navigator.prototype, 'platform', {
        get: () => 'Win32',
        configurable: true,
      });
    } catch {
      try {
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32',
          configurable: true,
        });
      } catch { /* non-fatal */ }
    }

    try {
      const original = navigator.userAgentData;
      if (!original) return;

      const spoofed = {
        brands,
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async (hints) => {
          let base = {};
          try { base = await original.getHighEntropyValues(hints); } catch { /* ok */ }
          return {
            ...base,
            ...(hints.includes('platform') && { platform: 'Windows' }),
            ...(hints.includes('platformVersion') && { platformVersion: '15.0.0' }),
            ...(hints.includes('architecture') && { architecture: 'x86' }),
            ...(hints.includes('bitness') && { bitness: '64' }),
            ...(hints.includes('wow64') && { wow64: false }),
            ...(hints.includes('uaFullVersion') && { uaFullVersion: `${edgeVersion}.0.0.0` }),
            ...(hints.includes('fullVersionList') && {
              fullVersionList: [
                { brand: 'Microsoft Edge', version: `${edgeVersion}.0.0.0` },
                { brand: 'Chromium', version: `${chromeVersion}.0.0.0` },
                { brand: 'Not_A Brand', version: '99.0.0.0' },
              ],
            }),
          };
        },
        toJSON: () => ({ brands, mobile: false, platform: 'Windows' }),
      };

      const targets = [navigator, Navigator.prototype];
      for (const target of targets) {
        try {
          Object.defineProperty(target, 'userAgentData', {
            get: () => spoofed,
            configurable: true,
            enumerable: true,
          });
          break;
        } catch { /* try next */ }
      }
    } catch { /* non-fatal */ }
  },
});

skipFirstRunExperience();
