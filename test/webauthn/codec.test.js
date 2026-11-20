const {
  bufferToBase64Url, base64UrlToBuffer, requestOptionsToJSON, credentialFromJSON,
} = require('../../app/webauthn/codec');

describe('base64url helpers', () => {
  it('round-trips arbitrary bytes without padding or +/ characters', () => {
    const bytes = new Uint8Array([251, 255, 190, 0, 1, 2, 3]);
    const encoded = bufferToBase64Url(bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(new Uint8Array(base64UrlToBuffer(encoded))).toEqual(bytes);
  });

  it('accepts ArrayBuffer and typed-array views with offsets', () => {
    const backing = new Uint8Array([9, 1, 2, 3, 9]).buffer;
    expect(bufferToBase64Url(new Uint8Array(backing, 1, 3))).toBe(bufferToBase64Url(new Uint8Array([1, 2, 3])));
    expect(bufferToBase64Url(new Uint8Array([1, 2, 3]).buffer)).toBe('AQID');
  });

  it('rejects non-buffer input', () => {
    expect(() => bufferToBase64Url('nope')).toThrow(TypeError);
  });
});

describe('requestOptionsToJSON', () => {
  const challenge = new Uint8Array([1, 2, 3]).buffer;

  it('encodes challenge and credential ids and keeps transports', () => {
    const json = requestOptionsToJSON({
      challenge,
      timeout: 60000,
      rpId: 'login.microsoft.com',
      userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: new Uint8Array([4, 5]), transports: ['hybrid'] }],
    }, 'ignored.example');
    expect(json).toEqual({
      challenge: 'AQID',
      timeout: 60000,
      rpId: 'login.microsoft.com',
      userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: 'BAU', transports: ['hybrid'] }],
    });
  });

  it('defaults rpId to the page hostname and userVerification to preferred', () => {
    const json = requestOptionsToJSON({ challenge }, 'login.microsoftonline.com');
    expect(json.rpId).toBe('login.microsoftonline.com');
    expect(json.userVerification).toBe('preferred');
    expect(json.allowCredentials).toEqual([]);
    expect(json).not.toHaveProperty('timeout');
  });

  it('does not forward extensions', () => {
    const json = requestOptionsToJSON({ challenge, extensions: { prf: {} } }, 'a.example');
    expect(json).not.toHaveProperty('extensions');
  });
});

describe('credentialFromJSON', () => {
  const json = {
    id: 'AQID',
    rawId: 'AQID',
    type: 'public-key',
    response: { clientDataJSON: 'BAU', authenticatorData: 'BgcI', signature: 'CQoL', userHandle: 'DA0' },
  };

  it('decodes the response into ArrayBuffers', () => {
    const parsed = credentialFromJSON(json);
    expect(new Uint8Array(parsed.rawId)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(parsed.response.clientDataJSON)).toEqual(new Uint8Array([4, 5]));
    expect(new Uint8Array(parsed.response.userHandle)).toEqual(new Uint8Array([12, 13]));
    expect(parsed.authenticatorAttachment).toBe('cross-platform');
    expect(parsed.json).toBe(json);
  });

  it('maps a missing userHandle to null', () => {
    const parsed = credentialFromJSON({ ...json, response: { ...json.response, userHandle: undefined } });
    expect(parsed.response.userHandle).toBeNull();
  });
});
