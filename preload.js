const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    runPython: (args) => ipcRenderer.invoke('run-python', args),

    // Send a message to the Python backend
    sendToPython: (message) => {
        try {
            ipcRenderer.send('to-python', message);
        } catch (error) {
            console.error('Error sending message to Python:', error);
        }
    },

    onCallInit: (callback) => {
        ipcRenderer.on('call-init', (event, callId) => callback(callId));
    },

    // Register a listener for messages from the Python backend
    onFromPython: (callback) => {
      ipcRenderer.on('from-python', (event, data) => callback(data));
    },
    
    // Register a listener for Python errors
    onPythonError: (callback) => {
      ipcRenderer.on('python-error', (event, data) => {
          callback(data)
      });
    },
    
    // Register listeners for menu events
    onShowSipSettings: (callback) => {
      ipcRenderer.on('show-sip-settings', () => callback());
    },
    
    onShowAudioSettings: (callback) => {
      ipcRenderer.on('show-audio-settings', () => callback());
    },
    
    onShowContacts: (callback) => {
      ipcRenderer.on('show-contacts', () => callback());
    },
    
    onShowCallHistory: (callback) => {
      ipcRenderer.on('show-call-history', () => callback());
    },
    
    onShowAbout: (callback) => {
      ipcRenderer.on('show-about', () => callback());
    }
  }
);
