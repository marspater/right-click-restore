## 2025-09-11 - Domain Card Affordance & Focus State Polish

- **UI/UX Improvement**: Made the active domain inset card in the extension popup a full click target with hover feedback (`bg-card-hover`), while fixing mouse-click focus ring artifacts by migrating outline styling to `:has(input:focus-visible)`.
- **Accessibility & Affordance**: Removed invalid nested label structures by transforming the inner switch wrapper to a `span` with intact ARIA attributes. Added dynamic opacity styling to the footer keyboard shortcut tip so it clearly dims when modifier bypass is inactive or disabled.
- **Verification**: Verified using `bun run check`, `bun test`, and `bun run build`. All 75 tests passed without regressions.
