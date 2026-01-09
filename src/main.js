const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { KeyboardController } = require('./keyboard');
const { ConnectionManager } = require('./connection');
const { DiscoveryService } = require('./discovery');

let mainWindow = null;
let tray = null;
let keyboardController = null;
let connectionManager = null;
let discoveryService = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    frame: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });
};

const createTray = () => {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  tray = new Tray(icon);
  
  updateTrayMenu('disconnected');
  
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });

  tray.setToolTip('VSteps Desktop');
};

const updateTrayMenu = (status) => {
  const statusText = status === 'connected' ? 'Connected' : 'Waiting for phone...';
  const statusIcon = status === 'connected' ? '🟢' : '⚪';
  
  const contextMenu = Menu.buildFromTemplate([
    { label: `${statusIcon} ${statusText}`, enabled: false },
    { type: 'separator' },
    { label: 'Show Window', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      app.isQuitting = true;
      app.quit();
    }}
  ]);
  
  tray.setContextMenu(contextMenu);
};

const initializeServices = () => {
  keyboardController = new KeyboardController();
  
  connectionManager = new ConnectionManager();
  
  connectionManager.on('connected', () => {
    updateTrayMenu('connected');
    mainWindow?.webContents.send('connection-status', 'connected');
  });
  
  connectionManager.on('disconnected', () => {
    updateTrayMenu('disconnected');
    keyboardController.releaseAllKeys();
    mainWindow?.webContents.send('connection-status', 'disconnected');
  });
  
  connectionManager.on('movement', (data) => {
    keyboardController.handleMovement(data.direction);
    mainWindow?.webContents.send('movement', data);
  });
  
  connectionManager.on('jump', () => {
    keyboardController.handleJump();
    mainWindow?.webContents.send('jump');
  });

  discoveryService = new DiscoveryService();
  discoveryService.on('server-found', (serverUrl) => {
    console.log('Found VSteps server:', serverUrl);
    connectionManager.connect(serverUrl);
    mainWindow?.webContents.send('server-found', serverUrl);
  });

  discoveryService.startBrowsing();
};

ipcMain.on('connect-manual', (event, serverUrl) => {
  connectionManager.connect(serverUrl);
});

ipcMain.on('disconnect', () => {
  connectionManager.disconnect();
  keyboardController.releaseAllKeys();
});

ipcMain.on('get-status', (event) => {
  event.reply('connection-status', connectionManager?.isConnected() ? 'connected' : 'disconnected');
  event.reply('discovery-status', discoveryService?.getDiscoveredServers() || []);
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  initializeServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  keyboardController?.releaseAllKeys();
  connectionManager?.disconnect();
  discoveryService?.stop();
});
