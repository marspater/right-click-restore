## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Dynamic Contextual Footer & Live Status Announcements (`src/popup/App.svelte`, `src/popup/popup.css`)**:
   - Made footer footnote tips contextual: when protection is inactive or when `Modifier Key Bypass` is disabled, the footer accurately instructs users or confirms inactive state rather than displaying an unhelpful/misleading shortcut tip.
   - Expanded live polite screen reader region (`role="status" aria-live="polite"`) to announce real-time state changes when flipping global, site-specific, or feature toggles.
   - Added explicit `overflow: hidden` on `.popover-root` to eliminate scrollbar/layout shift during switch state transitions.
