# Palette Journal 🎨

## 2026-09-10 - Refine Extension Popup Active Feature States & Status Beacon Visual Hierarchy

### Context & Need
The popup interface uses an Apple-style macOS / iOS inset grouped glass layout. While switches correctly toggled features, active vs inactive feature rows looked visually uniform except for the switch state itself. Furthermore, when protection was paused specifically for the active domain (domain override), the status beacon defaulted to the same neutral text color as global pause, making domain-level state visually ambiguous.

### Changes Made
- Added `--bg-badge-active` design token in light/dark modes (`rgba(0, 122, 255, 0.12)` in light mode, `rgba(10, 132, 255, 0.2)` in dark mode).
- Highlighted feature icon badges with active accent colors (`bg-[var(--bg-badge-active)] text-[var(--accent-blue)]`) when protection is active and the specific feature toggle is enabled.
- Updated domain status beacon to render in `--accent-orange` when protection is disabled on the active domain, visually distinguishing domain-level overrides from globally paused state.
- Added `cursor: not-allowed` CSS affordance for disabled toggles and settings row containers when site protection is inactive.
- Removed redundant `aria-label` attributes on switch inputs nested within `<label class="settings-row">` elements to eliminate duplicated screen reader announcements.

### Key Takeaways
- Active component states (badges, icons) combined with switch positions provide double-encoding of system state without cluttering the UI.
- Color semantics (`--accent-green` for active, `--accent-orange` for domain override, `--text-tertiary` for global pause) significantly improve domain status discoverability at a glance.
