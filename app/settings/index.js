const { BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { loadConfig, saveConfig } = require('../config');
const { t } = require('../i18n');

const STRING_KEYS = [
  'settings.title',
  'settings.cloudEnvironment',
  'settings.cloudEnvironmentDescription',
  'settings.environment.commercial',
  'settings.environment.gcchigh',
  'settings.environment.dod',
  'settings.environment.custom',
  'settings.connectionUrl',
  'settings.connectionUrlDescription',
  'settings.windowSize',
  'settings.width',
  'settings.height',
  'settings.userAgent',
  'settings.userAgentDescription',
  'settings.dataManagement',
  'settings.clearSession',
  'settings.clearSessionDescription',
  'settings.clearSessionConfirm',
  'settings.clearSessionDone',
  'settings.restartNotice',
  'settings.save',
  'settings.cancel',
];

function collectStrings() {
  return Object.fromEntries(STRING_KEYS.map(key => [key, t(key)]));
}

let settingsWindow = null;
let handlersRegistered = false;

function registerHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle('settings:get', () => {
    const config = loadConfig();
    return {
      cloudEnvironment: config.cloudEnvironment || 'commercial',
      url: config.url,
      userAgent: config.userAgent,
      cloudEnvironments: config.cloudEnvironments,
      window: config.window,
      strings: collectStrings(),
    };
  });

  ipcMain.handle('settings:save', (_event, updates) => {
    saveConfig(updates);
  });

  ipcMain.handle('settings:clear-session', async () => {
    const { clearSession, getMainWindow } = require('../mainAppWindow');
    await clearSession();
    const config = loadConfig();
    getMainWindow()?.loadURL(config.url, { userAgent: config.userAgent });
  });
}

function createSettingsWindow(parent) {
  registerHandlers();

  if (settingsWindow) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 660,
    title: t('settings.title'),
    icon: nativeImage.createFromPath(path.join(__dirname, '../../assets/icons/512x512.png')),
    parent,
    backgroundColor: '#f5f5f7',
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

module.exports = { createSettingsWindow };
