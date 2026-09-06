# Palette Journal 🎨

## 2025-05-18: Enhanced Domain-Disabled UI State & Feedback in Extension Popup

### Overview
- Updated the Svelte popup interface (`src/popup/App.svelte`) to accurately derive and display the active protection state for both global extension toggles and per-domain toggles.
- Added a subtle amber status alert badge ("Protection is paused on {domain}") when extension protection is disabled for the current site.
- Dynamically dimmed and disabled feature checkboxes and the "Force Unlock Page" button when protection is inactive on the site (`!isSiteActive`).
- Improved accessibility with explicit `aria-disabled` attributes and `cursor-not-allowed` styles on feature labels.

### Rationale & UX Impact
- **State Clarity**: Previously, toggling protection off for a specific site marked the domain card as "Disabled on Domain", but left all individual feature toggles visually active and clickable. This caused user confusion about whether features were running on that domain.
- **Friction Reduction**: Disabling interactable controls when site protection is off prevents inadvertent state changes and accurately communicates the extension's operating context.
- **Accessibility**: Added screen-reader accessible attributes (`aria-disabled`) and clear visual cursor cues for disabled states.
