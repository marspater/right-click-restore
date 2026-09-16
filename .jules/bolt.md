## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-15 - Fast O(1) attribute and style pre-check before DOM ancestor traversal
**Learning:** In DOM cleaning routines (`cleanNode`), checking if an element actually possesses scrubbable event attributes (`oncontextmenu`, `onselectstart`, etc.), inline `user-select` styles, or a shadow root in O(1) time before invoking `safeClosest` avoids walking up the entire DOM ancestor tree against complex selectors for 99%+ of clean DOM nodes.
**Action:** Always perform local O(1) property/attribute presence checks on target elements before running heavy ancestor tree traversals (`closest`) or multi-selector evaluations.
