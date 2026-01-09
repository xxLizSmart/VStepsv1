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
let wKeyBlocked = false;
let uioHook = null;
let blockingPaused = false;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
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
    // Temporarily pause W key blocking while we send our own keys
    if (wKeyBlocked && data.direction === 'forward') {
      blockingPaused = true;
      setTimeout(() => { blockingPaused = false; }, 500);
    }
    keyboardController.handleMovement(
      data.direction, 
      data.isSprint || false, 
      data.holdDuration || null,
      data.cameraControl || false,
      data.mouseSensitivity || 50,
      data.burstMode || false,
      data.burstPresses || 16
    );
    mainWindow?.webContents.send('movement', data);
  });
  
  connectionManager.on('jump', () => {
    keyboardController.handleJump();
    mainWindow?.webContents.send('jump');
  });

  connectionManager.on('sensor-data', (data) => {
    mainWindow?.webContents.send('sensor-data', data);
  });

  connectionManager.on('phone-settings', (settings) => {
    mainWindow?.webContents.send('phone-settings', settings);
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

ipcMain.on('settings-update', (event, settings) => {
  if (connectionManager?.isConnected()) {
    connectionManager.sendSettings(settings);
  }
});

// Keyboard blocking functionality
function initKeyboardBlocker() {
  try {
    uioHook = require('uiohook-napi');
    console.log('uiohook-napi loaded - keyboard blocking available');
    
    uioHook.uIOhook.on('keydown', (e) => {
      // W key is keycode 17 (0x11) in uiohook-napi
      // Skip if blocking is paused (we're sending our own keys)
      if (blockingPaused) return;
      // Only block physical key presses, not injected/programmatic ones from RobotJS
      const isInjected = e.isInjected || e.isTrusted === false;
      if (wKeyBlocked && !isInjected && (e.keycode === 17 || e.keycode === 0x11)) {
        // Block only physical W key presses
        e.preventDefault = true;
      }
    });
  } catch (err) {
    console.log('uiohook-napi not available - keyboard blocking disabled');
    console.log('To enable W key blocking, install: npm install uiohook-napi');
  }
}

function startKeyboardBlocking() {
  if (uioHook && !wKeyBlocked) {
    try {
      uioHook.uIOhook.start();
      wKeyBlocked = true;
      console.log('W key blocking enabled');
      mainWindow?.webContents.send('w-key-block-status', { enabled: true, success: true });
    } catch (err) {
      wKeyBlocked = false;
      console.error('Failed to start keyboard hook:', err);
      mainWindow?.webContents.send('w-key-block-status', { enabled: false, success: false, error: err.message });
    }
  } else if (!uioHook) {
    mainWindow?.webContents.send('w-key-block-status', { 
      enabled: false, 
      success: false, 
      error: 'Native keyboard blocking not available. Install uiohook-napi in the desktop app.' 
    });
  }
}

function stopKeyboardBlocking() {
  if (uioHook && wKeyBlocked) {
    wKeyBlocked = false;
    try {
      uioHook.uIOhook.stop();
      console.log('W key blocking disabled');
    } catch (err) {
      console.error('Failed to stop keyboard hook:', err);
    }
  }
  wKeyBlocked = false;
}

ipcMain.on('toggle-disable-w-key', (event, enabled) => {
  if (enabled) {
    startKeyboardBlocking();
  } else {
    stopKeyboardBlocking();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  initializeServices();
  initKeyboardBlocker();
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
  stopKeyboardBlocking();
  keyboardController?.releaseAllKeys();
  connectionManager?.disconnect();
  discoveryService?.stop();
});
