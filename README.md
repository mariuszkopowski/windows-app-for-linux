# Windows App for Linux

**Unofficial Client for Windows App** - A standalone Electron application that provides native Linux access to Azure Virtual Desktops via Windows App web access (https://windows.cloud.microsoft/#/devices) with proper browser emulation, device permissions, and remote desktop support.

## Overview

This **unofficial client** wraps the Windows Cloud Devices web interface in an Electron shell, configured to behave like Microsoft Edge browser. It enables full access to Azure Virtual Desktop sessions through Windows App web access, with proper handling of camera, microphone, and other device permissions required for remote desktop connections.

## Features

- ✅ **Browser Emulation**: Custom User-Agent (Edge 143.0.0.0) and browser-like headers
- ✅ **Remote Desktop Support**: Handles new windows for RDP sessions with proper session management
- ✅ **Device Access**: Camera, microphone, and other media device permissions
- ✅ **Fullscreen Mode**: Toggle fullscreen with F11
- ✅ **Multi-Window Support**: Properly handles popup windows for remote desktop connections
- ✅ **Session Management**: Shared cookies and authentication across windows
- ✅ **WebRTC & WebAssembly**: Enabled for remote desktop functionality
- ✅ **SharedArrayBuffer**: Enabled for RDP client compatibility
- ✅ **Error Recovery**: Automatic crash recovery and error handling
- ✅ **Linux Packaging**: Snap and Flatpak support for easy distribution

## Prerequisites

- **Node.js**: v16 or higher (v20+ recommended)
- **npm**: Comes with Node.js
- **For Snap builds**: `snapcraft` (install via `sudo snap install snapcraft --classic`)
- **For Flatpak builds**: `flatpak` and `flatpak-builder`

## Quick Start

### Installation

1. **Clone or download this repository**

2. **Run the setup script** (optional, checks Node.js and installs dependencies):
   ```bash
   ./setup.sh
   ```

   Or manually install dependencies:
```bash
   cd src
npm install
```

### Running the Application

Start the application:
```bash
cd src
npm start
```

## Documentation

For detailed documentation, see the [docs](docs/) folder:

- **[Build Instructions](docs/build-instructions.md)** - Detailed instructions for building Snap and Flatpak packages
- **[Compare Flags](docs/compare-flags.md)** - Comparison of Electron command-line flags

The app will:
- Launch in windowed mode (1920x1080)
- Load the Windows Cloud Devices page (Azure Virtual Desktops via Windows App web access)
- Use the configured Edge User-Agent
- Automatically grant permissions for camera and microphone when needed
- Handle new windows for Azure Virtual Desktop sessions

## Keyboard Shortcuts

- **F11**: Toggle fullscreen mode
- **F12**: Toggle Developer Tools
- **Ctrl+Shift+I**: Alternative DevTools toggle
- **Ctrl+N**: Open new window
- **Ctrl+R**: Reload page
- **Ctrl+Shift+R**: Force reload

## Building for Distribution

### Standard Electron Build

To build platform-specific installers using electron-builder:

```bash
cd src
npm run build
```

This will create installers in the `build/dist` folder for your platform.

### Snap Package

The application can be packaged as a Snap for easy installation on Linux distributions.

1. **Install snapcraft** (if not already installed):
   ```bash
   sudo snap install snapcraft --classic
   ```

2. **Build the snap**:
   ```bash
   cd src
   npm run build:snap
   ```
   The snap file will be created in the `build/` folder.

   Or directly:
   ```bash
   snapcraft pack --destructive-mode --output-dir build
   ```

3. **Install the snap locally** (for testing):
   ```bash
   sudo snap install build/windows-app-for-linux_1.0.0_amd64.snap --dangerous
   ```

4. **Run the application**:
   ```bash
   windows-app-for-linux
   ```

5. **Publish to Snap Store** (optional):
   ```bash
   snapcraft login
   snapcraft push windows-app-for-linux_1.0.0_amd64.snap
   ```

#### Snap Permissions

The snap package includes the following permissions (plugs):
- `camera`: Camera access for video calls
- `audio-playback`: Audio output
- `audio-record`: Microphone input
- `network`: Internet access
- `desktop`: Desktop integration
- `wayland` / `x11`: Display server support
- `opengl`: Hardware acceleration
- `pulseaudio`: Audio system integration
- `home`: Home directory access
- `removable-media`: USB device access

### Flatpak Package

The application can also be packaged as a Flatpak.

1. **Install Flatpak and Flatpak Builder**:
   ```bash
   sudo apt install flatpak flatpak-builder
   flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
   ```

2. **Build the Flatpak**:
   ```bash
   cd src
   npm run build:flatpak
   ```
   The build directory will be in `build/flatpak-build/`.

   Or directly:
   ```bash
   flatpak-builder build/flatpak-build src/windows-app-for-linux.desktop.yml --force-clean
   ```

3. **Install locally** (for testing):
   ```bash
   cd src
   npm run install:flatpak
   ```
   Or directly:
   ```bash
   flatpak-builder --user --install --force-clean build/flatpak-build src/windows-app-for-linux.desktop.yml
   ```

4. **Run the application**:
   ```bash
   flatpak run com.microsoft.WindowsAppForLinux
   ```

## Architecture

### Main Window

The main window loads the Windows Cloud Devices dashboard at `https://windows.cloud.microsoft/#/devices`, which provides access to Azure Virtual Desktops via Windows App web access. It uses a custom User-Agent and browser-like headers to ensure compatibility with Microsoft's service.

### Remote Desktop Windows

When you connect to an Azure Virtual Desktop session, the application automatically creates a new window with:
- Shared session and cookies (for authentication)
- Same User-Agent configuration
- Proper WebRTC and WebAssembly support
- Error recovery mechanisms
- Fullscreen toggle support

### Command Line Switches

The application uses several Electron command-line switches to enable browser-like behavior:
- `enable-features`: VaapiVideoDecoder, SharedArrayBuffer, CrossOriginOpenerPolicy
- `enable-blink-features`: SharedArrayBuffer
- `enable-webrtc`: WebRTC support
- `enable-webassembly`: WebAssembly support
- `enable-accelerated-2d-canvas`: Hardware acceleration
- `enable-gpu-rasterization`: GPU rendering
- `disable-dev-shm-usage`: Use /tmp for shared memory

## Configuration

### User-Agent

The User-Agent can be modified in `src/main.js`:
```javascript
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';
```

### Target URL

Change the target URL in `src/main.js`:
```javascript
mainWindow.loadURL('https://windows.cloud.microsoft/#/devices');
```

### Window Size

Default window size can be changed in the `createWindow()` function in `src/main.js`:
```javascript
width: 1920,
height: 1080,
```

## Permissions

The app automatically grants the following permissions:
- **Camera**: For video calls and screen sharing
- **Microphone**: For audio communication
- **Media**: Combined camera + microphone permission
- **Notifications**: For system notifications
- **Geolocation**: If required by the service
- **Fullscreen**: For immersive remote desktop experience
- **MIDI**: For MIDI device access
- **Pointer Lock**: For remote desktop mouse control

## Troubleshooting

### Web Page Doesn't Load

1. **Check internet connection**: Ensure you have access to `windows.cloud.microsoft` (Windows App web access for Azure Virtual Desktops)
2. **Verify User-Agent**: Check that the User-Agent is correctly set (use F12 DevTools)
3. **Check console errors**: Enable DevTools (F12) and check for JavaScript errors
4. **Clear cache**: The app uses Electron's default session storage

### Remote Desktop Window Issues

1. **Blank screen**: The RDP client may take a few seconds to initialize. Wait 5-10 seconds.
2. **Authentication errors**: Ensure cookies are being shared (check console logs)
3. **Crashes**: The app includes automatic crash recovery. If it persists, check console logs.
4. **Performance issues**: Ensure hardware acceleration is enabled (check GPU settings)

### Permission Issues

1. **Camera/Microphone not working**: 
   - Check system permissions (Linux desktop settings)
   - For Snap: `snap connect windows-app-for-linux:camera`
   - For Flatpak: Check Flatpak permissions with `flatpak info com.microsoft.WindowsAppForLinux`

2. **Audio issues**:
   - Ensure PulseAudio is running
   - Check audio system permissions

### Debug Mode

To enable more verbose logging, the application already includes extensive console logging. Open DevTools (F12) to see:
- Navigation events
- Permission requests
- Window creation
- Error messages
- Network requests

## Development

### Project Structure

```
.
├── src/                 # Source code
│   ├── main.js         # Main Electron process
│   ├── package.json    # Node.js dependencies and scripts
│   ├── *.desktop       # Desktop entry file
│   └── *.png           # Application icon
├── build/               # Build artifacts (generated)
│   ├── *.snap          # Snap package output
│   └── flatpak-build/  # Flatpak build directory
├── docs/                # Documentation
│   ├── build-instructions.md
│   └── compare-flags.md
├── snapcraft.yaml       # Snap package configuration
├── setup.sh             # Development environment setup script
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

**Note**: Snapcraft creates temporary build directories (`parts/`, `stage/`, `prime/`, `.snapcraft/`) in the project root during builds. These are automatically ignored by git and can be cleaned with `npm run clean`.

### Dependencies

- **electron**: ^31.0.0 - Electron framework
- **electron-builder**: ^24.9.1 - Build tool for installers

### Scripts

All scripts should be run from the `src/` directory:

- `npm start`: Run the application in development mode
- `npm run build`: Build platform-specific installers
- `npm run build:snap`: Build Snap package (outputs to `build/`)
- `npm run build:flatpak`: Build Flatpak package (outputs to `build/flatpak-build/`)
- `npm run install:flatpak`: Build and install Flatpak locally
- `npm run clean`: Clean all build artifacts
- `npm run clean:snap`: Clean only Snap build artifacts
- `npm run clean:flatpak`: Clean only Flatpak build artifacts

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Notes

- **This is an unofficial client** for Windows App and is not affiliated with or endorsed by Microsoft
- The application requires an active internet connection to access Azure Virtual Desktops via Windows App web access
- A Microsoft account is required to use Azure Virtual Desktops
- Remote desktop sessions (Azure Virtual Desktops) open in separate windows for better isolation
- The app is designed to work on Linux distributions with X11 or Wayland

