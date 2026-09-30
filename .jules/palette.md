## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Dynamic Context-Aware Footnote & Interactive Accessibility (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Updated footer tip logic to display "Extension is paused globally" or "Protection is disabled on this domain" when shield is inactive, avoiding misleading bypass advice on pages where context menus work natively.
   - Made Force Unlock button `aria-label` dynamic (`Unlocking current page`, `Page unlocked successfully`, `Unable to unlock current page`, or inactive state) so screen reader users receive clear, real-time status updates when focused on the button.
   - Refined Master switch and Domain switch `title` and `aria-label` properties to dynamically describe actions ("Enable/Disable protection globally", "Enable/Disable protection on {hostname}").
   - Introduced theme-aware `--beacon-green-glow` and `--beacon-orange-glow` variables for status dot shadows in light/dark modes and tightened typography spacing in the domain stack (`mt-0.5`).
