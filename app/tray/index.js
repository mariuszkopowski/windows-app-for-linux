const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const { t } = require('../i18n');

let tray = null;
let _getMainWindow = null;
let _getAvdWindows = null;

function createTray(getMainWindow, getAvdWindows) {
  _getMainWindow = getMainWindow;
  _getAvdWindows = getAvdWindows;

  const iconPath = path.join(__dirname, '../../assets/icons/22x22.png');
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);
  tray.setToolTip('Windows App');

  tray.on('click', () => {
    const win = _getMainWindow();
    if (!win) return;
    win.isVisible() ? win.focus() : win.show();
  });

  rebuildMenu();
  return tray;
}

function rebuildMenu() {
  if (!tray) return;

  const mainWindow = _getMainWindow?.();
  const avdWindows = _getAvdWindows?.() ?? [];

  const template = [
    {
      label: t('tray.showPortal'),
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: t('tray.settings'),
      click: () => {
        const { createSettingsWindow } = require('../settings');
        createSettingsWindow(mainWindow);
      },
    },
    {
      label: t('tray.mediaCheck'),
      click: () => {
        const { createMediaCheckWindow } = require('../mediaCheck');
        createMediaCheckWindow(mainWindow);
      },
    },
  ];

  if (avdWindows.length > 0) {
    template.push({ type: 'separator' });
    template.push({ label: t('tray.openSessions'), enabled: false });

    for (const win of avdWindows) {
      const title = win.getTitle() || t('tray.avdSession');
      template.push({
        label: `  ${title}`,
        click: () => {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        },
      });
    }
  }

  template.push({ type: 'separator' });
  template.push({
    label: t('tray.quit'),
    click: () => app.quit(),
  });
  template.push({
    label: t('tray.quitAndClear'),
    click: async () => {
      const { clearSession } = require('../mainAppWindow');
      await clearSession();
      app.quit();
    },
  });

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = { createTray, destroyTray, rebuildMenu };
