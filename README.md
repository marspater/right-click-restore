# RightClickRestore for Safari 🛡️

[![CI](https://github.com/marspater/right-click-restore/actions/workflows/ci.yml/badge.svg)](https://github.com/marspater/right-click-restore/actions/workflows/ci.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=marspater_right-click-restore&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=marspater_right-click-restore)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/Platform-macOS%2012%2B%20%7C%20macOS%2027-purple.svg)](README.md#compatibility--system-requirements)
[![Safari: MV3](https://img.shields.io/badge/Safari-MV3-blue.svg)](README.md)

A high-performance Safari Web Extension and native companion application for macOS that restores context menus, text selection, copy, cut, and drag operations on websites that deliberately disable them.

---

## Compatibility & System Requirements

| Platform | Minimum Version | Tested & Verified | Design & HIG Target |
| :--- | :--- | :--- | :--- |
| **macOS** | macOS 12.0 (Monterey) | macOS 14 (Sonoma), macOS 15 (Sequoia) | **macOS 27 Liquid Glass HIG** (Continuous Sheen & Vibrancy) |
| **Architecture** | Universal | Apple Silicon (`arm64`), Intel (`x86_64`) | Optimized for Apple M-series chips |
| **Safari** | Safari 15.0+ | Safari 17, Safari 18, Technology Preview | Manifest V3 (Main World & Isolated World) |

---

## macOS 27 & Apple HIG Design System

RightClickRestore adopts the forward-looking **macOS 27** Apple Human Interface Guidelines:
- **Liquid Glass UI**: Ultra-refined backdrop blur, specular top glass highlight, and ambient fluid mesh gradient lighting.
- **Continuous Curvature Squircles**: Icons and panels rendered with mathematical squircles and transparent corners.
- **Native System Vibrancy**: Adapts seamlessly to macOS Light and Dark appearance with automatic contrast balancing.
- **Zero Idle Overhead**: Pure event-driven DOM unmasking with no continuous polling or CPU spikes.

---

## What it does

- **Restores Right-Click**: Eliminates `oncontextmenu="return false;"` and JavaScript `preventDefault()` / `stopPropagation()` cancellations in both capture and bubble phases.
- **Restores Selection & Copy**: Unblocks `user-select: none`, `onselectstart`, `oncopy`, `oncut`, and `onbeforecopy`.
- **Anti-Shield Protection**: Dynamically disables invisible transparent overlays swallowing mouse clicks above images and videos without breaking web layouts.
- **Editor & Video Protection**: Intelligently safeguards interactive elements (`input`, `textarea`, `button`, Monaco Editor, ProseMirror, and HTML5 / YouTube video players).
- **Global & Per-Domain Controls**: Disable restoration per site or toggle features individually via the Svelte 5 popup.
- **Force Unlock**: One-click nuclear unlock button for extreme obfuscation cases.
- **Bounded DOM Observer**: Batched mutation processing prevents memory leaks on high-churn single-page applications.

---

## macOS installation

### Normal distribution

For a public release, distribute the signed and notarized `RightClickRestore.app` as a ZIP or through the Mac App Store. Safari requires a containing macOS app for a Safari Web Extension, and Apple recommends signing the extension and containing app for distribution.

1. Open the distributed `RightClickRestore.app`.
2. Safari opens the extension preferences when requested by the app.
3. Enable **RightClickRestore** in Safari → Settings → Extensions.
4. Grant the extension website access when Safari asks for it.
5. Open the extension from Safari's toolbar to configure global or per-site behavior.

### Local development

Unsigned macOS Safari Web Extensions are supported for development/testing only.

```bash
ALLOW_UNSIGNED=1 ./build.sh
open build/RightClickRestore.app
```

Then enable Safari's unsigned-extension development mode and turn on RightClickRestore in Safari → Settings → Extensions.

### Developer ID release

Set your Apple Developer Team ID and run:

```bash
DEVELOPMENT_TEAM=YOUR_TEAM_ID bash scripts/release-macos.sh
```

The script builds the web-extension resources first, creates a Release app, verifies the signed bundle, and produces `build/RightClickRestore-macOS.zip`.

Before distributing it, notarize and staple the app using Apple's `notarytool`/`stapler` workflow.

## Development

Install dependencies and run the checks:

```bash
bun install
bun run check
bun test
```

Build extension resources:

```bash
bun run build
```

Build the complete macOS app:

```bash
ALLOW_UNSIGNED=1 ./build.sh
```

Open the Xcode project when working on the native wrapper:

```bash
open SafariExtension/RightClickRestore/RightClickRestore.xcodeproj
```

## Test page

`test_page.html` contains blocker scenarios for inline `contextmenu`, event listeners, capture-phase cancellation, CSS selection blocking, copy/selection handlers, and transparent overlays.

Open it with:

```bash
open -a Safari test_page.html
```

## Architecture

```text
src/
├── background/       Safari MV3 service worker
├── content/          Isolated-world DOM cleanup and settings bridge
├── page-script/      Main-world event/prototype restoration
├── popup/            Svelte 5 settings UI
├── shared/           Shared settings/domain logic
└── manifest.json     Safari Web Extension manifest

SafariExtension/
└── RightClickRestore/  Native macOS companion app and extension target
```

The build pipeline compiles the web extension into the Safari extension's `Resources` directory before Xcode embeds it. This prevents the common failure mode where Xcode packages stale JavaScript from a previous build.

## Notes

RightClickRestore intentionally avoids trying to defeat every possible web application abstraction. Sites using isolated browsing contexts, browser-protected UI, cross-origin frames without extension access, or custom rendering can still impose limits that an ordinary Safari Web Extension cannot bypass.
