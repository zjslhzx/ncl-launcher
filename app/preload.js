const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('dfNative', {
  reportSelftest: (s) => ipcRenderer.send('selftest-result', String(s))
});
