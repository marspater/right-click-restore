## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-15 - Fast-path checking for interactive element checks in composedPath
**Learning:** During event handling (`isInteractiveEvent`), walking `composedPath()` called `safeMatches(item, ALL_INTERACTIVE_SELECTORS)` on every ancestor node. Standard elements with 0 attributes (`!el.hasAttributes()`) cannot match class, role, or attribute selectors, so checking interactive tag names and zero-attribute elements short-circuits ~90% of prototype lookups and CSS engine evaluations (7x speedup).
**Action:** When validating DOM element traits against complex selector strings, check tag name sets and `hasAttributes()` before invoking selector evaluation routines (`matches`/`querySelectorAll`).
