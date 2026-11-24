#!/bin/bash
# Builds "Pocket Pals Dock.app" in this folder. Needs the Xcode command line tools (swiftc).
set -euo pipefail
cd "$(dirname "$0")"
APP="Pocket Pals Dock.app"
BUILD=".build"
mkdir -p "$BUILD"
echo "Compiling…"
swiftc -O -swift-version 5 Sources/main.swift Sources/widget.swift -o "$BUILD/PocketPalsDock" -framework Cocoa -framework SwiftUI -framework ServiceManagement
echo "Making the icon…"
swiftc -swift-version 5 Sources/make_icon.swift -o "$BUILD/make_icon" -framework Cocoa
"$BUILD/make_icon" "$BUILD/icon.png"
rm -rf "$BUILD/AppIcon.iconset"; mkdir -p "$BUILD/AppIcon.iconset"
for s in 16 32 128 256 512; do
  sips -z $s $s "$BUILD/icon.png" --out "$BUILD/AppIcon.iconset/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$BUILD/icon.png" --out "$BUILD/AppIcon.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$BUILD/AppIcon.iconset" -o "$BUILD/AppIcon.icns"
echo "Packaging…"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD/PocketPalsDock" "$APP/Contents/MacOS/"
cp Info.plist "$APP/Contents/"
cp "$BUILD/AppIcon.icns" "$APP/Contents/Resources/"
codesign --force --deep -s - "$APP" >/dev/null 2>&1 || true
echo "Done: $(pwd)/$APP"
