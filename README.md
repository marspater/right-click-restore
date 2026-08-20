# Right Click & Selection Restorer for Safari 🛡️🖱️

A powerful native Safari extension for macOS and iOS that restores right-click context menus, text selection, copy/paste, and dragging on websites that attempt to disable or block them.

---

## ✨ Features

- **🔓 Restore Right Click**: Defeats inline `oncontextmenu="return false;"`, event-listener based `preventDefault()`, and script blocks.
- **📝 Text Selection & Copy**: Re-enables text highlighting, selection, and keyboard copying (`⌘C` / `Ctrl+C`) by overriding `user-select: none !important;`, `onselectstart`, and `oncopy` blockers.
- **🛡️ Anti-Shield Layer**: Automatically identifies and neutralizes transparent overlay `<div>` blockers placed over web content.
- **⚡ Absolute Force Mode**: Overrides DOM prototypes (`EventTarget.prototype.addEventListener`, `Event.prototype.preventDefault`, `Window/Document/HTMLElement` property descriptors) so aggressive scripts cannot hijack context menus.
- **⌨️ Instant Hardware Bypass**: Hold <kbd>Shift</kbd> or <kbd>Option</kbd> while right-clicking anywhere to immediately bypass page scripts and summon the native menu.
- **🌐 Per-Site Controls & Whitelist**: Toggle protection globally or disable it for specific web apps (such as Figma, Canva, or Google Docs).
- **🍎 Apple Human Interface Design**: Clean macOS Cupertino popup interface with smooth iOS switches and Dark Mode support.

---

## 🚀 Quick Start & Enabling in Safari

### Step 1: Enable Developer Features in Safari
1. Open **Safari**.
2. Open Safari Settings: press <kbd>⌘</kbd> + <kbd>,</kbd> (or go to **Safari** → **Settings...** in the menu bar).
3. Select the **Advanced** tab.
4. Check **"Show features for web developers"** (or *"Show Develop menu in menu bar"* in older macOS).

### Step 2: Allow Unsigned Extensions
1. In the macOS top menu bar, click on **Develop**.
2. Check **"Allow Unsigned Extensions"** (Safari may prompt for your Mac password/Touch ID to enable developer mode).

### Step 3: Launch the App & Turn on Extension
1. Open the companion app in Terminal:
   ```bash
   open build/RightClickRestore.app
   ```
   *(Or click "Open in Safari Extensions Preferences..." in the app window).*
2. In Safari, go to **Settings** → **Extensions**.
3. Check the box next to **Right Click & Selection Restorer**.
4. Set permissions to **"Always Allow on Every Website"** so the extension can restore context menus on all pages.

---

## 🧪 Testing the Extension

We have included a comprehensive interactive test page: [`test_page.html`](file:///Users/marspater/Documents/antigravity/wise-carson/test_page.html).

To test:
1. Open `test_page.html` in Safari:
   ```bash
   open -a Safari test_page.html
   ```
2. Try right-clicking and selecting text across all 6 test scenarios:
   - **Test 1**: Inline `oncontextmenu="return false;"`
   - **Test 2**: `addEventListener('contextmenu', e => e.preventDefault())`
   - **Test 3**: Capture-phase event cancellation
   - **Test 4**: CSS `user-select: none !important`
   - **Test 5**: `selectstart` & `copy` event blockers
   - **Test 6**: Transparent overlay click shields

---

## 🛠️ Project Structure

```
wise-carson/
├── build/                                    # Compiled macOS Application (.app)
│   └── RightClickRestore.app
├── extension/                                # Safari Web Extension source files
│   ├── manifest.json                         # Manifest V3 configuration
│   ├── content.js                            # Content script (DOM sanitization & overlay removal)
│   ├── page-script.js                        # MAIN-world script (prototype & event neutralization)
│   ├── content.css                           # User-select & touch-callout override styles
│   ├── background.js                         # Service worker for settings & badge updates
│   ├── popup/                                # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── icons/                                # App & toolbar icons (16px to 512px)
├── SafariExtension/                          # Xcode wrapper project
│   └── RightClickRestore/
│       ├── RightClickRestore.xcodeproj       # Universal Xcode project (macOS + iOS)
│       ├── macOS (App)/
│       └── Shared (Extension)/
├── build.sh                                  # Build script for macOS
└── test_page.html                            # Interactive blocker test suite
```

---

## 🔨 Rebuilding the Project

If you make modifications to the extension scripts in `extension/`, recompile the app with:

```bash
./build.sh
```

Or open the project in Xcode:

```bash
open SafariExtension/RightClickRestore/RightClickRestore.xcodeproj
```
