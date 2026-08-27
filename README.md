# RightClickRestore for Safari 🛡️

A native Safari Web Extension for macOS and iOS that restores context menus, text selection, copy, and drag behavior on pages that deliberately disable them.

## What it does

- Restores right-click/context menus blocked by inline handlers and JavaScript event cancellation.
- Restores text selection, copy, cut, and drag operations where safe.
- Handles transparent media overlays without continuously rewriting the DOM.
- Keeps rich editors and controls such as inputs, buttons, ProseMirror, Monaco, and video players usable.
- Provides global and per-domain controls.
- Includes a manual **Force Unlock** action for pages that need an extra kick.
- Uses a bounded DOM observer to avoid unbounded mutation queues and long-lived timer buildup.

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
└── RightClickRestore/  Native macOS/iOS wrapper and extension targets
```

The build pipeline compiles the web extension into the Safari extension's `Resources` directory before Xcode embeds it. This prevents the common failure mode where Xcode packages stale JavaScript from a previous build.

## Notes

RightClickRestore intentionally avoids trying to defeat every possible web application abstraction. Sites using isolated browsing contexts, browser-protected UI, cross-origin frames without extension access, or custom rendering can still impose limits that an ordinary Safari Web Extension cannot bypass.
