# Verification — 2026-10-05

Source: `mars/fix-media-unlock-icons`, based on `1197a5f`. At the initial fetch, HEAD and origin/main matched; no rebase was needed.

## Verified

- `bun test`: 100 passing tests, 0 failures, 254 assertions.
- `bun run check` and `git diff --check`: pass.
- Browser TypeScript source: passes a scoped strict compiler check. The project-wide command still lacks Node/Bun type declarations for scripts/build.ts.
- Bundled runtime regression: Force Unlock receives `unlocked`, activates restoration on a disabled page, removes inline media cancellation inside player wrappers, preserves normal player-control and input events, supports modifier context-menu bypass, and restores the original overlay pointer-event value and priority after repeated hover events.
- Safari controlled page using compiled scripts and a mock extension-message receiver: Force Unlock returned `unlocked`; page cancellation reported `false`; Safari displayed Copy Video Address, Open Video in New Tab, Download Video, and Picture in Picture over a covered video. This is native WebKit/menu proof, not proof of Safari's extension messaging or every third-party player.
- Icon Composer: nine artwork layers in four visible material groups, including three aligned cursor layers with a smooth glass face and soft highlights. Default and Dark native previews inspected. Deep teal/aqua palette follows the Freeform reference. The main pointer tip preserves the user's saved placement (approximately +91.3, +98.1 points); separated detail layers were realigned. Nested pointer bevels were removed; menu labels use thicker high-contrast pale aqua strokes. The front menu remains centered at (512, 512).
- Final macOS Release build: succeeds; arm64 executable; host and embedded extension pass strict ad-hoc signature verification. Packaged manifest and all extension-listing icons match source exports.
- Build-registration cleanup regression: with external commands mocked, matching installed bundle IDs target only the build app and embedded extension; different IDs and explicit development registration preserve the build copy.

## Delivery boundary

Installed `/Applications/RightClickRestore.app` version 1.0.1 (build 2), arm64, with strict host/extension signature verification. Native window opened successfully. Installed manifest and every referenced toolbar/listing/popup PNG match source; onboarding uses the identical canonical 256px artwork. Safari reports exactly one extension registration at the installed path.

The old app is archived at `/var/folders/fc/b0x0f7mn6nb3t569ndhgvkyr0000gn/T/rightclick-install-z7u8lleu/RightClickRestore-previous.zip`. Removed the repository build directory and the Xcode DerivedData directory whose WorkspacePath matched this project. No app-specific Library/Caches directory was found. Registration was refreshed; global icon caches, Safari session, preferences, and browsing data were preserved.

Safari toolbar uses the transparent menu-and-pointer template at 16/32/64 pixels; all full-color surfaces derive from RestoreIcon.icon. Toolbar glyph inspected on white; final Safari toolbar rendering and actual popup-to-content messaging on third-party sites remain unverified. No commit, push, or main-branch change was made.

## Editable icon

Assets/RestoreIcon.icon is the native source. Run `swift scripts/render_icons.swift` to regenerate app raster fallbacks, onboarding artwork, popup/toolbar artwork, and the fallback ICNS. The macOS target compiles the native document directly.
