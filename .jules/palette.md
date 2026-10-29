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

6. **Domain Inset Card Tap Target Expansion & Container Focus (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Converted Active Domain Inset Card into an interactive `<label>` row when `isToggleableDomain` is active, expanding the tap target from the small switch to the full card (Fitts's Law) and matching setting row interaction patterns.
   - Added subtle status beacon scale transitions (`transform: scale(1.2)`) on hover and unified container focus rings via `.domain-card:has(input:focus-visible)` while suppressing duplicate inner switch focus outlines.

7. **Apple Switch Affordances & Icon Entrance Micro-Animations (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Added explicit disabled cursor (`cursor: not-allowed`) and dimmed track opacity (`0.45`) for `.apple-switch` controls when disabled, preventing confusing pointer cursors on inactive controls.
   - Added tactile active press response (`transform: scale(0.92)`) for setting row icon badges to complement the scale-up on hover/focus.
   - Introduced a springy pop-in entrance micro-animation (`@keyframes popIn`) for the Force Unlock status icons upon success or error, offering responsive visual feedback.
   - Added subtle theme-aware hover brightness adjustments on active Apple switch tracks for polished tactile depth.

8. **Tactile Card Press Feedback, Icon Hover Micro-Interactions & Disabled Row Tooltips (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Added `.domain-card:active:not(.dimmed)` scale (`scale(0.99)`) and press opacity (`0.88`) transition to give tactile click feedback on the domain card matching setting row interaction patterns.
   - Added a hover/focus icon rotation and scale micro-interaction (`.force-unlock-icon`) on the Force Unlock button for playful interactive affordance.
   - Added contextual `title` tooltips (`title={isSiteActive ? undefined : 'Protection is inactive on this page'}`) to feature setting rows so users hovering over dimmed controls receive immediate feedback on why features are disabled.
   - Added interactive shortcut button to enable Modifier Key Bypass from the footer tip when disabled.

9. **Restricted System Page Context Handling & Visual Balance (`src/popup/App.svelte`)**:
   - Refined `isSiteActive` derived calculation to require `isToggleableDomain` so internal browser/system tabs (e.g. `Safari Page`, `Active Page`, internal browser settings) do not claim active shield protection or show misleading pulsing green beacon dots.
   - Updated the non-toggleable domain card view to explicitly display "System / Restricted Page" status tag with neutral status indicators and "Global Protection" badge.
   - Enhanced Force Unlock button tooltips and footer tip messages on non-supported pages to clearly announce "Protection is unavailable on system pages".

10. **Unblur Videos Setting Row Consistency & Tactile Press Micro-Interactions (`src/popup/App.svelte` & `src/popup/popup.css`)**:
   - Added `setting-icon-badge` class and `title={isSiteActive ? undefined : 'Protection is inactive on this page'}` tooltip attribute to the "Unblur Videos" row in `App.svelte`, restoring full visual and interaction consistency across all 6 setting rows.
   - Replaced fragile `.settings-row .w-6` CSS rules with targeted `.settings-row .setting-icon-badge` selectors in `popup.css`.
   - Added physical tactile press response (`transform: scale(0.99)`) to `.settings-row:active:not(.is-disabled)` and subtle hover scale transitions to keycap badges (`<kbd>`).

11. **Context-Aware Disabled Tooltips & Pointer Affordances (`src/popup/App.svelte` & `src/popup/popup.css`)**:
- Replaced generic "Protection is inactive on this page" tooltip text across setting rows with a derived, context-aware `disabledRowTooltip` variable that explicitly states why controls are disabled (`Extension is paused globally`, `Protection is unavailable on system pages`, or `Protection is disabled on this domain`).
- Refined `.dimmed` state CSS in `popup.css` by removing `pointer-events: none` and setting `cursor: not-allowed`, allowing desktop browser tooltips to trigger reliably on hover and giving immediate cursor feedback on disabled cards/rows.

12. **Dimmed Row Tooltip Discoverability & Non-Interactive Card Scoping (`src/popup/popup.css`)**:
- Scoped domain card hover (`scale(1.2)` on beacon) and click press (`scale(0.99)`) CSS selectors strictly to interactive cards (`label.domain-card`), preventing static system/restricted page header cards from triggering misleading press feedback.
- Refined `.dimmed:not(.glass-card)` to scope `cursor: not-allowed` without blocking row tooltips.

13. **Keyboard Focus Retention, Header Visual Feedback & Restricted Badge Tooltips (`src/popup/App.svelte` & `src/popup/popup.css`)**:
- Switched Force Unlock button during unlocking state from HTML `disabled` to `aria-disabled`, ensuring keyboard focus isn't involuntarily dropped during unlocking.
- Added `if (!activeTabId || !isSiteActive || unlockStatus !== 'idle') return;` check in `forceUnlockPage` to prevent redundant triggers while unlocking or when protection is inactive.
- Added smooth grayscale transition (`grayscale opacity-60`) to the header extension logo icon when global protection is disabled.
- Added explanatory `title="Per-site toggling is unavailable for system and local pages"` tooltip to the "Global Protection" badge on system and local pages.
- Updated button icon micro-interaction hover CSS selectors to exclude `[aria-disabled="true"]`.

14. **Apple Inset Divider Alignment & Setting Icon Micro-Interactions (`src/popup/App.svelte` & `src/popup/popup.css`)**:
- Adjusted `.settings-divider` margin from `0 8px` to `0 8px 0 42.5px`, aligning setting list dividers with the title text column in accordance with Apple Inset Grouped List design guidelines and eliminating visual clutter across the icon column.
- Added SVG icon hover/focus micro-interactions (`.settings-row:hover:not(.is-disabled) .setting-icon-badge svg`) for refined tactile feedback on setting rows.
- Added `id="desc-domain-status"` and `aria-describedby="desc-domain-status"` to the domain status stack and domain checkbox switch input in `App.svelte` for enhanced screen reader accessibility.

15. **Subtext Inline Keycap Badges, App Icon Polish & Domain Tooltip Context (`src/popup/App.svelte` & `src/popup/popup.css`)**:
- Added inline keycap badges (`<kbd class="kbd-subtext">`) to shortcut key mentions (`⌘C`, `⇧ Shift`, `⌥ Option`) in setting row subtexts for "Allow Selection & Copy" and "Modifier Key Bypass", creating consistent keycap typography across the popup UI.
- Styled `.kbd-subtext` in `popup.css` for compact 9px inline scaling with soft drop shadows and clean baseline alignment.
- Enhanced header extension app icon with `rounded-[6px]`, subtle drop shadow (`shadow-[0_1px_3px_rgba(0,0,0,0.12)]`), and a smooth hover scale micro-interaction (`hover:scale-105`).
- Added contextual `title` hover tooltips to the domain card when extension protection is paused globally.

16. **Footer Tip Keycap Badge Typography & Action Button Cursor Affordances (`src/popup/App.svelte`)**:
- Applied `.kbd-subtext` inline keycap styling to shortcut key mentions (`⇧ Shift`, `⌥ Option`) in footer tip text, ensuring consistent keycap typography and baseline alignment across setting subtext and footer tip regions.
- Refined Force Unlock button cursor states (`cursor-wait` during unlocking, `cursor-default` during success/error status messages, `cursor-pointer` when active and idle, and `cursor-not-allowed` when inactive), delivering precise cursor feedback matching action status.
