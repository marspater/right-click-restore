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
   - Preserved stable accessible switch names (`aria-label="Protection globally"`, `aria-label="Protection on {hostname}"`) with state announced via `role="switch"` and `aria-checked`, keeping action verbs in visual `title` tooltips.
   - Introduced an `aria-live="polite"` status region for Force Unlock dynamic announcements without mutating labels on disabled buttons.
   - Introduced theme-aware `--beacon-green-glow` and `--beacon-orange-glow` variables for status dot shadows in light/dark modes and tightened typography spacing in the domain stack (`mt-0.5`).

5. **Force Unlock State Feedback & Setting Row Micro-Interactions (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Refined the Force Unlock button with a dedicated active unlocking state (`bg-[var(--bg-badge-active)] text-[var(--accent-blue)] disabled:opacity-100`) that prevents spinner/text dimming while page unlocking is in progress.
   - Added smooth scale micro-interaction transitions (`transform: scale(1.05)`) on setting row icon badges upon hover/focus for refined affordance and tactile feel.
   - Maintained an `aria-live="polite"` screen reader region for status announcements.

6. **Focus Ring Contour Alignment & Button Micro-Interaction Polish (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Upgraded keyboard focus state definitions across `.apple-switch`, `button`, and `.settings-row` from blocky rectangular CSS `outline` to rounded `box-shadow` rings (`0 0 0 2px var(--bg-popover), 0 0 0 4px var(--accent-blue)`), preserving exact border-radius contours for capsule switches, action buttons, and inset settings cards.
   - Added a subtle scale micro-interaction (`group-hover:scale-110`) on the Force Unlock lightning icon for responsive tactile feedback on hover, mirroring setting row badge behaviors.

