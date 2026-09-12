# Palette 🎨 - UI/UX Enhancement Journal

## Run 1 - Domain Card Interaction & Visual Affordance Polish

### Observation
In the popup interface, the Active Domain Card was a static `<section>` element wrapping a small 32x18px toggle switch. While the feature list items below it (`settings-row`) were full-width interactive row elements (`<label>`) with clear hover background highlights, cursor affordances, active state feedback, and `:focus-within` accessibility outlines, the Domain Card lacked these affordances. Users had to click directly on the small switch knob, creating unnecessary click target precision friction. Additionally, the header shield icon remained styled with full active blue gradient even when protection was globally disabled.

### Rationale & Solution
- Converted the Active Domain Card into an interactive row (`<label class="glass-card domain-card-row">`) when site protection toggling is available.
- Added `.domain-card-row` hover highlights (`var(--bg-card-hover)`), pointer cursor, active click feedback (`opacity: 0.85`), and keyboard focus rings (`:focus-within`) in `popup.css`.
- Updated the header shield icon container to dynamically transition between the active blue gradient and a muted badge style when global protection is toggled on/off.
- Preserved screen reader semantics (`role="switch"`, `aria-label`, `aria-disabled`) and prevented duplicate focus rings when focusing the input switch via keyboard.
