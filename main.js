const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Keep a global reference of the window object and Python process
let mainWindow;
let pythonProcess = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'app-icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Create application menu
  createMenu();

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  ipcMain.handle('run-python', async (event, args) => {
    return new Promise((resolve, reject) => {
      try {
        const isDev = !app.isPackaged;
        const scriptPath = isDev
          ? path.join(__dirname, 'python', 'softphone.py')
          : path.join(process.resourcesPath, 'softphone');
        console.log("Script path:", scriptPath);

        // Spawn the Python process and store it globally
        pythonProcess = spawn('python', [scriptPath, ...args]);

        let output = '';

        pythonProcess.stdout.on('data', (data) => {
          const message = data.toString();
          console.log('Python stdout:', message);
          if (mainWindow) {
            mainWindow.webContents.send('from-python', message);
          }
          output += message;
        });

        pythonProcess.stderr.on('data', (data) => {
          console.error('Python stderr:', data.toString());
        });

        pythonProcess.on('close', (code) => {
          console.log(`Python process exited with code ${code}`);
          resolve(output.trim());
          pythonProcess = null;
        });

        pythonProcess.on('error', (err) => {
          console.error('Python process error:', err);
          if (mainWindow) {
            mainWindow.webContents.send('python-error', { message: err.message });
          }
          reject(err);
        });

        console.log('Python process started');
      } catch (err) {
        console.error('Failed to start Python process:', err);
        if (mainWindow) {
          mainWindow.webContents.send('python-error', { message: err.message });
        }
        reject(err);
      }
    });
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
    stopPythonProcess();
  });
}

function stopPythonProcess() {
  if (pythonProcess) {
    console.log('Stopping Python process');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'SIP Account Settings',
          click() {
            if (mainWindow) {
              mainWindow.webContents.send('show-sip-settings');
            }
          }
        },
        {
          label: 'Audio Settings',
          click() {
            if (mainWindow) {
              mainWindow.webContents.send('show-audio-settings');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click() {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Contacts',
          click() {
            if (mainWindow) {
              mainWindow.webContents.send('show-contacts');
            }
          }
        },
        {
          label: 'Call History',
          click() {
            if (mainWindow) {
              mainWindow.webContents.send('show-call-history');
            }
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggledevtools' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About',
          click() {
            if (mainWindow) {
              mainWindow.webContents.send('show-about');
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Handle IPC messages from renderer
ipcMain.on('to-python', (event, message) => {
  if (pythonProcess && !pythonProcess.killed) {
    try {
      console.log('Sending to Python:', message);
      pythonProcess.stdin.write(JSON.stringify(message) + '\n');
    } catch (error) {
      console.error('Error sending message to Python:', error);
      event.reply('python-error', { message: 'Failed to send message to Python' });
    }
  } else {
    console.error('Python process not running');
    event.reply('python-error', { message: 'Python process not running' });
  }
});

// App events
app.on('ready', createWindow);

app.on('window-all-closed', function() {
  stopPythonProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function() {
  if (mainWindow === null) {
    createWindow();
  }
});
