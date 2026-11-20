const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qrAPI', {
  onInit: (cb) => ipcRenderer.on('qr:init', (_e, data) => cb(data)),
  onQr: (cb) => ipcRenderer.on('qr:qr', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('qr:status', (_e, data) => cb(data)),
  cancel: () => ipcRenderer.send('qr:cancel'),
});
