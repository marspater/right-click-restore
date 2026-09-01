# Palette Journal

## 2025-05-18 - Popup Interactivity, Light-Mode Contrast & Keyboard Accessibility Polish

### Summary of Changes
- **Clickable Feature Rows**: Converted all feature setting rows in `src/popup/App.svelte` into full-row `<label>` controls with `cursor-pointer`, expanding the hit/click target across the entire row (icon, title, description, and whitespace) rather than forcing clicks on the small toggle switch.
- **Light-Mode Contrast**: Adjusted feature icon text colors (`text-*-600 dark:text-*-400`) to guarantee high contrast and crisp legibility in light-mode backgrounds while retaining theme adaptiveness in dark mode.
- **Keyboard Focus States**: Added `:focus-visible` styling in `src/popup/popup.css` for `.apple-switch` inputs and action buttons (`outline: 2px solid var(--accent-blue)`), enabling clear visual feedback during keyboard navigation.
- **Screen Reader & ARIA Support**: Added descriptive `aria-label` attributes to popup toggles and `aria-live="polite"` to the "Force Unlock Page" button so screen readers broadcast status updates.
