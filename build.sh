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

mkdir -p "build/RightClickRestore.app/Contents/PlugIns"
if [ -d "build/RightClickRestore Extension.appex" ]; then
  cp -R "build/RightClickRestore Extension.appex" "build/RightClickRestore.app/Contents/PlugIns/"
fi

echo "🔏 Clearing extended attributes and applying App Sandbox signatures..."
find build -name ".DS_Store" -delete 2>/dev/null || true
find build -type f -exec xattr -c {} + 2>/dev/null || true
dot_clean build 2>/dev/null || true
xattr -rc build 2>/dev/null || true

codesign -s - --force --entitlements entitlements.plist "build/RightClickRestore.app/Contents/PlugIns/RightClickRestore Extension.appex"

find build -name ".DS_Store" -delete 2>/dev/null || true
find build -type f -exec xattr -c {} + 2>/dev/null || true
dot_clean build 2>/dev/null || true
xattr -rc build 2>/dev/null || true

codesign -s - --force --entitlements entitlements.plist "build/RightClickRestore.app"

echo "🔌 Registering extension with PlugInKit & LaunchServices..."
pluginkit -a -e use -i com.antigravity.RightClickRestore.Extension "build/RightClickRestore.app/Contents/PlugIns/RightClickRestore Extension.appex" 2>/dev/null || true
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f -R -trusted build/RightClickRestore.app 2>/dev/null || true

echo ""
echo "✅ Build & Registration Succeeded!"
echo "📦 App built at: $(pwd)/build/RightClickRestore.app"
