const { app, BrowserWindow, session, shell, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Set userData path to a persistent location
// In snaps, use SNAP_USER_DATA if available, otherwise use standard XDG config directory
if (process.env.SNAP_USER_DATA) {
  // Running in a snap - use snap's persistent user data directory
  app.setPath('userData', process.env.SNAP_USER_DATA);
  // Will be logged after logger is initialized
} else {
  // Not in a snap - use standard config directory
  const userDataPath = path.join(os.homedir(), '.config', 'windows-app-for-linux');
  app.setPath('userData', userDataPath);
  // Will be logged after logger is initialized
}

// Default User-Agent string
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';

// Default connection address
const DEFAULT_CONNECTION_URL = 'https://windows.cloud.microsoft/#/devices';

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
  DEBUG: 3
};

// Application configuration
let appConfig = {
  logLevel: LOG_LEVELS.INFO, // Default to INFO level
  connectionUrl: DEFAULT_CONNECTION_URL,
  userAgent: DEFAULT_USER_AGENT,
  windowWidth: 1024,
  windowHeight: 768
};

// Load configuration from file
function loadConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const loaded = JSON.parse(configData);
      appConfig = { ...appConfig, ...loaded };
      log(LOG_LEVELS.INFO, 'Configuration loaded from', configPath);
    }
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Error loading configuration:', err.message);
  }
}

// Save configuration to file
function saveConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf8');
    log(LOG_LEVELS.INFO, 'Configuration saved to', configPath);
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Error saving configuration:', err.message);
  }
}

// Logging function with levels
function log(level, ...args) {
  const levelNames = ['ERROR', 'WARNING', 'INFO', 'DEBUG'];
  const levelName = levelNames[level] || 'UNKNOWN';
  
  // Only log if level is at or below current log level
  if (level <= appConfig.logLevel) {
    const timestamp = new Date().toISOString();
    // Format: [TIMESTAMP] [LEVEL] message
    const message = `[${timestamp}] [${levelName}] ${args.join(' ')}`;
    
    // Output directly to console to avoid circular calls
    if (level === LOG_LEVELS.ERROR) {
      console.error(message);
    } else if (level === LOG_LEVELS.WARNING) {
      console.warn(message);
    } else {
      console.log(message);
    }
  }
}

// Convenience logging functions - all logs will have [LEVEL] prefix
const logger = {
  error: (...args) => log(LOG_LEVELS.ERROR, ...args),
  warning: (...args) => log(LOG_LEVELS.WARNING, ...args),
  info: (...args) => log(LOG_LEVELS.INFO, ...args),
  debug: (...args) => log(LOG_LEVELS.DEBUG, ...args)
};

// Add command line switches to make Electron behave more like Edge browser
// These are flags that Edge/Chrome use by default
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
// Enable features that browsers have by default - critical for RDP
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,SharedArrayBuffer,CrossOriginOpenerPolicy,CrossOriginEmbedderPolicy');
// Enable shared memory (needed for RDP/remote desktop) - this is critical!
app.commandLine.appendSwitch('enable-blink-features', 'SharedArrayBuffer');
// Allow WebRTC and related features
app.commandLine.appendSwitch('enable-webrtc');
// Don't disable features that browsers use
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-gpu-rasterization');
// Enable WebAssembly (RDP client uses this)
app.commandLine.appendSwitch('enable-webassembly');
// Use /tmp instead of /dev/shm for shared memory (avoids permission issues)
app.commandLine.appendSwitch('disable-dev-shm-usage');
// Note: We're NOT using --no-sandbox as it causes shared memory issues
// Instead, we'll rely on the sandbox: false in webPreferences for new windows

// Load configuration early (before logger is used)
loadConfig();

// Log userData path after config is loaded
if (process.env.SNAP_USER_DATA) {
  logger.info('Using snap userData path:', process.env.SNAP_USER_DATA);
} else {
  logger.info('Using standard userData path:', app.getPath('userData'));
}

// Global error handling for the main process
process.on('uncaughtException', (error) => {
  logger.error('Unhandled exception in main process:', error);
  // Don't crash the app, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection in main process:', reason);
  // Don't crash the app, just log the error
});

let mainWindow;
const windows = new Set(); // Track all windows for menu updates

// About dialog
function showAboutDialog() {
  const aboutWindow = new BrowserWindow({
    width: 400,
    height: 300,
    parent: mainWindow,
    modal: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>About</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 30px;
      margin: 0;
      background: #f5f5f5;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #333;
      font-size: 24px;
    }
    .version {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .description {
      color: #555;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 30px;
      max-width: 350px;
    }
    button {
      background: #0078d4;
      color: white;
      border: none;
      padding: 10px 30px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background: #106ebe;
    }
  </style>
</head>
<body>
  <h1>Windows App for Linux</h1>
  <div class="version">Version 1.0.0</div>
  <div class="description">
    A standalone Electron application for Windows Cloud Devices web interface.
  </div>
  <button onclick="window.close()">Close</button>
</body>
</html>
  `;

  aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

// Settings dialog
function showSettingsDialog() {
  const settingsWindow = new BrowserWindow({
    width: 700,
    height: 650,
    parent: mainWindow,
    modal: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Settings</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 20px;
      margin: 0;
      background: #f5f5f5;
    }
    h2 {
      margin-top: 0;
      color: #333;
    }
    .setting-group {
      background: white;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 5px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #555;
    }
    input[type="text"], input[type="url"] {
      width: 100%;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-size: 14px;
      box-sizing: border-box;
      font-family: monospace;
    }
    input#userAgent {
      font-size: 12px;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      color: #856404;
      padding: 10px;
      border-radius: 3px;
      margin-top: 10px;
      font-size: 12px;
    }
    button {
      background: #0078d4;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 10px;
    }
    button:hover {
      background: #106ebe;
    }
    button.danger {
      background: #d13438;
    }
    button.danger:hover {
      background: #a4262c;
    }
    .button-group {
      margin-top: 20px;
      text-align: right;
    }
    .description {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <h2>Settings</h2>
  
  <div class="setting-group">
    <label for="connectionUrl">Default Connection Address:</label>
    <input type="url" id="connectionUrl" value="${appConfig.connectionUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" placeholder="https://windows.cloud.microsoft/#/devices">
    <div class="description">The URL to load when the application starts.</div>
    <div class="warning">
      <strong>Warning:</strong> Changing this address may cause the application to not work correctly. Only modify if you know what you're doing.
    </div>
  </div>
  
  <div class="setting-group">
    <label for="userAgent">User-Agent String:</label>
    <input type="text" id="userAgent" value="${appConfig.userAgent.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...">
    <div class="description">The User-Agent string sent with HTTP requests. Changing this may affect how websites identify your browser.</div>
    <div class="warning">
      <strong>Warning:</strong> Changing the User-Agent may cause websites to behave differently or not work correctly. Only modify if you know what you're doing.
    </div>
  </div>
  
  <div class="setting-group">
    <label>Default Window Size:</label>
    <div style="display: flex; gap: 10px; align-items: center;">
      <div style="flex: 1;">
        <label for="windowWidth" style="font-size: 12px; margin-bottom: 3px;">Width:</label>
        <input type="number" id="windowWidth" value="${appConfig.windowWidth}" min="400" max="3840" style="width: 100%;">
      </div>
      <div style="flex: 1;">
        <label for="windowHeight" style="font-size: 12px; margin-bottom: 3px;">Height:</label>
        <input type="number" id="windowHeight" value="${appConfig.windowHeight}" min="300" max="2160" style="width: 100%;">
      </div>
    </div>
    <div class="description">The default size of the main window when the application starts. Changes will apply to new windows.</div>
  </div>
  
  <div class="setting-group">
    <label>Data Management:</label>
    <button class="danger" onclick="clearCache()">Clear Cookies and Cache</button>
    <div class="description">This will clear all stored cookies, cache, and local storage. You will need to log in again.</div>
  </div>
  
  <div class="button-group">
    <button onclick="saveSettings()">Save</button>
    <button onclick="cancelSettings()">Cancel</button>
  </div>
  
  <script>
    const { ipcRenderer } = require('electron');
    
    function saveSettings() {
      const connectionUrl = document.getElementById('connectionUrl').value;
      const userAgent = document.getElementById('userAgent').value;
      const windowWidth = parseInt(document.getElementById('windowWidth').value);
      const windowHeight = parseInt(document.getElementById('windowHeight').value);
      const settings = {};
      if (connectionUrl && connectionUrl.trim()) {
        settings.connectionUrl = connectionUrl.trim();
      }
      if (userAgent && userAgent.trim()) {
        settings.userAgent = userAgent.trim();
      }
      if (windowWidth && windowWidth >= 400 && windowWidth <= 3840) {
        settings.windowWidth = windowWidth;
      }
      if (windowHeight && windowHeight >= 300 && windowHeight <= 2160) {
        settings.windowHeight = windowHeight;
      }
      if (Object.keys(settings).length > 0) {
        ipcRenderer.send('save-settings', settings);
      }
      window.close();
    }
    
    function cancelSettings() {
      window.close();
    }
    
    async function clearCache() {
      if (confirm('Are you sure you want to clear all cookies and cache? You will need to log in again.')) {
        ipcRenderer.send('clear-cache');
        alert('Cookies and cache cleared. The application will reload.');
        window.close();
      }
    }
  </script>
</body>
</html>
  `;

  settingsWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  
  // Handle IPC messages from settings window
  const saveHandler = (event, settings) => {
    if (settings.connectionUrl) {
      appConfig.connectionUrl = settings.connectionUrl;
    }
    if (settings.userAgent) {
      appConfig.userAgent = settings.userAgent;
      // Update User-Agent for the session
      session.defaultSession.setUserAgent(appConfig.userAgent);
      logger.info('User-Agent updated to:', appConfig.userAgent);
    }
    if (settings.windowWidth) {
      appConfig.windowWidth = settings.windowWidth;
      logger.info('Default window width updated to:', appConfig.windowWidth);
    }
    if (settings.windowHeight) {
      appConfig.windowHeight = settings.windowHeight;
      logger.info('Default window height updated to:', appConfig.windowHeight);
    }
    saveConfig();
    logger.info('Settings saved:', settings);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (settings.connectionUrl) {
        mainWindow.loadURL(appConfig.connectionUrl);
      } else if (settings.userAgent) {
        // If only User-Agent changed, reload the current page
        mainWindow.reload();
      }
      // Note: Window size changes will apply to new windows, not the current one
    }
  };
  
  const clearCacheHandler = async () => {
    try {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearStorageData();
      const cookies = await session.defaultSession.cookies.get({});
      for (const cookie of cookies) {
        await session.defaultSession.cookies.remove(cookie.url || `http${cookie.secure ? 's' : ''}://${cookie.domain}`, cookie.name);
      }
      logger.info('Cache and cookies cleared');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.reload();
      }
    } catch (err) {
      logger.error('Error clearing cache:', err);
      dialog.showErrorBox('Error', 'Failed to clear cache: ' + err.message);
    }
  };
  
  ipcMain.once('save-settings', saveHandler);
  ipcMain.once('clear-cache', clearCacheHandler);
  
  settingsWindow.on('closed', () => {
    ipcMain.removeListener('save-settings', saveHandler);
    ipcMain.removeListener('clear-cache', clearCacheHandler);
  });
}

// Function to create application menu with DevTools toggle
function createMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // File menu
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            showSettingsDialog();
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              if (focusedWindow.webContents.isDevToolsOpened()) {
                focusedWindow.webContents.closeDevTools();
              } else {
                focusedWindow.webContents.openDevTools();
              }
            }
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: (item, focusedWindow) => {
            if (focusedWindow) {
              focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
            }
          }
        }
      ]
    },
    // Window menu (macOS)
    ...(isMac ? [{
      label: 'Window',
      submenu: [
        { role: 'close' },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }] : []),
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Windows App for Linux',
          click: () => {
            showAboutDialog();
          }
        },
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://windows.cloud.microsoft/');
          }
        },
        { type: 'separator' },
        {
          label: 'Log Level: Full Logging',
          type: 'checkbox',
          checked: appConfig.logLevel >= LOG_LEVELS.DEBUG,
          click: (item) => {
            if (item.checked) {
              appConfig.logLevel = LOG_LEVELS.DEBUG;
              logger.info('Log level set to: DEBUG (Full Logging)');
            } else {
              appConfig.logLevel = LOG_LEVELS.ERROR;
              logger.error('Log level set to: ERROR (Errors Only)');
            }
            saveConfig();
            createMenu(); // Refresh menu to update checkbox
          }
        },
        {
          label: 'Log Level: Errors Only',
          type: 'checkbox',
          checked: appConfig.logLevel === LOG_LEVELS.ERROR,
          click: (item) => {
            if (item.checked) {
              appConfig.logLevel = LOG_LEVELS.ERROR;
              logger.error('Log level set to: ERROR (Errors Only)');
            } else {
              appConfig.logLevel = LOG_LEVELS.DEBUG;
              logger.info('Log level set to: DEBUG (Full Logging)');
            }
            saveConfig();
            createMenu(); // Refresh menu to update checkbox
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow(isFullscreen = false) {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: appConfig.windowWidth,
    height: appConfig.windowHeight,
    fullscreen: isFullscreen,
    fullscreenable: true, // Allow fullscreen
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      // Enable permissions for camera, microphone, etc.
      permissions: ['camera', 'microphone', 'notifications']
    },
    show: false // Don't show until ready
  });

  // Set User-Agent and browser-like headers before loading
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = appConfig.userAgent;
    // Add headers that browsers send by default
    if (!details.requestHeaders['Accept']) {
      details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8';
    }
    if (!details.requestHeaders['Accept-Language']) {
      details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
    }
    if (!details.requestHeaders['Accept-Encoding']) {
      details.requestHeaders['Accept-Encoding'] = 'gzip, deflate, br';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  // Note: Permission handlers are now set up in app.whenReady() BEFORE createWindow()
  // This ensures they're active for all windows from the start

  // Set up window open handler for new windows (remote desktop, etc.)
  mainWindow.webContents.setWindowOpenHandler(({ url, frameName, features }) => {
    logger.debug('=== NEW WINDOW REQUEST ===');
    logger.debug('URL:', url);
    logger.debug('Frame Name:', frameName);
    logger.debug('Features:', features);
    logger.debug('========================');
    
    // Create a new window for the remote desktop or other pages
    // Use the same session as the main window to share cookies/auth
    // This is critical for authentication to work across windows
    const newWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      fullscreen: false, // New windows open in windowed mode (can toggle with F11)
      fullscreenable: true, // Allow fullscreen
      backgroundColor: '#1e1e1e', // Dark background to avoid white flash
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        permissions: ['camera', 'microphone', 'notifications'],
        // Use the same session as the main window - this shares cookies/auth!
        session: session.defaultSession,
        // DevTools disabled by default - can be toggled via menu (Ctrl+Shift+I)
        devTools: false,
        // Additional stability options
        backgroundThrottling: false,
        offscreen: false,
        // Enable browser-like features needed for RDP
        enableWebSQL: false,
        // Enable features that browsers have by default
        enableBlinkFeatures: 'SharedArrayBuffer',
        // Disable sandbox for better compatibility with RDP client
        sandbox: false,
        // Additional options that might help
        v8CacheOptions: 'code'
      },
      show: false
    });

    logger.debug('New window created, ID:', newWindow.id);

    // Set User-Agent on webContents as well
    newWindow.webContents.setUserAgent(appConfig.userAgent);
    logger.debug('User-Agent set on new window:', appConfig.userAgent);
    
    // Note: Permission handlers are already set up globally on session.defaultSession
    // Since this window uses the same session, it will automatically use those handlers
    
    // Ensure cookies are shared - verify session is the same
    const newSession = newWindow.webContents.session;
    logger.debug('New window session ID:', newSession.id);
    logger.debug('Default session ID:', session.defaultSession.id);
    logger.debug('Sessions match:', newSession === session.defaultSession);
    
    // Ensure cookies are enabled and shared
    newSession.cookies.get({}).then(cookies => {
      logger.debug('Cookies in new window session:', cookies.length);
    }).catch(err => {
      logger.error('Error getting cookies:', err);
    });

    // Track all navigation events
    newWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      logger.debug('[New Window] Will navigate to:', navigationUrl);
    });

    newWindow.webContents.on('did-navigate', (event, navigationUrl) => {
      logger.debug('[New Window] Did navigate to:', navigationUrl);
    });

    newWindow.webContents.on('did-navigate-in-page', (event, navigationUrl) => {
      logger.debug('[New Window] Did navigate in page to:', navigationUrl);
    });

    // Handle navigation errors
    newWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      logger.error('=== NEW WINDOW LOAD FAILED ===');
      logger.error('URL:', validatedURL);
      logger.error('Error Code:', errorCode);
      logger.error('Description:', errorDescription);
      logger.error('Is Main Frame:', isMainFrame);
      logger.error('============================');
      
      // If it's a main frame failure, try to reload after a delay
      if (isMainFrame && errorCode !== -3) { // -3 is ERR_ABORTED, don't reload on that
        logger.debug('[New Window] Attempting to reload after load failure...');
        setTimeout(() => {
          if (!newWindow.isDestroyed()) {
            newWindow.reload();
          }
        }, 2000);
      }
    });

    // Handle console messages for debugging
    newWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      logger.debug(`[New Window Console ${level}]:`, message, `(${sourceId}:${line})`);
    });

    // Debug: Log when page starts loading
    newWindow.webContents.on('did-start-loading', () => {
      logger.debug('[New Window] Started loading:', newWindow.webContents.getURL());
    });

    // Debug: Log when page finishes loading
    newWindow.webContents.on('did-finish-load', () => {
      const url = newWindow.webContents.getURL();
      logger.debug('[New Window] Finished loading:', url);
      
      // Check if page is blank (no content loaded)
      setTimeout(() => {
        if (!newWindow.isDestroyed()) {
          newWindow.webContents.executeJavaScript(`
            (function() {
              const body = document.body;
              if (body && body.innerHTML.trim() === '') {
                logger.warning('[New Window] Page appears to be blank - no content detected');
                return true;
              }
              return false;
            })();
          `).then(isBlank => {
            if (isBlank) {
              logger.warning('[New Window] Blank page detected - attempting reload...');
              setTimeout(() => {
                if (!newWindow.isDestroyed()) {
                  newWindow.reload();
                }
              }, 1000);
            }
          }).catch(() => {});
        }
      }, 2000);
    });

    // Debug: Log DOM ready
    newWindow.webContents.on('dom-ready', () => {
      logger.debug('[New Window] DOM ready:', newWindow.webContents.getURL());
    });

    // Debug: Log when page title changes
    newWindow.webContents.on('page-title-updated', (event, title) => {
      logger.debug('[New Window] Title updated:', title);
    });

    // Monitor network requests
    newWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') {
        logger.debug('[New Window] Request:', details.method, details.url);
      }
      callback({});
    });

    // Copy authentication cookies from main window before loading
    // This ensures the new window has the same auth state
    session.defaultSession.cookies.get({ domain: '.microsoft.com' }).then(cookies => {
      logger.debug(`Copying ${cookies.length} cookies from main session to new window`);
      // Cookies are already shared via same session, but this ensures they're available
      return Promise.resolve();
    }).catch(err => {
      logger.error('Error getting cookies:', err);
    });

    // Load the URL in the new window
    logger.debug('Loading URL in new window:', url);
    newWindow.loadURL(url).catch(err => {
      logger.error('=== ERROR LOADING URL ===');
      logger.error('URL:', url);
      logger.error('Error:', err);
      logger.error('========================');
    });

    // Handle window close - allow closing but clean up first
    let isClosing = false;
    let forceCloseTimeout = null;
    
    newWindow.on('close', (event) => {
      try {
        if (isClosing) {
          // Already closing, allow it
          return;
        }
        
        logger.debug('[New Window] Close event triggered');
        isClosing = true;
        
        // Clean up DevTools if open
        try {
          if (newWindow.webContents && !newWindow.webContents.isDestroyed()) {
            if (newWindow.webContents.isDevToolsOpened()) {
              newWindow.webContents.closeDevTools();
            }
          }
        } catch (err) {
          logger.error('[New Window] Error closing DevTools:', err);
        }
        
        // If the window doesn't close within 2 seconds, force close it
        // This handles cases where the page prevents closing
        forceCloseTimeout = setTimeout(() => {
          if (!newWindow.isDestroyed()) {
            logger.debug('[New Window] Force closing window (timeout - page prevented close)');
            newWindow.destroy();
          }
        }, 2000); // 2 second timeout
        
        // Don't prevent close - allow the window to close normally
        // If the page prevents it, the timeout will force close
      } catch (err) {
        logger.error('[New Window] Error in close handler:', err);
        // On error, force close
        if (!newWindow.isDestroyed()) {
          newWindow.destroy();
        }
      }
    });

    // Handle window closed
    newWindow.on('closed', () => {
      try {
        // Clear the force-close timeout if window closed normally
        if (forceCloseTimeout) {
          clearTimeout(forceCloseTimeout);
          forceCloseTimeout = null;
        }
        windows.delete(newWindow);
        logger.debug('[New Window] Closed');
      } catch (err) {
        logger.error('[New Window] Error in closed handler:', err);
      }
    });

    windows.add(newWindow);

    // Handle JavaScript errors
    newWindow.webContents.on('uncaught-exception', (event, error) => {
      logger.error('[New Window] Uncaught exception:', error);
      // Prevent the error from crashing the app
      event.preventDefault();
    });
    
    // Handle unhandled promise rejections in renderer
    newWindow.webContents.on('unresponsive', () => {
      logger.warning('[New Window] Window became unresponsive');
      // If window is unresponsive for more than 5 seconds, offer to force close
      setTimeout(() => {
        if (!newWindow.isDestroyed() && newWindow.webContents.isLoading()) {
          logger.warning('[New Window] Window still unresponsive, user can force close with Ctrl+W or Ctrl+Q');
        }
      }, 5000);
    });
    
    newWindow.webContents.on('responsive', () => {
      logger.debug('[New Window] Window became responsive again');
    });

    // Handle renderer process crashes
    let crashCount = 0;
    const MAX_CRASHES = 1; // Only reload once - if it crashes again, it's likely the same issue
    
    newWindow.webContents.on('render-process-gone', (event, details) => {
      logger.error('=== RENDER PROCESS CRASHED ===');
      logger.error('Reason:', details.reason);
      logger.error('Exit Code:', details.exitCode);
      logger.error('Crash Count:', crashCount + 1);
      logger.error('Details:', JSON.stringify(details, null, 2));
      logger.error('URL at crash:', newWindow.webContents.getURL());
      logger.error('=============================');
      
      crashCount++;
      
      // Only try to reload once - if it crashes again, it's likely a persistent issue
      if (details.reason === 'crashed' && crashCount < MAX_CRASHES) {
        logger.debug(`Attempting to reload crashed page (attempt ${crashCount}/${MAX_CRASHES})...`);
        // Wait a bit longer before reload to let things settle
        setTimeout(() => {
          newWindow.reload();
        }, 3000);
      } else {
        logger.error('Render process crashed. Attempting to recover...');
        logger.error('The window will remain open. Trying to reload with different settings...');
        
        // Don't close - try to keep the window and see if we can recover
        // The crash might be recoverable if we wait longer
        logger.debug('Window will stay open. If you see a blank screen, the RDP client crashed.');
      }
    });

    // Inject code VERY EARLY - as soon as navigation starts
    newWindow.webContents.on('did-start-loading', () => {
      // Inject fixes immediately when page starts loading
      newWindow.webContents.executeJavaScript(`
        (function() {
          // Fix dragEvent error IMMEDIATELY - before any scripts run
          if (typeof dragEvent === 'undefined') {
            window.dragEvent = null;
            Object.defineProperty(window, 'dragEvent', {
              value: null,
              writable: true,
              configurable: true,
              enumerable: false
            });
          }
          
          // Try to prevent crashes by wrapping potentially problematic APIs
          // This might help with WebRTC/WebAssembly issues
          if (typeof SharedArrayBuffer !== 'undefined') {
            const originalSAB = SharedArrayBuffer;
            // Keep SharedArrayBuffer but add error handling
            window.SharedArrayBuffer = originalSAB;
          }
          
          // Ensure permissions API returns granted for camera/microphone
          if (navigator.permissions && navigator.permissions.query) {
            const originalQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = function(descriptor) {
              logger.debug('[Permissions API] Query:', descriptor.name);
              if (descriptor.name === 'camera' || descriptor.name === 'microphone' || descriptor.name === 'media') {
                logger.debug('[Permissions API] Returning granted for:', descriptor.name);
                return Promise.resolve({ state: 'granted', onchange: null });
              }
              return originalQuery(descriptor);
            };
          }
          
          // Also ensure getUserMedia works by pre-granting permissions
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            logger.debug('[MediaDevices] getUserMedia API available');
          }
        })();
      `).catch(() => {});
    });

    // Inject more fixes when DOM is ready
    newWindow.webContents.once('dom-ready', () => {
      // Inject fixes immediately when DOM is ready
      newWindow.webContents.executeJavaScript(`
        (function() {
          // Fix dragEvent error by providing a fallback - do this FIRST
          if (typeof dragEvent === 'undefined') {
            window.dragEvent = null;
            Object.defineProperty(window, 'dragEvent', {
              value: null,
              writable: true,
              configurable: true,
              enumerable: false
            });
          }
          
          // Allow window.close() to work - don't override it
          // The page should be able to close itself if needed
          // We'll handle cleanup in the Electron close handler
          
          // Try to catch and handle errors that might cause crashes
          window.addEventListener('error', function(e) {
            logger.debug('Global error caught:', e.message, e.filename, e.lineno);
            try {
              e.preventDefault();
            } catch (err) {
              logger.error('Error preventing default:', err);
            }
            return true;
          }, true);
          
          window.addEventListener('unhandledrejection', function(e) {
            logger.debug('Unhandled promise rejection:', e.reason);
            try {
              e.preventDefault();
            } catch (err) {
              logger.error('Error preventing default in unhandledrejection:', err);
            }
          });
          
          // Handle window beforeunload - don't prevent closing
          window.addEventListener('beforeunload', function(e) {
            try {
              logger.debug('Window beforeunload event');
              // Don't prevent the unload - allow the window to close
              // The page should be able to close normally
            } catch (err) {
              logger.error('Error in beforeunload handler:', err);
            }
          });
        })();
      `).catch(err => {
        logger.error('Error injecting fix:', err);
      });
    });
    
    // Also inject on did-finish-load as backup
    newWindow.webContents.on('did-finish-load', () => {
      newWindow.webContents.executeJavaScript(`
        (function() {
          if (typeof dragEvent === 'undefined') {
            window.dragEvent = null;
          }
        })();
      `).catch(() => {});
    });

    // Show window when ready (in windowed mode - can toggle with F11)
    newWindow.once('ready-to-show', () => {
      logger.debug('[New Window] Ready to show');
      newWindow.show();
      // Ensure menu bar is always visible
      newWindow.setMenuBarVisibility(true);
      // Don't force fullscreen - let user toggle with F11 if needed
      // DevTools disabled by default - can be toggled via menu
    });

    // Handle fullscreen toggle for new windows (F11)
    // Menu bar visible by default, hidden in fullscreen
    newWindow.setMenuBarVisibility(true);
    
    // Hide menu bar when entering fullscreen, show when leaving
    newWindow.on('enter-full-screen', () => {
      setTimeout(() => {
        if (!newWindow.isDestroyed()) {
          newWindow.setMenuBarVisibility(false);
        }
      }, 100);
    });
    
    newWindow.on('leave-full-screen', () => {
      setTimeout(() => {
        if (!newWindow.isDestroyed()) {
          newWindow.setMenuBarVisibility(true);
        }
      }, 100);
    });
    
    newWindow.webContents.on('before-input-event', (event, input) => {
      // Allow system shortcuts to pass through (Windows key, Alt+Tab, etc.)
      // These are system-level shortcuts that should work even in fullscreen
      const systemKeys = ['Super', 'Meta', 'Alt', 'Tab', 'Escape'];
      const isSystemKey = systemKeys.includes(input.key) || 
                         (input.alt && input.key === 'Tab') ||
                         (input.meta && input.key !== 'F11' && input.key !== 'F12');
      
      // Only handle our specific shortcuts, let system shortcuts pass through
      if (input.key === 'F11') {
        const isFullscreen = newWindow.isFullScreen();
        newWindow.setFullScreen(!isFullscreen);
        // Update menu bar visibility after toggling fullscreen
        setTimeout(() => {
          if (!newWindow.isDestroyed()) {
            newWindow.setMenuBarVisibility(!newWindow.isFullScreen());
          }
        }, 100);
      } else if (input.key === 'F12') {
        // Toggle DevTools with F12 (like Edge)
        if (newWindow.webContents.isDevToolsOpened()) {
          newWindow.webContents.closeDevTools();
        } else {
          newWindow.webContents.openDevTools();
        }
      } else if ((input.control || input.meta) && input.key === 'W') {
        // Ctrl+W or Cmd+W - Force close the window
        event.preventDefault();
        logger.debug('[New Window] Force closing via Ctrl+W');
        if (!newWindow.isDestroyed()) {
          newWindow.destroy();
        }
      } else if ((input.control || input.meta) && input.key === 'Q') {
        // Ctrl+Q or Cmd+Q - Force close the window
        event.preventDefault();
        logger.debug('[New Window] Force closing via Ctrl+Q');
        if (!newWindow.isDestroyed()) {
          newWindow.destroy();
        }
      } else if (isSystemKey && !input.control && !input.shift) {
        // Allow system shortcuts to pass through to the OS
        // Don't prevent default for system keys
        return;
      }
    });

    // Return deny since we're handling the window ourselves
    // This prevents Electron from creating a duplicate window
    return { action: 'deny' };
  });

  // Load the configured connection URL
  mainWindow.loadURL(appConfig.connectionUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Ensure menu bar is always visible
    mainWindow.setMenuBarVisibility(true);
    // Don't force fullscreen for main window
  });

  // DevTools disabled by default - can be toggled via menu

  // Add debugging for main window too
  mainWindow.webContents.on('did-navigate', (event, navigationUrl) => {
    logger.debug('[Main Window] Navigated to:', navigationUrl);
  });

  mainWindow.webContents.on('did-navigate-in-page', (event, navigationUrl) => {
    logger.debug('[Main Window] Navigated in page to:', navigationUrl);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logger.error('[Main Window] Failed to load:', validatedURL, errorCode, errorDescription);
  });

  // Handle window closed
  mainWindow.on('close', (event) => {
    try {
      logger.debug('[Main Window] Close event triggered');
      // Clean up DevTools if open
      try {
        if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
          if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
          }
        }
      } catch (err) {
        logger.error('[Main Window] Error closing DevTools:', err);
      }
    } catch (err) {
      logger.error('[Main Window] Error in close handler:', err);
    }
  });

  mainWindow.on('closed', () => {
    try {
      windows.delete(mainWindow);
      mainWindow = null;
      logger.debug('[Main Window] Closed');
    } catch (err) {
      logger.error('[Main Window] Error in closed handler:', err);
    }
  });

  windows.add(mainWindow);

  // Handle fullscreen toggle (F11 or ESC)
  // Menu bar visible by default, hidden in fullscreen
  mainWindow.setMenuBarVisibility(true);
  
  // Hide menu bar when entering fullscreen, show when leaving
  mainWindow.on('enter-full-screen', () => {
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.setMenuBarVisibility(false);
      }
    }, 100);
  });
  
  mainWindow.on('leave-full-screen', () => {
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.setMenuBarVisibility(true);
      }
    }, 100);
  });
  
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Allow system shortcuts to pass through (Windows key, Alt+Tab, etc.)
    // These are system-level shortcuts that should work even in fullscreen
    const systemKeys = ['Super', 'Meta', 'Alt', 'Tab', 'Escape'];
    const isSystemKey = systemKeys.includes(input.key) || 
                       (input.alt && input.key === 'Tab') ||
                       (input.meta && input.key !== 'F11' && input.key !== 'F12');
    
    // Only handle our specific shortcuts, let system shortcuts pass through
    if (input.key === 'F11') {
      const isFullscreen = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFullscreen);
      // Update menu bar visibility after toggling fullscreen
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.setMenuBarVisibility(!mainWindow.isFullScreen());
        }
      }, 100);
    } else if (input.key === 'F12') {
      // Toggle DevTools with F12 (like Edge)
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    } else if (isSystemKey && !input.control && !input.shift) {
      // Allow system shortcuts to pass through to the OS
      // Don't prevent default for system keys
      return;
    }
  });
}

// Set User-Agent for the entire session
app.whenReady().then(() => {
  // Log all command line switches for debugging
  logger.debug('=== ELECTRON COMMAND LINE FLAGS ===');
  const switches = app.commandLine.getSwitchValue('switches') || '';
  logger.debug('Command line switches:', process.argv);
  logger.debug('===============================');
  
  // Log userData path for debugging
  logger.debug('=== USER DATA PATH ===');
  const userDataPath = app.getPath('userData');
  logger.debug('userData path:', userDataPath);
  logger.debug('userData exists:', fs.existsSync(userDataPath));
  // Ensure userData directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
    logger.debug('Created userData directory');
  }
  logger.debug('SNAP_USER_DATA env:', process.env.SNAP_USER_DATA);
  logger.debug('========================');

  // Set default User-Agent
  session.defaultSession.setUserAgent(appConfig.userAgent);
  
  // Ensure cookies are persisted
  // The default session should persist cookies automatically, but let's verify
  logger.debug('Session storage path:', session.defaultSession.getStoragePath());
  
  // Set up cookie change monitoring for debugging
  session.defaultSession.cookies.on('changed', (event, cookie, cause, removed) => {
    if (appConfig.logLevel >= LOG_LEVELS.DEBUG) {
      if (removed) {
        logger.debug(`[Cookie] Removed: ${cookie.name} from ${cookie.domain}`);
      } else {
        logger.debug(`[Cookie] Set: ${cookie.name} from ${cookie.domain} (expires: ${cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toISOString() : 'session'})`);
      }
    }
  });
  
  // Log existing cookies on startup to verify persistence
  session.defaultSession.cookies.get({}).then(cookies => {
    logger.info(`[Cookies] Loaded ${cookies.length} cookies on startup`);
    const microsoftCookies = cookies.filter(c => c.domain.includes('microsoft.com'));
    logger.debug(`[Cookies] ${microsoftCookies.length} Microsoft cookies found`);
    if (microsoftCookies.length > 0 && appConfig.logLevel >= LOG_LEVELS.DEBUG) {
      microsoftCookies.forEach(c => {
        logger.debug(`  - ${c.name} (expires: ${c.expirationDate ? new Date(c.expirationDate * 1000).toISOString() : 'session'})`);
      });
    }
  }).catch(err => {
    logger.error('[Cookies] Error loading cookies:', err);
  });

  // Create application menu
  createMenu();

  // Set up permission handlers BEFORE creating any windows
  // This ensures they're active for all windows from the start
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    logger.debug(`[Permission Request] ${permission} from ${details.requestingUrl || 'unknown'}`);
    logger.debug(`[Permission Request] Full details:`, JSON.stringify(details, null, 2));
    // Allow camera, microphone, notifications, and other media permissions
    // Note: "media" is a combined permission for camera + microphone
    const allowedPermissions = [
      'camera',
      'microphone',
      'media', // Combined permission for camera + microphone
      'notifications',
      'geolocation',
      'midi',
      'midiSysex',
      'pointerLock',
      'fullscreen',
      'openExternal'
    ];

    // Check if permission is allowed (case-insensitive)
    const permissionLower = permission.toLowerCase();
    const isAllowed = allowedPermissions.some(p => p.toLowerCase() === permissionLower);
    
    if (isAllowed) {
      logger.debug(`[Permission Request] GRANTED: ${permission}`);
      callback(true); // Allow the permission
    } else {
      logger.debug(`[Permission Request] DENIED: ${permission} (not in allowed list: ${allowedPermissions.join(', ')})`);
      callback(false); // Deny other permissions
    }
  });

  // Handle permission check - set up globally for all windows using defaultSession
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const allowedPermissions = [
      'camera',
      'microphone',
      'media', // Combined permission for camera + microphone
      'notifications',
      'geolocation',
      'midi',
      'midiSysex',
      'pointerLock',
      'fullscreen'
    ];

    // Check if permission is allowed (case-insensitive)
    const permissionLower = permission.toLowerCase();
    const allowed = allowedPermissions.some(p => p.toLowerCase() === permissionLower);
    logger.debug(`[Permission Check] ${permission} from ${requestingOrigin} -> ${allowed ? 'ALLOWED' : 'DENIED'}`);
    return allowed;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


