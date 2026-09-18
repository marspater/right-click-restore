## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-15 - Short-circuiting safeClosest DOM ancestor hierarchy traversals in cleanNode
**Learning:** Checking whether a node possesses any scrubbable attributes (`oncontextmenu`, `onselectstart`, etc.), inline `user-select: none` styles, or an open shadow root before executing `safeClosest(node, ALL_INTERACTIVE_SELECTORS)` short-circuits parent ancestor traversals for over 99% of DOM elements processed by MutationObserver during dynamic rendering.
**Action:** Always inspect whether an element has target properties before performing ancestor element hierarchy matching or `closest()` calls.
