const { BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { t } = require('../i18n');

const STRING_KEYS = [
  'title', 'instructions', 'hint', 'cancel',
  'status.waiting-for-scan', 'status.proximity', 'status.connecting',
  'status.authenticating', 'status.waiting-for-phone', 'status.retrying', 'status.error',
];

function collectStrings() {
  return Object.fromEntries(STRING_KEYS.map(key => [key, t(`passkey.${key}`)]));
}

// Small modal window that shows the hybrid-transport QR code. Calls `onCancel`
// when the user clicks Cancel or closes the window; `close()` (programmatic)
// does not.
function createQrDialog(parent, { onCancel }) {
  let closedByUs = false;
  const win = new BrowserWindow({
    width: 380,
    height: 600,
    useContentSize: true,
    title: t('passkey.title'),
    parent: parent || undefined,
    modal: Boolean(parent),
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16161f' : '#f5f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'qrPreload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);

  const ready = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
  win.loadFile(path.join(__dirname, 'qr.html'));
  ready.then(() => {
    if (!win.isDestroyed()) win.webContents.send('qr:init', { strings: collectStrings() });
  });

  const onCancelClick = (event) => {
    if (event.sender === win.webContents) onCancel();
  };
  ipcMain.on('qr:cancel', onCancelClick);

  win.on('closed', () => {
    ipcMain.removeListener('qr:cancel', onCancelClick);
    if (!closedByUs) onCancel();
  });

  return {
    update(event) {
      if (win.isDestroyed()) return;
      ready.then(() => {
        if (win.isDestroyed()) return;
        if (event.type === 'qr') win.webContents.send('qr:qr', { svg: event.svg });
        else win.webContents.send('qr:status', { state: event.state, message: event.message });
      });
    },
    close() {
      closedByUs = true;
      if (!win.isDestroyed()) win.close();
    },
  };
}

module.exports = { createQrDialog };
