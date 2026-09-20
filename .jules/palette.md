## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Glass Card Focus Affordance & Feedback State Contrast (`src/popup/App.svelte`, `src/popup/popup.css`)**:
   - Added container `:focus-within` visual focus ring on `.glass-card` elements so keyboard users clearly see which section card is currently focused.
   - Refined Force Unlock button feedback state handling (`aria-disabled`) to maintain bright green/red status styling and bold white text without browser-native button dimming during status notifications.
   - Updated footer shortcut hint to display both `<kbd>⇧ Shift</kbd>` and `<kbd>⌥ Option</kbd>` keycaps, aligning with the "Modifier Key Bypass" feature capabilities.
