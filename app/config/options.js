const CLOUD_ENVIRONMENTS = {
  commercial: 'https://windows.cloud.microsoft/#/devices',
  gcchigh: 'https://rdweb.wvd.azure.us/arm/webclient/index.html',
  dod: 'https://rdweb.wvd.microsoft.us/arm/webclient/index.html',
};

module.exports = {
  url: CLOUD_ENVIRONMENTS.commercial,
  cloudEnvironments: CLOUD_ENVIRONMENTS,
  // Spoof as Edge on Windows — required for full AVD feature compatibility
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  // Passkey sign-in with a phone (hybrid/QR) via the native helper; set false in config.json to disable
  phonePasskey: true,
  // Persistent partition — session survives restarts; clear via "Quit and clear session" in tray
  sessionPartition: 'persist:windows-app',
  window: {
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
  },
};
