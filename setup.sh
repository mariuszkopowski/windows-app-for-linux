#!/bin/bash
# Setup script for Windows App for Linux - Development Environment

echo "Setting up Windows App for Linux development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed."
    echo ""
    echo "Please install Node.js using one of these methods:"
    echo ""
    echo "Option 1 - Using Snap (Recommended):"
    echo "  sudo snap install node --classic"
    echo ""
    echo "Option 2 - Using apt:"
    echo "  sudo apt update"
    echo "  sudo apt install nodejs npm"
    echo ""
    echo "Option 3 - Using nvm (Node Version Manager):"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "  source ~/.bashrc"
    echo "  nvm install --lts"
    echo ""
    exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Create build directory
echo "Creating build directory..."
mkdir -p build

# Install dependencies
echo "Installing dependencies..."
cd src
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "Setup complete! You can now:"
    echo "  - Run the app: cd src && npm start"
    echo "  - Build snap: cd src && npm run build:snap"
    echo "  - Build flatpak: cd src && npm run build:flatpak"
    echo "  - Clean build artifacts: cd src && npm run clean"
else
    echo ""
    echo "Failed to install dependencies. Please check the error messages above."
    exit 1
fi

