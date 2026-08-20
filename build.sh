#!/bin/bash
set -e

echo "🔨 Building RightClickRestore Safari Extension for macOS..."

mkdir -p build

xcodebuild -project ./SafariExtension/RightClickRestore/RightClickRestore.xcodeproj \
  -scheme "RightClickRestore (macOS)" \
  -configuration Debug \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  CONFIGURATION_BUILD_DIR="$(pwd)/build" \
  build

echo ""
echo "✅ Build Succeeded!"
echo "📦 App built at: $(pwd)/build/RightClickRestore.app"
echo ""
echo "🚀 To enable in Safari:"
echo "1. Open Safari -> Settings (⌘,) -> Advanced -> Check 'Show features for web developers'"
echo "2. In Safari menu bar -> Develop -> Check 'Allow Unsigned Extensions'"
echo "3. Open the app: open build/RightClickRestore.app"
echo "4. In Safari -> Settings -> Extensions -> Turn on 'Right Click & Selection Restorer'"
echo "5. Click 'Always Allow on Every Website'"
