## 2025-05-20 - Fast-path attribute check in DOM cleaner
**Learning:** `cleanNode` runs repeatedly across DOM trees during mutation observer batches and page scans. Elements without attributes, shadow DOM, or `user-select: none` styles do not require DOM cleaning.
**Action:** Always check `node.hasAttributes()` and basic element flags before running expensive CSS selector matches (`matches`/`closest`) or attempting `removeAttribute` calls.
