const { BrowserWindow, ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { runPhoneAssertionWithRetry, PasskeyError } = require('./phoneBackend');
const { createQrDialog } = require('./qrDialog');

const HELPER_NAME = 'phone-passkey-helper';

// Order: explicit override, packaged resources, local dev build.
function resolveHelperPath() {
  const candidates = [
    process.env.PHONE_PASSKEY_HELPER,
    app.isPackaged && path.join(process.resourcesPath, HELPER_NAME),
    path.join(__dirname, '../../helper/phone-passkey/target/release', HELPER_NAME),
  ].filter(Boolean);
  return candidates.find((p) => {
    try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
  });
}

let activeAbort = null;
const requests = new Map();
let registered = false;

function registerWebauthnHandlers() {
  if (registered) return;
  registered = true;

  ipcMain.handle('webauthn:available', () => config.phonePasskey !== false && Boolean(resolveHelperPath()));

  ipcMain.on('webauthn:cancel', (_event, id) => {
    const controller = requests.get(id);
    if (controller) controller.abort('page');
  });

  ipcMain.handle('webauthn:get', async (event, { id, publicKey }) => {
    const frame = event.senderFrame;
    const origin = frame && frame.origin;
    const topOrigin = frame && frame.top ? frame.top.origin : null;
    if (!origin || !origin.startsWith('https://')) {
      return { error: { name: 'SecurityError', message: 'Passkeys require a secure origin.' } };
    }
    const helperPath = resolveHelperPath();
    if (!helperPath) {
      return { error: { name: 'NotAllowedError', message: 'Phone passkey helper is not installed.' } };
    }

    // One passkey prompt at a time: a new request supersedes the old one.
    if (activeAbort) activeAbort.abort('page');
    const controller = new AbortController();
    activeAbort = controller;
    requests.set(id, controller);

    const dialog = createQrDialog(BrowserWindow.fromWebContents(event.sender), {
      onCancel: () => controller.abort('user'),
    });
    try {
      const credential = await runPhoneAssertionWithRetry({
        helperPath,
        origin,
        topOrigin,
        publicKey,
        signal: controller.signal,
        onEvent: (e) => dialog.update(e),
        onRetry: () => dialog.update({ type: 'status', state: 'retrying' }),
      });
      return { credential };
    } catch (err) {
      const e = err instanceof PasskeyError ? err : new PasskeyError('helper-failed', String(err));
      console.warn(`[webauthn] phone passkey failed: ${e.code}: ${e.message}`);
      return { error: { name: e.domName, message: e.message } };
    } finally {
      dialog.close();
      requests.delete(id);
      if (activeAbort === controller) activeAbort = null;
    }
  });
}

module.exports = { registerWebauthnHandlers, resolveHelperPath };
