## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Dynamic Contextual Guidance & Switch Control Affordances (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Made footer helper guidance dynamic so it accurately reflects current toggle states (paused extension, domain-disabled status, or disabled modifier key bypass setting).
   - Refined non-domain / internal page label in domain inset card to show "Active Page" instead of "Active on Domain".
   - Added explicit disabled styling (`input:disabled + .apple-slider`, `.apple-switch:has(input:disabled)`) for `.apple-switch` controls to ensure accurate cursor and track opacity feedback.
