## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-19 - O(1) Tag Name Fast-Path for Interactive Elements
**Learning:** Inspecting standard form and canvas element tag names (`INPUT`, `TEXTAREA`, `SELECT`, `BUTTON`, `CANVAS`) in O(1) time before invoking DOM selector hierarchy checks (`safeClosest` and `safeMatches`) bypasses prototype method lookups and complex multi-selector CSS string evaluation on hot event paths.
**Action:** Always check `element.tagName` against standard form/canvas upper-case tag literals as a fast-path guard before running `safeClosest` or `safeMatches` against `ALL_INTERACTIVE_SELECTORS`.
