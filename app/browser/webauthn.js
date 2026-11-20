// Runs in the renderer (contextIsolation: false). Electron ships no WebAuthn
// authenticator UI, so navigator.credentials.get() hangs forever. This shim
// routes passkey sign-ins to the main process, which runs the phone (hybrid /
// QR) flow through a native helper. See app/webauthn/.

const { ipcRenderer } = require('electron');
const { requestOptionsToJSON, credentialFromJSON } = require('../webauthn/codec');

function define(target, props) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(target, key, { value, enumerable: true, configurable: true });
  }
}

// Builds an object that passes `instanceof PublicKeyCredential` checks. Own
// properties shadow the prototype getters, which would throw on a non-native
// instance.
function buildCredential(parsed) {
  const response = Object.create(AuthenticatorAssertionResponse.prototype);
  define(response, parsed.response);
  const credential = Object.create(PublicKeyCredential.prototype);
  define(credential, {
    id: parsed.id,
    rawId: parsed.rawId,
    type: 'public-key',
    authenticatorAttachment: parsed.authenticatorAttachment,
    response,
    getClientExtensionResults: () => ({}),
    toJSON: () => parsed.json,
  });
  return credential;
}

function abortReason(signal) {
  return signal.reason !== undefined ? signal.reason : new DOMException('The operation was aborted.', 'AbortError');
}

function installWebauthnShim() {
  try {
    const credentials = navigator.credentials;
    if (!credentials || typeof PublicKeyCredential === 'undefined') return;
    const nativeGet = credentials.get.bind(credentials);
    let counter = 0;

    credentials.get = async function get(options) {
      const publicKey = options && options.publicKey;
      // Conditional UI (autofill) has no equivalent in the phone flow.
      if (!publicKey || options.mediation === 'conditional') return nativeGet(options);
      if (!(await ipcRenderer.invoke('webauthn:available'))) return nativeGet(options);

      const { signal } = options;
      if (signal && signal.aborted) throw abortReason(signal);

      const id = `${Date.now()}-${++counter}`;
      const onAbort = () => ipcRenderer.send('webauthn:cancel', id);
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      try {
        const result = await ipcRenderer.invoke('webauthn:get', {
          id,
          publicKey: requestOptionsToJSON(publicKey, location.hostname),
        });
        if (result.error) throw new DOMException(result.error.message, result.error.name);
        return buildCredential(credentialFromJSON(result.credential));
      } finally {
        if (signal) signal.removeEventListener('abort', onAbort);
      }
    };
  } catch { /* non-fatal: falls back to Chromium's (non-functional) default */ }
}

module.exports = { installWebauthnShim };
