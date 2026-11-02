const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('novaClient', {
  getState: () => ipcRenderer.invoke('nova:get-state'),
  login: () => ipcRenderer.invoke('nova:login'),
  logout: () => ipcRenderer.invoke('nova:logout'),
  saveSettings: (settings) => ipcRenderer.invoke('nova:save-settings', settings),
  launch: () => ipcRenderer.invoke('nova:launch'),
  openGameFolder: () => ipcRenderer.invoke('nova:open-game-folder'),
  openWebsite: () => ipcRenderer.invoke('nova:open-website'),
  getUpdateState: () => ipcRenderer.invoke('nova:update-state'),
  checkUpdates: () => ipcRenderer.invoke('nova:update-check'),
  installUpdate: () => ipcRenderer.invoke('nova:update-install'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('nova:update-state', listener);
    return () => ipcRenderer.removeListener('nova:update-state', listener);
  },
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('nova:progress', listener);
    return () => ipcRenderer.removeListener('nova:progress', listener);
  }
});
