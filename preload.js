console.log('PRELOAD DEBUG: The preload.js script has loaded successfully.'); // <-- ADD THIS LINE
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  createPiPWindow: (bounds) => ipcRenderer.invoke('create-pip-window', bounds),
  closePiPWindow: () => ipcRenderer.invoke('close-pip-window'),
  updatePiPStream: (streamData) => ipcRenderer.invoke('update-pip-stream', streamData),
  
  // Event listeners
  onUpdateStream: (callback) => ipcRenderer.on('update-stream', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});