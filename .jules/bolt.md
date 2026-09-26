## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-03-30 - O(1) set lookup for standard interactive HTML tag names
**Learning:** Standard form controls and canvas elements (`INPUT`, `TEXTAREA`, `SELECT`, `BUTTON`, `CANVAS`) make up the majority of interactive nodes on web pages. Checking `tagName` against an O(1) Set (`FAST_INTERACTIVE_TAGS`) before calling `safeClosest` or `safeMatches` avoids expensive prototype unshadowing and browser CSS selector string parsing on every DOM node clean and event handler invocation.
**Action:** Prefer O(1) tag name or attribute set checks prior to invoking full CSS selector matching engines (`matches`/`closest`) in high-frequency event loops or DOM tree traversals.
