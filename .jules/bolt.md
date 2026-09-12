## 2025-05-20 - Early-exit predicate before DOM tree ancestor selector evaluation

**Learning:** In DOM mutation scrubbers, `element.closest()` on complex interactive CSS selectors traverses ancestor hierarchies up to document root for every node. Performing O(1) attribute/style presence checks first allows skipping `closest()` entirely for >99% of DOM nodes.
**Action:** Always check if an element actually possesses target attributes or styles requiring modification before executing ancestor selector matching.
