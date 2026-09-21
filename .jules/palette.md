## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Active Domain Card Interactivity & Header Shield Visual State (`src/popup/App.svelte`, `src/popup/popup.css`)**:
   - Converted the domain status inset card into a full-card clickable `<label>` with hover fill and `:focus-within` focus ring to improve affordance and expand the click/tap target.
   - Updated header shield icon to transition between active gradient and desaturated muted badge when extension protection is paused.
   - Aligned footer shortcut tip to explicitly mention both Shift (⇧) and Option (⌥) modifier keys for native context menu bypass.
