#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

: "${DEVELOPMENT_TEAM:?Set DEVELOPMENT_TEAM to your Apple Developer Team ID}"
CODE_SIGN_IDENTITY="${CODE_SIGN_IDENTITY:-Developer ID Application}"

DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
CODE_SIGN_IDENTITY="$CODE_SIGN_IDENTITY" \
./build.sh

APP_PATH="$ROOT_DIR/build/RightClickRestore.app"
ZIP_PATH="$ROOT_DIR/build/RightClickRestore-macOS.zip"

rm -f "$ZIP_PATH"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "📦 Created: $ZIP_PATH"
echo ""
echo "Notarize with your configured notarytool keychain profile:"
echo "  xcrun notarytool submit \"$ZIP_PATH\" --keychain-profile <profile> --wait"
echo "  xcrun stapler staple \"$APP_PATH\""
echo "  xcrun stapler validate \"$APP_PATH\""
