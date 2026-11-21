const { app, session } = require('electron');
const { buildFeatureFlags } = require('./chromiumFlags');

const isWayland = !!process.env.WAYLAND_DISPLAY;
const isFlatpak = !!process.env.FLATPAK_ID;
const startInMediaCheck = process.argv.includes('--media-check');

if (isFlatpak) {
  // Flatpak: Wayland only. GPU disabled by default due to sandbox GPU driver
  // compatibility issues. Set WINDOWS_APP_ENABLE_GPU=1 to opt-in.
  if (!process.env.WINDOWS_APP_ENABLE_GPU) {
    app.disableHardwareAcceleration();
    // Software WebGL (SwiftShader) required when hardware GPU is disabled
    app.commandLine.appendSwitch('enable-unsafe-swiftshader');
  }
  // Wayland platform flags are set by the electron-wrapper script (useWaylandFlags: true)
} else {
  // Native: hardware GPU with NVIDIA-aware platform selection
  const isNvidia = (() => {
    try { return require('fs').existsSync('/proc/driver/nvidia/version'); }
    catch { return false; }
  })();

  const features = buildFeatureFlags(isWayland, isNvidia);

  app.commandLine.appendSwitch('enable-features', features);
  app.commandLine.appendSwitch('enable-blink-features', 'SharedArrayBuffer');
  app.commandLine.appendSwitch('disable-dev-shm-usage');

  if (isWayland) {
    // NVIDIA proprietary + native Wayland = EGL_BAD_MATCH GPU crashes — use XWayland
    if (isNvidia) {
      app.commandLine.appendSwitch('ozone-platform', 'x11');
    } else {
      app.commandLine.appendSwitch('ozone-platform', 'wayland');
      app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform,WebRTCPipeWireCapturer');
    }
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.whenReady().then(async () => {
  const { load } = require('./i18n');
  const { applyMenu } = require('./menus/appMenu');
  load();
  applyMenu();

  if (startInMediaCheck) {
    const config = require('./config');
    const { configurePermissionHandlers } = require('./permissions');
    const { createMediaCheckWindow } = require('./mediaCheck');
    configurePermissionHandlers(session.fromPartition(config.sessionPartition));
    createMediaCheckWindow();
  } else {
    const { createMainWindow } = require('./mainAppWindow');
    await createMainWindow();
  }
});

app.on('second-instance', () => {
  const win = startInMediaCheck
    ? require('./mediaCheck').getMediaCheckWindow()
    : require('./mainAppWindow').getMainWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

app.on('before-quit', () => {
  const { getMainWindow, getAvdWindows } = require('./mainAppWindow');
  const win = getMainWindow();
  if (win) win.forceClose = true;
  for (const avdWin of getAvdWindows()) {
    avdWin.destroy();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
