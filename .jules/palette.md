# Palette 🎨 - UI/UX Journal

## 2025-09-09 - Extension Popup Visual Status & Interaction Polish

### Observation
In the popup interface, several subtle UI/UX affordance and state communication gaps were present:
1. When protection was disabled on a specific domain (`isSiteDisabled`), the status beacon dot defaulted to the same gray color as when the entire extension was paused globally.
2. Setting rows continued displaying a pointer cursor (`cursor: pointer`) on hover even when their nested toggle inputs were disabled.
3. Keyboard focus navigation on setting rows created a double-focus outline (both on `.settings-row` and on the nested `.apple-slider`).
4. The "Force Unlock Page" action button retained click scale transitions when disabled and lacked distinct cursor affordances in disabled/active states.

### Changes Implemented
1. **Domain Status Beacon Distinction**: Updated status beacon logic in `App.svelte` so Active on Domain displays green (`var(--accent-green)`), Disabled on Domain displays orange (`var(--accent-orange)`), and Extension Paused displays muted gray (`var(--text-tertiary)`).
2. **Disabled Cursor & Hover Affordances**: Added `.is-disabled` class styling and `aria-disabled` attributes to setting rows in `App.svelte` and `popup.css`, applying `cursor: not-allowed` and disabling hover background changes when inactive.
3. **De-duplicated Focus Rings**: Added CSS rule preventing duplicate focus outlines on `.apple-slider` when `.settings-row` receives keyboard focus (`:focus-visible`).
4. **Action Button Polish**: Scoped active scale transforms and cursor styles on the "Force Unlock Page" button to active states, ensuring clear non-interactive feedback when disabled.

### Verification
- Ran `bun run check` and verified Biome formatting.
- Executed `bun test` passing all test suites.
