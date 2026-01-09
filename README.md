# VSteps Desktop App

A native desktop companion app for VSteps that allows your phone to control your PC keyboard without needing Python installed.

## Features

- **No Python Required** - Everything bundled in one installer
- **Auto-Discovery** - Automatically finds VSteps servers on your network (mDNS)
- **System Tray** - Runs in background, accessible from system tray
- **Keyboard Simulation** - Native keyboard control using RobotJS
- **Sustained Key Holds** - Keys held for 3 seconds per step for smooth game control

## Installation

### Pre-built Installers

Download the latest release for your platform:
- **Windows**: `VSteps-Desktop-Setup.exe` or `VSteps-Desktop-Portable.exe`
- **macOS**: `VSteps-Desktop.dmg`
- **Linux**: `VSteps-Desktop.AppImage` or `.deb`

### Build from Source

1. Install Node.js 18+ 
2. Navigate to the desktop-app folder:
   ```bash
   cd desktop-app
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run in development mode:
   ```bash
   npm start
   ```

5. Build installers:
   ```bash
   # Windows
   npm run build:win
   
   # macOS
   npm run build:mac
   
   # Linux
   npm run build:linux
   ```

## Usage

1. Launch VSteps Desktop on your PC
2. Open VSteps in your phone's browser
3. Copy the server URL shown on your phone
4. Paste it in the desktop app and click Connect
5. Start walking to control your PC!

## Key Mappings

| Action | Key Pressed |
|--------|-------------|
| Walk Forward | W (held for 3s) |
| Lean/Step Left | A (held for 3s) |
| Lean/Step Right | D (held for 3s) |
| Jump Button | Space (tap) |

## Technical Details

### Dependencies

- **Electron** - Cross-platform desktop framework
- **RobotJS** - Native keyboard simulation
- **Socket.IO Client** - Real-time server communication
- **Bonjour Service** - mDNS discovery for auto-connect

### Security

- Keys are automatically released when:
  - The app is closed
  - Connection is lost
  - After the 3-second hold duration expires

### Troubleshooting

**Connection Issues:**
- Ensure your phone and PC are on the same network
- Check that no firewall is blocking the connection
- Try using the manual URL entry instead of auto-discovery

**Keyboard Not Working:**
- Run the app as administrator (Windows)
- Grant accessibility permissions (macOS)
- Some games with anti-cheat may block simulated input

## Development

The desktop app consists of:

- `src/main.js` - Electron main process, window/tray management
- `src/keyboard.js` - RobotJS keyboard controller with sustained holds
- `src/connection.js` - Socket.IO client for server communication  
- `src/discovery.js` - mDNS/Bonjour service discovery
- `src/index.html` - UI for connection and activity monitoring
