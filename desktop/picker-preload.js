const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pickerApi', {
    onSources: (callback) => ipcRenderer.on('picker:sources', (_event, sources) => callback(sources)),
    choose: (id) => ipcRenderer.send('picker:choose', String(id)),
    cancel: () => ipcRenderer.send('picker:cancel')
});
