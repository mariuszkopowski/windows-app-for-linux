# Build Instructions for Windows App for Linux

## Prerequisites

### For Snap Package:
```bash
sudo snap install snapcraft --classic
```

### For Flatpak Package:
```bash
# Install Flatpak and Flatpak Builder
sudo apt install flatpak flatpak-builder
# Add Flathub repository
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
```

## Icon Setup

**IMPORTANT:** You need to add an icon file before building:
1. Place your icon file as `com.microsoft.WindowsAppForLinux.png` in the project root (512x512 pixels recommended)
2. The icon will be used for both Snap and Flatpak packages
3. If you don't have an icon, you can create a simple one or download a placeholder

## Building Snap Package

```bash
# Build the snap package
snapcraft

# Install locally for testing
sudo snap install windows-app-for-linux_1.0.0_amd64.snap --dangerous

# Run the application
windows-app-for-linux
```

## Building Flatpak Package

```bash
# Build the flatpak package
flatpak-builder build-dir com.microsoft.WindowsAppForLinux.yml --force-clean

# Install locally for testing
flatpak-builder --user --install --force-clean build-dir com.microsoft.WindowsAppForLinux.yml

# Run the application
flatpak run com.microsoft.WindowsAppForLinux
```

## Notes

- Make sure you have an icon file (`com.microsoft.WindowsAppForLinux.png`) in the project root
- The icon should be at least 512x512 pixels for best results
- For snap, the icon will be automatically included from the desktop file
- For flatpak, the icon needs to be specified in the manifest

