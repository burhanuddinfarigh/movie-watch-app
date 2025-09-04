const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');

let mainWindow;
let pipWindow; // Picture-in-picture window

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true // Enable security
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#1a1a1a'
  });

  mainWindow.loadFile('index.html');

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (pipWindow) {
      pipWindow.close();
    }
  });

  // Development tools
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createPiPWindow(bounds = { width: 320, height: 240 }) {
  if (pipWindow) {
    pipWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  pipWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: width - bounds.width - 20,
    y: 20,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    backgroundColor: '#000000',
    transparent: false
  });

  pipWindow.loadFile('pip.html');

  pipWindow.on('closed', () => {
    pipWindow = null;
  });

  // Make window draggable
  pipWindow.setMovable(true);
}

// App event handlers
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for renderer process communication
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 240 }
    });
    return sources;
  } catch (error) {
    console.error('Error getting desktop sources:', error);
    return [];
  }
});

ipcMain.handle('create-pip-window', async (event, bounds) => {
  createPiPWindow(bounds);
  return pipWindow ? pipWindow.id : null;
});

ipcMain.handle('close-pip-window', async () => {
  if (pipWindow) {
    pipWindow.close();
  }
});

ipcMain.handle('update-pip-stream', async (event, streamData) => {
  if (pipWindow) {
    pipWindow.webContents.send('update-stream', streamData);
  }
});

// Handle app protocol for deep linking (future feature)
app.setAsDefaultProtocolClient('movie-watch-together');