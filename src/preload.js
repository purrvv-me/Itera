'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('itera', {
  getConfig: () => ipcRenderer.invoke('itera:config'),
  minimize: () => ipcRenderer.send('itera:minimize'),
  toggleMaximize: () => ipcRenderer.send('itera:toggle-maximize'),
  onMaximizeChange: (cb) => ipcRenderer.on('itera:maximized', (_e, isMax) => cb(isMax)),
  close: () => ipcRenderer.send('itera:close'),
  killSession: () => ipcRenderer.send('itera:kill-session'),
});
