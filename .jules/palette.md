## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Active Domain Inset Card Interaction Affordance (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Expanded active domain card hit target into a full-width interactive glass card (`glass-card-interactive`) with hover and focus-within feedback, enabling site domain protection toggling across the entire card area.
   - Aligned footer shortcut tip with Feature 5 settings by displaying both `<kbd>⇧ Shift</kbd>` and `<kbd>⌥ Option</kbd>` keycaps.
   - Enhanced switch focus state rings with dual-ring depth shadow matching WebKit design language.
