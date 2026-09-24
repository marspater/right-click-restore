## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-16 - Fast-path tag checking for native interactive elements
**Learning:** Checking `localName` (`input`, `button`, `textarea`, `select`, `canvas`) on DOM elements before executing multi-selector matches (`ALL_INTERACTIVE_SELECTORS`) avoids costly C++ selector parsing during event handling and DOM scrubbing, yielding up to 11.8x speedups for interactive element checks.
**Action:** Short-circuit complex multi-selector CSS matching with lightweight tag name comparisons when checking common native DOM elements in hot interaction loops.
