const { isAuthUrl, isAvdUrl, isSafeExternalUrl, isLikelyAuthPopup, classifyWindowOpen } = require('../../app/mainAppWindow/helpers');

describe('isAuthUrl', () => {
  it('detects login.microsoftonline.com', () => {
    expect(isAuthUrl('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')).toBe(true);
  });

  it('detects login.live.com', () => {
    expect(isAuthUrl('https://login.live.com/oauth20_authorize.srf')).toBe(true);
  });

  it('detects login.microsoft.com', () => {
    expect(isAuthUrl('https://login.microsoft.com/foo')).toBe(true);
  });

  it('detects account.live.com', () => {
    expect(isAuthUrl('https://account.live.com/proofs/Add')).toBe(true);
  });

  it('detects aadcdn.msftauth.net', () => {
    expect(isAuthUrl('https://aadcdn.msftauth.net/resource.js')).toBe(true);
  });

  it('rejects windows.cloud.microsoft', () => {
    expect(isAuthUrl('https://windows.cloud.microsoft/#/devices')).toBe(false);
  });

  it('rejects unrelated domains', () => {
    expect(isAuthUrl('https://example.com')).toBe(false);
  });

  it('handles malformed URLs without throwing', () => {
    expect(() => isAuthUrl('not-a-url')).not.toThrow();
    expect(isAuthUrl('not-a-url')).toBe(false);
  });

  it('handles empty string without throwing', () => {
    expect(() => isAuthUrl('')).not.toThrow();
    expect(isAuthUrl('')).toBe(false);
  });
});

describe('isAvdUrl', () => {
  it('detects AVD session URLs', () => {
    expect(isAvdUrl('https://windows.cloud.microsoft/webclient/avd/abc-123-guid')).toBe(true);
  });

  it('detects Windows 365 Enterprise Cloud PC session URLs (webclient/ent)', () => {
    expect(isAvdUrl('https://windows.cloud.microsoft/webclient/ent/cbaaf69f-d75b-4701-ba7d-845498bd4464?endpointId=4c628cbd#loginHint=x')).toBe(true);
  });

  it('detects multi-segment AVD session URLs (workspace/resource)', () => {
    expect(isAvdUrl('https://windows.cloud.microsoft/webclient/avd/e520c9c7-32dc-470a-9382-c9e3291d96d3/14bfb9d4-285a-456b-1269-08d8d62b1f28')).toBe(true);
  });

  it('does not match portal URL', () => {
    expect(isAvdUrl('https://windows.cloud.microsoft/#/devices')).toBe(false);
  });

  it('does not match partial webclient path', () => {
    expect(isAvdUrl('https://windows.cloud.microsoft/webclient/')).toBe(false);
  });

  it('rejects a spoofed URL that only contains the AVD path as a substring', () => {
    expect(isAvdUrl('https://evil.example/?x=windows.cloud.microsoft/webclient/avd/fake')).toBe(false);
  });

  it('rejects a lookalike hostname', () => {
    expect(isAvdUrl('https://windows.cloud.microsoft.evil.example/webclient/avd/abc')).toBe(false);
  });

  it('handles malformed URLs without throwing', () => {
    expect(() => isAvdUrl('not-a-url')).not.toThrow();
    expect(isAvdUrl('not-a-url')).toBe(false);
  });
});

describe('isSafeExternalUrl', () => {
  it('allows https URLs', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
  });

  it('allows http URLs', () => {
    expect(isSafeExternalUrl('http://example.com')).toBe(true);
  });

  it('rejects file URLs', () => {
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects arbitrary custom protocol handlers', () => {
    expect(isSafeExternalUrl('some-app://payload')).toBe(false);
  });

  it('handles malformed URLs without throwing', () => {
    expect(() => isSafeExternalUrl('not-a-url')).not.toThrow();
    expect(isSafeExternalUrl('not-a-url')).toBe(false);
  });
});

describe('isLikelyAuthPopup', () => {
  it('detects the new-popup disposition', () => {
    expect(isLikelyAuthPopup(undefined, 'new-popup')).toBe(true);
  });

  it('detects a "popup" features string', () => {
    expect(isLikelyAuthPopup('popup=yes,width=500,height=700', 'foreground-tab')).toBe(true);
  });

  it('detects small width/height dimensions', () => {
    expect(isLikelyAuthPopup('width=500,height=700', 'foreground-tab')).toBe(true);
  });

  it('rejects large window dimensions (RDP-session sized)', () => {
    expect(isLikelyAuthPopup('width=1920,height=1080', 'foreground-tab')).toBe(false);
  });

  it('rejects when no size/popup signal is present', () => {
    expect(isLikelyAuthPopup(undefined, 'foreground-tab')).toBe(false);
  });

  it('handles non-string features without throwing', () => {
    expect(() => isLikelyAuthPopup(null, 'foreground-tab')).not.toThrow();
    expect(isLikelyAuthPopup(null, 'foreground-tab')).toBe(false);
  });
});

describe('classifyWindowOpen', () => {
  it('routes AVD session URLs to avd', () => {
    expect(classifyWindowOpen('https://windows.cloud.microsoft/webclient/avd/abc-123', undefined, 'foreground-tab')).toBe('avd');
  });

  it('routes a blank popup with auth-popup-shaped features to authPopup (MSAL two-phase popup)', () => {
    // MSAL's AcquireTokenPopup flow opens window.open('about:blank', 'msal', 'width=483,height=600,...')
    // synchronously to preserve the click gesture, then navigates it once the real sign-in URL is known.
    expect(classifyWindowOpen('about:blank', 'width=483,height=600', 'foreground-tab')).toBe('authPopup');
  });

  it('routes an empty-string popup URL the same as about:blank', () => {
    expect(classifyWindowOpen('', 'width=483,height=600', 'foreground-tab')).toBe('authPopup');
  });

  it('routes about:blank#blocked with popup-shaped features to authPopup', () => {
    expect(classifyWindowOpen('about:blank#blocked', undefined, 'new-popup')).toBe('authPopup');
  });

  it('denies a blank popup with no popup signal (not an auth flow)', () => {
    expect(classifyWindowOpen('about:blank', undefined, 'foreground-tab')).toBe('deny');
  });

  it('routes known auth domains to authPopup regardless of window shape', () => {
    expect(classifyWindowOpen('https://login.microsoftonline.com/common/oauth2/v2.0/authorize', undefined, 'foreground-tab')).toBe('authPopup');
  });

  it('routes a small popup-shaped external URL to authPopup (federated IdP)', () => {
    expect(classifyWindowOpen('https://idp.example.com/login', 'width=500,height=700', 'foreground-tab')).toBe('authPopup');
  });

  it('routes an ordinary https link to external', () => {
    expect(classifyWindowOpen('https://example.com', undefined, 'foreground-tab')).toBe('external');
  });

  it('denies unsafe protocols', () => {
    expect(classifyWindowOpen('file:///etc/passwd', undefined, 'foreground-tab')).toBe('deny');
  });

  it('denies malformed URLs without throwing', () => {
    expect(() => classifyWindowOpen('not-a-url', undefined, 'foreground-tab')).not.toThrow();
    expect(classifyWindowOpen('not-a-url', undefined, 'foreground-tab')).toBe('deny');
  });
});
