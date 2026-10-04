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

function isAvdUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname === 'windows.cloud.microsoft' && pathname.startsWith('/webclient/avd/');
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

// MSAL-style sign-in (e.g. the consent prompt when granting an AVD
// permission) calls window.open('about:blank', name, 'popup,...') and navigates
// that window to the IdP afterwards. Denying it hands the page `null`, so the
// sign-in window never shows up. A plain about:blank without popup hints is
// still denied (see createAboutBlankInterceptor).
function isBlankAuthPopup(url, features, disposition) {
  return url === 'about:blank' && isLikelyAuthPopup(features, disposition);
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
  isBlankAuthPopup,
  parseUaVersions,
  clearAvdSessionState,
  permissionAllowed,
  stripCspReportOnly,
  handleRenderProcessGone,
  createAboutBlankInterceptor,
};
