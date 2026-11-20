const { isAuthUrl, isAvdUrl, isSafeExternalUrl, isLikelyAuthPopup, isBlankAuthPopup } = require('../../app/mainAppWindow/helpers');

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

describe('isBlankAuthPopup', () => {
  it('allows an about:blank popup (MSAL sign-in pattern)', () => {
    expect(isBlankAuthPopup('about:blank', 'popup,width=483,height=600', 'new-popup')).toBe(true);
  });

  it('allows about:blank with only a small window size', () => {
    expect(isBlankAuthPopup('about:blank', 'width=500,height=600', 'new-window')).toBe(true);
  });

  it('rejects a plain about:blank tab', () => {
    expect(isBlankAuthPopup('about:blank', '', 'foreground-tab')).toBe(false);
  });

  it('rejects non-blank URLs', () => {
    expect(isBlankAuthPopup('https://example.com', 'popup', 'new-popup')).toBe(false);
  });

  it('rejects about:blank#blocked', () => {
    expect(isBlankAuthPopup('about:blank#blocked', 'popup', 'new-popup')).toBe(false);
  });
});
