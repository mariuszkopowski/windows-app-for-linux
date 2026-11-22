const AUTH_DOMAINS = [
  'login.microsoftonline.com',
  'login.live.com',
  'login.microsoft.com',
  'account.live.com',
  'aadcdn.msftauth.net',
];

function isAuthUrl(url) {
  try {
    return AUTH_DOMAINS.some(d => new URL(url).hostname.endsWith(d));
  } catch {
    return false;
  }
}

// Matches /webclient/<resourceType>/<resourceId...> — the portal uses different
// resource-type segments for different session kinds observed in the wild:
// "avd" for classic Azure Virtual Desktop host-pool sessions, "ent" for
// Windows 365 Enterprise Cloud PCs. Only the exact host is trusted, but the
// resource-type segment itself is not enumerated (Microsoft doesn't publish
// the full list) — any single segment there is accepted so a session kind we
// haven't seen yet still opens in-app instead of falling through to the
// system browser.
function isAvdUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname === 'windows.cloud.microsoft' && /^\/webclient\/[^/]+\/.+/.test(pathname);
  } catch {
    return false;
  }
}

function isSafeExternalUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

// Federated/enterprise identity providers (ADFS, Okta, Ping, ...) can't be
// enumerated by domain, but Chromium reports them as small popup windows
// during sign-in — used as a fallback signal for isAuthUrl().
function isLikelyAuthPopup(features, disposition) {
  if (disposition === 'new-popup') return true;
  if (typeof features !== 'string') return false;
  if (features.includes('popup')) return true;
  const width = Number((/\bwidth=(\d+)/i.exec(features) || [])[1]);
  const height = Number((/\bheight=(\d+)/i.exec(features) || [])[1]);
  return Boolean(width && height && width < 800 && height < 800);
}

// Single source of truth for what a window.open()/target=_blank request should
// become. Used by both the main window and every AVD session window — they
// used to each inline a slightly-drifted copy of this logic, which is how the
// isAuthUrl() check went missing from the AVD window's handler.
//
// Returns one of: 'avd' | 'authPopup' | 'external' | 'deny'.
function classifyWindowOpen(url, features, disposition) {
  if (isAvdUrl(url)) return 'avd';

  const isBlank = !url || url === 'about:blank' || url === 'about:blank#blocked';
  if (isBlank) {
    // Auth libraries (MSAL's popup flow, used as a fallback for per-resource
    // consent prompts like Cloud PC "grant permission") open a blank popup
    // synchronously to preserve the click's user gesture, then navigate it
    // once the real sign-in URL is known — there's no URL to classify yet,
    // so this has to go on the window-shape heuristic alone.
    return isLikelyAuthPopup(features, disposition) ? 'authPopup' : 'deny';
  }
  if (isAuthUrl(url) || (isSafeExternalUrl(url) && isLikelyAuthPopup(features, disposition))) {
    return 'authPopup';
  }
  if (isSafeExternalUrl(url)) return 'external';
  return 'deny';
}

// Derives the Edge/Chromium major version from the configured User-Agent
// string, so the sec-ch-ua headers and the userAgentData spoof (preload.js)
// stay consistent with a user-edited UA instead of a second hardcoded copy.
function parseUaVersions(userAgent) {
  const edgeMatch = /Edg\/(\d+)/.exec(userAgent || '');
  const chromeMatch = /Chrome\/(\d+)/.exec(userAgent || '');
  return {
    edge: edgeMatch ? edgeMatch[1] : '143',
    chrome: chromeMatch ? chromeMatch[1] : '143',
  };
}

// Clears stale RDP session state (fixes a grey screen on reconnect) without
// touching localStorage — the portal's first-run flags (see preload.js) and
// cookies (SSO) live there and must survive across AVD sessions.
async function clearAvdSessionState(appSession) {
  await appSession.clearStorageData({
    storages: ['indexeddb', 'sessionstorage', 'serviceworkers', 'cachestorage'],
  });
}

const ALLOWED_PERMISSIONS = [
  'camera', 'microphone', 'notifications', 'media',
  'display-capture', 'clipboard-read', 'clipboard-sanitized-write',
  'fullscreen', 'keyboardLock', 'pointerLock',
];

function permissionAllowed(permission) {
  return ALLOWED_PERMISSIONS.includes(permission);
}

function stripCspReportOnly(headers) {
  const result = { ...headers };
  delete result['content-security-policy-report-only'];
  delete result['Content-Security-Policy-Report-Only'];
  return result;
}

function handleRenderProcessGone(details, reload) {
  if (details.reason !== 'clean-exit') reload();
}

// `isExempt(details)` lets requests from our own auth popups through, so their
// about:blank -> IdP navigation isn't punted to the system browser.
function createAboutBlankInterceptor(openExternal, isExempt = () => false) {
  let count = 0;
  function handler(details, callback) {
    const { url, resourceType } = details;
    if (isExempt(details)) {
      callback({});
      return;
    }
    if (url === 'about:blank') {
      count++;
      callback({ cancel: true });
      return;
    }
    if (count > 0 && resourceType === 'mainFrame' && url.startsWith('https://')) {
      count = 0;
      openExternal(url);
      callback({ cancel: true });
      return;
    }
    count = 0;
    callback({});
  }
  handler.getCount = () => count;
  return handler;
}

module.exports = {
  isAuthUrl,
  isAvdUrl,
  isSafeExternalUrl,
  isLikelyAuthPopup,
  classifyWindowOpen,
  parseUaVersions,
  clearAvdSessionState,
  permissionAllowed,
  stripCspReportOnly,
  handleRenderProcessGone,
  createAboutBlankInterceptor,
};
