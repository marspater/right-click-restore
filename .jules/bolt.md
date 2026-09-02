## 2025-05-10 - Early Event Type Gate in Event Interception Hot Paths
**Learning:** In page-injected extension scripts that intercept prototype methods (`Event.prototype.preventDefault`), checking event target types before DOM path inspection (`composedPath` and `Element.matches`) avoids expensive DOM tree traversal on non-target events (e.g. `click`, `mousemove`, `keydown`).
**Action:** Always filter by event type (`event.type === 'contextmenu' || SELECTION_EVENTS.has(event.type)`) before inspecting target nodes or traversing ancestors.
