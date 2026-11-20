// Runs in renderer context (contextIsolation: false) before page scripts

const { parseUaVersions } = require('../mainAppWindow/helpers');
const { installWebauthnShim } = require('./webauthn');

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

function spoofPlatform() {
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
}

function spoofUserAgentData() {
  try {
    const original = navigator.userAgentData;
    if (!original) return;

    // Build spoofed NavigatorUAData-compatible object
    const spoofed = {
      brands: BRANDS,
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
          ...(hints.includes('uaFullVersion') && { uaFullVersion: `${EDGE_VERSION}.0.0.0` }),
          ...(hints.includes('fullVersionList') && {
            fullVersionList: [
              { brand: 'Microsoft Edge', version: `${EDGE_VERSION}.0.0.0` },
              { brand: 'Chromium', version: `${CHROME_VERSION}.0.0.0` },
              { brand: 'Not_A Brand', version: '99.0.0.0' },
            ],
          }),
        };
      },
      toJSON: () => ({ brands: BRANDS, mobile: false, platform: 'Windows' }),
    };

    // Try instance first — takes priority over prototype without needing reconfigurability
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
}

// ---------------------------------------------------------------------------
// Must run after the declarations above — spoofUserAgentData() reads BRANDS.

spoofPlatform();
spoofUserAgentData();
skipFirstRunExperience();
installWebauthnShim();
