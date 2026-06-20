'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('itera', {
  getConfig: () => ipcRenderer.invoke('itera:config'),
  minimize: () => ipcRenderer.send('itera:minimize'),
  close: () => ipcRenderer.send('itera:close'),
  killSession: () => ipcRenderer.send('itera:kill-session'),
});
