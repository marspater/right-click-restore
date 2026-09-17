## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Header App Icon Status Dynamics & Screen Reader Status Announcements (`src/popup/App.svelte`, `src/popup/popup.css`)**:
   - Added smooth visual state feedback to the top header app icon: vibrant Apple blue gradient when protection is active, transitioning to a desaturated gray state when extension protection is globally paused.
   - Expanded live region announcements (`statusAnnouncement`) so screen reader users receive real-time voice feedback when toggling global protection, domain protection, or individual shield features.
   - Refined disabled toggle switch affordances (`.apple-switch input:disabled + .apple-slider`) with explicit `opacity: 0.45` and `cursor: not-allowed` states.
