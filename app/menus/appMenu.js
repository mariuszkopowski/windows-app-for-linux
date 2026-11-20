const { Menu, BrowserWindow, app } = require('electron');
const { t } = require('../i18n');
const { createSettingsWindow } = require('../settings');

function applyMenu() {
  const template = [
    {
      label: t('menu.file'),
      submenu: [
        {
          label: t('menu.settings'),
          accelerator: 'CmdOrCtrl+,',
          click: () => createSettingsWindow(BrowserWindow.getFocusedWindow()),
        },
        { type: 'separator' },
        {
          label: t('menu.quit'),
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: t('menu.view'),
      submenu: [
        {
          label: t('menu.reload'),
          accelerator: 'CmdOrCtrl+R',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.reload(),
        },
        { type: 'separator' },
        {
          label: t('menu.fullScreen'),
          accelerator: 'F11',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.setFullScreen(!win.isFullScreen());
          },
        },
        { type: 'separator' },
        {
          label: t('menu.zoomIn'),
          accelerator: 'CmdOrCtrl+=',
          click: () => adjustZoom(+0.5),
        },
        {
          label: t('menu.zoomOut'),
          accelerator: 'CmdOrCtrl+-',
          click: () => adjustZoom(-0.5),
        },
        {
          label: t('menu.resetZoom'),
          accelerator: 'CmdOrCtrl+0',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.setZoomLevel(0),
        },
        { type: 'separator' },
        {
          label: t('menu.devTools'),
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: t('menu.navigation'),
      submenu: [
        {
          label: t('menu.back'),
          accelerator: 'Alt+Left',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win?.webContents.navigationHistory.canGoBack()) {
              win.webContents.navigationHistory.goBack();
            }
          },
        },
        {
          label: t('menu.forward'),
          accelerator: 'Alt+Right',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win?.webContents.navigationHistory.canGoForward()) {
              win.webContents.navigationHistory.goForward();
            }
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function adjustZoom(delta) {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  const next = win.webContents.getZoomLevel() + delta;
  win.webContents.setZoomLevel(Math.max(-3, Math.min(3, next)));
}

module.exports = { applyMenu };
