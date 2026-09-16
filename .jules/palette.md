## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `.settings-row` focus rules to use `:has(input:focus-visible)` instead of `:focus-within`, eliminating flash focus outlines on pointer clicks while preserving clean focus-visible rings for keyboard navigation.

3. **Footer Shortcut Hint & Keycap Polish (`src/popup/App.svelte`)**:
   - Expanded the footer footnote tip to explicitly include both bypass keycaps (`<kbd>⇧ Shift</kbd> or <kbd>⌥ Option</kbd>`), ensuring consistency with the "Modifier Key Bypass" setting description and improving shortcut discoverability.
   - Refined tip wording to fit single-line horizontal layout perfectly inside the fixed-width popup popover.
