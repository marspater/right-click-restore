## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-15 - Fast-path tag name lookup for interactive element checks
**Learning:** Checking `FAST_INTERACTIVE_TAGS.has(node.tagName)` (`INPUT`, `TEXTAREA`, `SELECT`, `BUTTON`, `CANVAS`) at the top of `isInteractiveNode`, `isInteractiveEvent`, and `cleanNode` short-circuits O(1) property checks before invoking expensive `safeClosest` and `safeMatches` compound CSS selector evaluation.
**Action:** For frequently executed DOM checks against compound CSS selectors, check common standard HTML tag names first before delegating to full CSS query selector engines.
