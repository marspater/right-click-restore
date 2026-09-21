## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-15 - Fast-path scrubbable state pre-check before DOM ancestor traversal
**Learning:** In DOM mutation routines, running `safeClosest` on every single DOM element during tree passes introduces heavy CPU overhead. Pre-checking whether an element actually possesses scrubbable attributes (`oncontextmenu`, `onselectstart`, etc.), inline `user-select` styles, or attached shadow roots allows short-circuiting ~95% of clean nodes before initiating DOM ancestor hierarchy traversal.
**Action:** Always test element attribute and style state via fast $O(1)$ checks before initiating recursive or ancestor DOM selector matching (`safeClosest`).
