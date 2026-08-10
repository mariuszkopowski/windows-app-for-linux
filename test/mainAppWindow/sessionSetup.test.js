const {
  permissionAllowed,
  isTrustedMediaOrigin,
  shouldGrantPermission,
  stripCspReportOnly,
  clearAvdSessionState,
  parseUaVersions,
} = require('../../app/mainAppWindow/helpers');

describe('permissionAllowed', () => {
  const granted = ['camera', 'microphone', 'notifications', 'media', 'display-capture', 'clipboard-read', 'clipboard-sanitized-write'];
  const denied = ['geolocation', 'fullscreen', 'pointerLock', 'unknown-permission'];

  granted.forEach(perm => {
    it(`grants ${perm}`, () => {
      expect(permissionAllowed(perm)).toBe(true);
    });
  });

  denied.forEach(perm => {
    it(`denies ${perm}`, () => {
      expect(permissionAllowed(perm)).toBe(false);
    });
  });
});

describe('shouldGrantPermission', () => {
  it('grants supported permissions only to Windows App origins', () => {
    expect(shouldGrantPermission('media', 'https://windows.cloud.microsoft/')).toBe(true);
    expect(shouldGrantPermission('camera', 'https://rdweb.wvd.azure.us/')).toBe(true);
    expect(shouldGrantPermission('microphone', 'https://rdweb.wvd.microsoft.us/')).toBe(true);
    expect(shouldGrantPermission('media', 'https://example.com/')).toBe(false);
  });

  it('limits the internal media check to capture permissions', () => {
    const internal = { internalMediaCheck: true };
    expect(shouldGrantPermission('camera', 'file:///media-check.html', internal)).toBe(true);
    expect(shouldGrantPermission('microphone', 'file:///media-check.html', internal)).toBe(true);
    expect(shouldGrantPermission('notifications', 'file:///media-check.html', internal)).toBe(false);
    expect(shouldGrantPermission('camera', 'file:///media-check.html')).toBe(false);
  });

  it('recognizes only exact HTTPS Windows App hosts', () => {
    expect(isTrustedMediaOrigin('https://windows.cloud.microsoft/')).toBe(true);
    expect(isTrustedMediaOrigin('http://windows.cloud.microsoft/')).toBe(false);
    expect(isTrustedMediaOrigin('https://windows.cloud.microsoft.example.com/')).toBe(false);
  });
});

describe('stripCspReportOnly', () => {
  it('removes lowercase content-security-policy-report-only', () => {
    const headers = {
      'content-type': 'text/html',
      'content-security-policy-report-only': 'default-src https:',
    };
    const result = stripCspReportOnly(headers);
    expect(result['content-security-policy-report-only']).toBeUndefined();
    expect(result['content-type']).toBe('text/html');
  });

  it('removes capitalized Content-Security-Policy-Report-Only', () => {
    const headers = { 'Content-Security-Policy-Report-Only': 'default-src https:' };
    const result = stripCspReportOnly(headers);
    expect(result['Content-Security-Policy-Report-Only']).toBeUndefined();
  });

  it('does not mutate the original object', () => {
    const headers = { 'content-security-policy-report-only': 'value' };
    stripCspReportOnly(headers);
    expect(headers['content-security-policy-report-only']).toBe('value');
  });

  it('passes through unrelated headers unchanged', () => {
    const headers = { 'content-type': 'application/json', 'x-frame-options': 'DENY' };
    expect(stripCspReportOnly(headers)).toEqual(headers);
  });

  it('handles empty headers object', () => {
    expect(stripCspReportOnly({})).toEqual({});
  });
});

describe('clearAvdSessionState', () => {
  it('clears indexeddb, sessionstorage, serviceworkers and cachestorage', async () => {
    const clearStorageData = jest.fn().mockResolvedValue(undefined);
    await clearAvdSessionState({ clearStorageData });
    expect(clearStorageData).toHaveBeenCalledWith({
      storages: ['indexeddb', 'sessionstorage', 'serviceworkers', 'cachestorage'],
    });
  });

  it('does not clear localStorage or cookies', () => {
    const clearStorageData = jest.fn().mockResolvedValue(undefined);
    clearAvdSessionState({ clearStorageData });
    const [{ storages }] = clearStorageData.mock.calls[0];
    expect(storages).not.toContain('localstorage');
    expect(storages).not.toContain('cookies');
  });
});

describe('parseUaVersions', () => {
  it('extracts the Edge and Chrome major versions from a standard UA string', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';
    expect(parseUaVersions(ua)).toEqual({ edge: '143', chrome: '143' });
  });

  it('extracts differing Edge/Chrome versions', () => {
    const ua = 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/121.0.0.0';
    expect(parseUaVersions(ua)).toEqual({ edge: '121', chrome: '120' });
  });

  it('falls back to 143 when the UA has no Edg/ token', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36';
    expect(parseUaVersions(ua)).toEqual({ edge: '143', chrome: '143' });
  });

  it('handles empty/undefined input without throwing', () => {
    expect(() => parseUaVersions(undefined)).not.toThrow();
    expect(parseUaVersions('')).toEqual({ edge: '143', chrome: '143' });
  });
});
