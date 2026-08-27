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
bun install --frozen-lockfile
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

if [[ ! -d "$APP_PATH" ]]; then
  echo "Build failed: $APP_PATH was not produced." >&2
  exit 1
fi
if [[ ! -d "$APPEX_PATH" ]]; then
  echo "Build failed: embedded Safari extension is missing." >&2
  exit 1
fi

if [[ "${ALLOW_UNSIGNED:-0}" == "1" ]]; then
  echo "⚠️ Unsigned development build requested. Enable Safari's unsigned extension development mode to test it."
else
  echo "🔏 Validating signed app bundle..."
  codesign --verify --deep --strict --verbose=2 "$APP_PATH"
  spctl --assess --type execute --verbose=2 "$APP_PATH"
fi

echo ""
echo "✅ Build succeeded"
echo "📦 App: $APP_PATH"
