// WebAuthn <-> JSON conversion shared by the preload shim and the main process.
// Pure functions (no Electron/DOM globals beyond atob/btoa) so they are unit-testable.

function toBytes(source) {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
  throw new TypeError('Expected a BufferSource');
}

function bufferToBase64Url(source) {
  const bytes = toBytes(source);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// PublicKeyCredentialRequestOptions -> PublicKeyCredentialRequestOptionsJSON.
// Extensions are intentionally not forwarded: the phone path only supports
// plain assertions.
function requestOptionsToJSON(publicKey, defaultRpId) {
  const json = {
    challenge: bufferToBase64Url(publicKey.challenge),
    rpId: publicKey.rpId || defaultRpId,
    userVerification: publicKey.userVerification || 'preferred',
    allowCredentials: (publicKey.allowCredentials || []).map(cred => ({
      type: cred.type,
      id: bufferToBase64Url(cred.id),
      ...(cred.transports && { transports: cred.transports }),
    })),
  };
  if (typeof publicKey.timeout === 'number') json.timeout = publicKey.timeout;
  return json;
}

// AuthenticationResponseJSON -> fields needed to build a PublicKeyCredential.
function credentialFromJSON(json) {
  const { response } = json;
  return {
    id: json.id,
    rawId: base64UrlToBuffer(json.rawId || json.id),
    authenticatorAttachment: json.authenticatorAttachment || 'cross-platform',
    response: {
      clientDataJSON: base64UrlToBuffer(response.clientDataJSON),
      authenticatorData: base64UrlToBuffer(response.authenticatorData),
      signature: base64UrlToBuffer(response.signature),
      userHandle: response.userHandle ? base64UrlToBuffer(response.userHandle) : null,
    },
    json,
  };
}

module.exports = { bufferToBase64Url, base64UrlToBuffer, requestOptionsToJSON, credentialFromJSON };
