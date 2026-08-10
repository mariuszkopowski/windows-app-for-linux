const { isMediaCheckWebContents } = require('./mediaCheck');
const { shouldGrantPermission } = require('./mainAppWindow/helpers');

const configuredSessions = new WeakSet();

function configurePermissionHandlers(appSession) {
  if (configuredSessions.has(appSession)) return;
  configuredSessions.add(appSession);

  appSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl =
      details?.requestingUrl ||
      (webContents && !webContents.isDestroyed() ? webContents.getURL() : '');
    callback(shouldGrantPermission(permission, requestingUrl, {
      internalMediaCheck: isMediaCheckWebContents(webContents),
    }));
  });

  appSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return shouldGrantPermission(permission, requestingOrigin, {
      internalMediaCheck: isMediaCheckWebContents(webContents),
    });
  });
}

module.exports = { configurePermissionHandlers };
