# Palette Journal 🎨

## Entry: Popup Feature Toggle Interaction & Keyboard Focus Enhancement

- **Area Refined:** Extension popup UI (`src/popup/App.svelte`) & test suite assertion (`src/content/cleaner.test.ts`).
- **Changes Made:**
  - Added disabled binding `disabled={!settings.enabled}` to feature toggle inputs so feature inputs properly communicate disabled state when the global extension switch is OFF.
  - Added `focus-within:ring-2 focus-within:ring-blue-500/40` to feature item label containers for clear visual feedback during keyboard navigation via Tab.
  - Added disabled style state (`disabled:opacity-60 disabled:cursor-not-allowed`) to the Force Unlock button.
  - Fixed test mock expectation in `cleaner.test.ts` for happy-dom test runner compatibility.
- **User Impact:** Improves accessibility, keyboard navigation affordance, and clear state communication in the extension popover UI.
