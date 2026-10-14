#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

APP_NAME="RightClickRestore"
SCHEME="RightClickRestore (macOS)"
BUILD_DIR="$ROOT_DIR/build"
CONFIGURATION="${CONFIGURATION:-Release}"

command -v xcodebuild >/dev/null || { echo "xcodebuild is required." >&2; exit 1; }
command -v bun >/dev/null || { echo "Bun is required to build the web extension." >&2; exit 1; }

if [[ "${ALLOW_UNSIGNED:-0}" == "1" ]]; then
  SIGNING_ARGS=(CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO)
else
  : "${DEVELOPMENT_TEAM:?Set DEVELOPMENT_TEAM for a signed build, or ALLOW_UNSIGNED=1 for development}"
  CODE_SIGN_IDENTITY="${CODE_SIGN_IDENTITY:-Developer ID Application}"
  SIGNING_ARGS=(
    DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM"
    CODE_SIGN_STYLE=Manual
    CODE_SIGN_IDENTITY="$CODE_SIGN_IDENTITY"
    CODE_SIGNING_REQUIRED=YES
    CODE_SIGNING_ALLOWED=YES
  )
fi

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "🔧 Building web extension resources..."
bun install --frozen-lockfile --ignore-scripts
bun run build

echo "🔨 Building $APP_NAME for macOS..."
xcodebuild \
  -project "$ROOT_DIR/SafariExtension/RightClickRestore/RightClickRestore.xcodeproj" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination 'platform=macOS' \
  "${SIGNING_ARGS[@]}" \
  CONFIGURATION_BUILD_DIR="$BUILD_DIR" \
  build

APP_PATH="$BUILD_DIR/$APP_NAME.app"
APPEX_PATH="$APP_PATH/Contents/PlugIns/$APP_NAME Extension.appex"

mkdir -p "$APP_PATH/Contents/PlugIns"
if [[ -d "$BUILD_DIR/$APP_NAME Extension.appex" ]] && [[ ! -d "$APPEX_PATH" ]]; then
  cp -R "$BUILD_DIR/$APP_NAME Extension.appex" "$APP_PATH/Contents/PlugIns/"
fi

if [[ ! -d "$APP_PATH" ]]; then
  echo "Build failed: $APP_PATH was not produced." >&2
  exit 1
fi
if [[ ! -d "$APPEX_PATH" ]]; then
  echo "Build failed: embedded Safari extension is missing." >&2
  exit 1
fi

# Clean extended attributes
find "$BUILD_DIR" -name ".DS_Store" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -exec xattr -c {} + 2>/dev/null || true
dot_clean "$BUILD_DIR" 2>/dev/null || true
xattr -rc "$BUILD_DIR" 2>/dev/null || true

if [[ "${ALLOW_UNSIGNED:-0}" == "1" ]]; then
  echo "🔏 Applying ad-hoc signature for local development..."
  if [[ -f "$ROOT_DIR/entitlements.plist" ]]; then
    codesign -s - --force --entitlements "$ROOT_DIR/entitlements.plist" "$APPEX_PATH"
    codesign -s - --force --entitlements "$ROOT_DIR/entitlements.plist" "$APP_PATH"
  else
    codesign -s - --force "$APPEX_PATH"
    codesign -s - --force "$APP_PATH"
  fi
  # Register only the installed app; registering build copies creates duplicate Safari entries.
  echo "⚠️ Unsigned development build ready. Enable Safari's unsigned extension development mode to test it."
else
  echo "🔏 Validating signed app bundle..."
  codesign --verify --deep --strict --verbose=2 "$APP_PATH"
  spctl --assess --type execute --verbose=2 "$APP_PATH"
fi

codesign --verify --strict "$APPEX_PATH"
codesign --verify --strict "$APP_PATH"

# Xcode automatically registers macOS build products. Keep the installed copy
# as Safari's sole registration, unless explicitly testing the development copy.
INSTALLED_APP="/Applications/$APP_NAME.app"
if [[ "${REGISTER_BUILD_APP:-0}" != "1" && -d "$INSTALLED_APP" ]]; then
  BUILT_ID="$(plutil -extract CFBundleIdentifier raw "$APP_PATH/Contents/Info.plist")"
  INSTALLED_ID="$(plutil -extract CFBundleIdentifier raw "$INSTALLED_APP/Contents/Info.plist")"
  if [[ "$BUILT_ID" == "$INSTALLED_ID" ]]; then
    codesign --verify --strict "$INSTALLED_APP"
    if pluginkit -m -A -D -v | grep -Fq -- "$APPEX_PATH"; then
      pluginkit -r "$APPEX_PATH"
    fi
    /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -u "$APP_PATH"
  fi
fi

echo ""
echo "✅ Build succeeded"
echo "📦 App: $APP_PATH"
