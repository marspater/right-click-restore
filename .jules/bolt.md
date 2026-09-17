## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-15 - Short-circuiting ancestor traversal with fast-path attribute matching
**Learning:** In DOM mutation routines like `cleanNode`, checking whether a node actually matches scrubbable attributes or inline style selectors (`safeMatches(node, SCRUB_SELECTOR)`) before evaluating ancestor hierarchy queries (`safeClosest`) prevents O(N * depth) DOM ancestor walks for thousands of unscrubbed DOM nodes.
**Action:** Always test whether a single DOM node matches target criteria locally before walking up its ancestor hierarchy with `closest()`.
