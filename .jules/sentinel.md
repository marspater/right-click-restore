## 2025-05-18 - DOM Clobbering Resistance for Content Script DOM Operations
**Vulnerability:** Untrusted web pages can clobber `document.getElementById` and `querySelectorAll` (e.g. using `<form id="getElementById">` or `<input name="querySelectorAll">`), causing content script runtime TypeErrors and bypassing DOM event/attribute scrubbing and UI injection.
**Learning:** Content scripts executing in untrusted host page DOM contexts must never invoke element or document methods directly without prototype unshadowing protection.
**Prevention:** Use `safeGetElementById` and `safeQuerySelectorAll` (built on `getUnshadowedMethod`) across all content script DOM traversals and lookup routines.

## 2026-03-24 - One-Way Handshake Nonce Isolation in Page Script Bridge
**Vulnerability:** Re-transmitting extension bridge nonces on `window` in response to untrusted `__rcr_handshake_req__` events allows untrusted web scripts to request nonces on demand and spoof control messages (`UPDATE`, `UNLOCK`).
**Learning:** Cross-world bridge tokens must only be dispatched once during initial page script startup at `document_start` and never re-exposed on window event triggers.
**Prevention:** Remove `window.addEventListener('__rcr_handshake_req__')` in page scripts so nonces cannot be requested on-demand by untrusted page contexts.
