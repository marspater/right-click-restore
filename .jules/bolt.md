## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-18 - Fast-path tag name pre-check for interactive DOM nodes
**Learning:** Checking element tag names (`INPUT`, `TEXTAREA`, `SELECT`, `BUTTON`, `CANVAS`) before running `safeClosest` or `safeMatches` against `ALL_INTERACTIVE_SELECTORS` provides an O(1) short-circuit that avoids DOM ancestor hierarchy traversal and complex CSS selector evaluation.
**Action:** Pre-check native element tag names before evaluating multi-clause CSS selectors during event handling or DOM node scrubbing.
