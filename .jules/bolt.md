## 2025-05-18 - Early return short-circuiting in DOM cleaning routines
**Learning:** Checking feature flag settings (`restoreRightClick` and `restoreSelection`) at the entry of DOM tree traversing functions (`cleanNode` and `cleanDOMTree`) avoids executing expensive `querySelectorAll` calls and selector evaluation (`safeClosest`) when both features are disabled.
**Action:** Always place settings check guards at the top of DOM scanner functions before initiating subtree selection or ancestor hierarchy traversal.

## 2026-09-16 - Fast-path pre-filtering for interactive DOM element matching
**Learning:** Evaluating complex CSS selectors (`ALL_INTERACTIVE_SELECTORS`) via `element.matches()` on every element in event composedPaths or DOM trees during high-frequency events causes significant CPU overhead. Checking `tagName` and structural attributes (`role`, `contenteditable`, interactive class substrings) first bypasses 90%+ of expensive `matches()` calls.
**Action:** Always pre-filter elements with O(1) tag and attribute checks before passing them to full CSS selector engine evaluation functions.
