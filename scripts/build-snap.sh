#!/bin/bash
# Build script for Snap package that organizes build directories under build/

set -e

# Create build directory structure
echo "Creating build directory structure..."
rm -rf build/snap
mkdir -p build/snap

# Copy src contents to build/snap (snapcraft will use this as project root)
# Copy all files from src/ directly to build/snap/ (not the src directory itself)
cp -r src/* build/snap/ 2>/dev/null || cp src/* build/snap/
# Ensure package manifests are present for npm install during snapcraft build
cp package.json build/snap/
cp package-lock.json build/snap/ 2>/dev/null || true
# Copy snapcraft config
cp snapcraft.yaml build/snap/
cd build/snap

# Update snapcraft.yaml paths since we're now in build/snap
# The source should be relative to current directory (src files are now in root)
sed -i 's|source: \$CRAFT_PROJECT_DIR/src|source: .|' snapcraft.yaml || true
# Update icon path - icon is now in root, not src/
sed -i 's|icon: src/windows-app-for-linux.desktop.png|icon: windows-app-for-linux.desktop.png|' snapcraft.yaml || true

# Build the snap
echo "Building snap package..."
snapcraft pack --destructive-mode

# Move snap file to build directory
if [ -f *.snap ]; then
    cd ../
    mv snap/*.snap .
    echo "Snap package moved to build directory"
fi

echo "Build complete! All artifacts are in build directory."

