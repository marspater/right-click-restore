## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Dynamic ARIA Feedback & Footer Shortcut Affordance (`src/popup/App.svelte`)**:
   - Added `forceUnlockAriaLabel` derived property to reflect the Force Unlock button's exact state (`unlocking`, `success`, `error`, inactive site) in its `aria-label` and `title` attributes.
   - Clarified the footer shortcut tip to include both `<kbd>⇧ Shift</kbd>` and `<kbd>⌥ Option</kbd>` keycaps, aligning visually with the feature toggle subtext.
   - Added status-aware opacity dimming to the footer shortcut tip when protection or modifier key bypass is disabled to communicate shortcut availability clearly.
