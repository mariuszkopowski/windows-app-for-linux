const { BrowserWindow } = require('electron');
const path = require('path');
const config = require('../config');
const { t } = require('../i18n');

let mediaCheckWindow = null;

function createMediaCheckWindow(parent) {
  if (mediaCheckWindow && !mediaCheckWindow.isDestroyed()) {
    mediaCheckWindow.show();
    mediaCheckWindow.focus();
    return mediaCheckWindow;
  }

  mediaCheckWindow = new BrowserWindow({
    width: 920,
    height: 760,
    minWidth: 700,
    minHeight: 620,
    title: t('mediaCheck.title'),
    parent: parent || undefined,
    backgroundColor: '#10141c',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      partition: config.sessionPartition,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mediaCheckWindow.setMenuBarVisibility(false);
  mediaCheckWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mediaCheckWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  mediaCheckWindow.once('ready-to-show', () => {
    if (mediaCheckWindow && !mediaCheckWindow.isDestroyed()) {
      mediaCheckWindow.show();
    }
  });

  mediaCheckWindow.on('closed', () => {
    mediaCheckWindow = null;
  });

  mediaCheckWindow.loadFile(path.join(__dirname, 'media-check.html'));
  return mediaCheckWindow;
}

function isMediaCheckWebContents(webContents) {
  return Boolean(
    mediaCheckWindow &&
    !mediaCheckWindow.isDestroyed() &&
    mediaCheckWindow.webContents === webContents
  );
}

function getMediaCheckWindow() {
  return mediaCheckWindow;
}

module.exports = {
  createMediaCheckWindow,
  getMediaCheckWindow,
  isMediaCheckWebContents,
};
