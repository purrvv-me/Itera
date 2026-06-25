'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('itera', {
  getConfig: () => ipcRenderer.invoke('itera:config'),
  minimize: () => ipcRenderer.send('itera:minimize'),
  toggleMaximize: () => ipcRenderer.send('itera:toggle-maximize'),
  onMaximizeChange: (cb) => ipcRenderer.on('itera:maximized', (_e, isMax) => cb(isMax)),
  close: () => ipcRenderer.send('itera:close'),
  killSession: () => ipcRenderer.send('itera:kill-session'),
  onNewTab: (cb) => ipcRenderer.on('itera:new-tab', (_e, payload) => cb(payload)),
  onShortcut: (cb) => ipcRenderer.on('itera:shortcut', (_e, action) => cb(action)),
});
