## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Page Detection State & Unlocking Action Feedback (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Added initial tab loading detection state (`isTabLoading`) to display "Detecting Page…" with a neutral pulsing indicator, preventing layout flashes or misleading "Active on Domain" labels before tab info resolves.
   - Refined "Force Unlock Page" button state transitions using `aria-disabled` instead of hard disabling during non-idle states, preventing keyboard focus eviction for screen reader users and adding a subtle `animate-bounce-short` checkmark feedback animation.
   - Aligned footer hint keycaps to include `<kbd>⌥ Option</kbd>` alongside `<kbd>⇧ Shift</kbd>`, matching the "Modifier Key Bypass" toggle description for UI/UX consistency.
