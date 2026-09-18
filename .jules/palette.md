## 🎨 Palette Journal - UI/UX & Accessibility Enhancements

### Key Changes Made:
1. **Accessibility Descriptors for Feature Toggles (`src/popup/App.svelte`)**:
   - Linked each feature switch input directly to its subtext description ID using `aria-describedby` (e.g. `desc-restore-right-click`, `desc-restore-selection`, `desc-anti-shield`, `desc-absolute-force`, `desc-bypass-modifier-key`).
   - Ensures screen reader users hear feature context and functionality details when navigating toggles.

2. **Keyboard & Interaction Focus States (`src/popup/popup.css`)**:
   - Refined `button:focus:not(:focus-visible)` rules to prevent awkward focus outlines on mouse clicks while retaining high-visibility `:focus-visible` ring indicators for keyboard navigation.

3. **Visual Polish for Keycap Badges (`src/popup/popup.css`)**:
   - Enhanced `<kbd>` keycap styling with `font-weight: 600`, elevated contrast using `var(--text-primary)`, and subtle drop-shadow `0 1px 1.5px rgba(0, 0, 0, 0.08)` to present keycaps clearly across both light and dark themes.

4. **Inline Keycap Badges & Alignment Polish (`src/popup/App.svelte`, `src/popup/popup.css`)**:
   - Wrapped shortcut key references (`⌘C`, `⇧ Shift`, `⌥ Option`) in feature setting descriptions with `<kbd>` keycap badges.
   - Refined `kbd` font size, padding, and baseline alignment in `popup.css` for balanced inline subtext hierarchy in both light and dark modes.
   - Re-aligned the active domain status beacon dot (`items-start pt-0.5`) to match the status line text.
