# Palette 🎨 UI/UX Journal

## Entry 1 - Popup UI Polish & Accessibility Enhancements

### Context
The popover UI provides controls for global protection, per-domain toggling, key features, and manual force unlocking.

### Changes Made
1. **Active Protection Status Beacon**:
   - Added a pulsing glow ring (`animate-ping` with `opacity-35`) and drop shadow (`shadow-[0_0_6px_rgba(52,199,89,0.5)]`) to the active green status beacon in the active domain card.
   - Provides clear, tactile feedback when shield protection is live on the current site.

2. **Native Toggle Switch Physics**:
   - Added active state scaling physics on `.apple-slider:before` (`width: 21px` / `17px` for small switches on `:active`).
   - Replicates authentic macOS / iOS System Settings fluid toggle knob expansion when pressed.

3. **Keyboard Accessibility & Focus States**:
   - Added `.settings-row:has(input:focus-visible)` full-row focus highlights.
   - When tabbing through feature options, the entire row highlights with an subtle focus ring outline and hover background, making keyboard navigation clear.

4. **Screen Reader Accessibility & Force Unlock Live Region**:
   - Cleaned up screen reader semantics for nested input labels.
   - Introduced a dedicated `role="status" aria-live="polite"` region for Force Unlock action feedback ("Unlocking current page...", "Page unlocked successfully", "Unable to unlock current page").

5. **State Safety**:
   - Updated Force Unlock button disabled condition (`unlockStatus !== 'idle' || !isSiteActive`) to prevent double-clicks during status animations.
   - Added unmount timer cleanup in `App.svelte` `$effect` to prevent memory/timeout leaks.
