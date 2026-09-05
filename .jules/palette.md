# Palette UI/UX Journal

## 2025-02-23 - Keycap Visual Hierarchy & Tactile Contrast Enhancement

### What was changed
- Refined the CSS styling for `<kbd>` keycap elements in `src/popup/popup.css`.
- Added a subtle 3D keycap effect using vertical linear gradients, crisp 1px borders, and soft bottom drop shadows with top inner highlights.
- Improved light and dark mode color contrast for shortcut keys (`Shift`, `Option`, `⌘C`) so key cap badges stand out naturally in the popup settings interface and footer hint.

### Why
- Keycap elements (`<kbd>`) were previously rendered as simple flat rectangles with low contrast background and border values.
- Providing visual depth and clear typography makes keyboard shortcuts immediately recognizable as interactive keypress hints, improving overall affordance, readability, and visual polish consistent with standard macOS UI design tokens.
