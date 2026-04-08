#!/bin/bash
# Generate macOS .icns file from PNG icons
# Must be run after npm run build and before electron-builder

set -e

cd "$(dirname "$0")/.."

# Check if base icon.png exists
if [ ! -f "build/icon.png" ]; then
    echo "Error: build/icon.png not found. Run generate-icon.js first."
    exit 1
fi

# Create iconset directory
mkdir -p build/icon.iconset

# Copy icons to iconset with correct names
cp build/icon_16x16.png build/icon.iconset/icon_16x16.png
cp build/icon_32x32.png build/icon.iconset/icon_16x16@2x.png
cp build/icon_64x64.png build/icon.iconset/icon_32x32.png
cp build/icon_128x128.png build/icon.iconset/icon_32x32@2x.png
cp build/icon_256x256.png build/icon.iconset/icon_128x128.png
cp build/icon_512x512.png build/icon.iconset/icon_256x256@2x.png
cp build/icon_1024x1024.png build/icon.iconset/icon_512x512.png

# Convert to .icns
iconutil -c icns build/icon.iconset -o build/icon.icns

# Cleanup
rm -rf build/icon.iconset

echo "Generated build/icon.icns successfully"
