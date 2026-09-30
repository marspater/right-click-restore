## 2025-05-18 - DOM Clobbering Resistance for Content Script DOM Operations
**Vulnerability:** Untrusted web pages can clobber `document.getElementById` and `querySelectorAll` (e.g. using `<form id="getElementById">` or `<input name="querySelectorAll">`), causing content script runtime TypeErrors and bypassing DOM event/attribute scrubbing and UI injection.
**Learning:** Content scripts executing in untrusted host page DOM contexts must never invoke element or document methods directly without prototype unshadowing protection.
**Prevention:** Use `safeGetElementById` and `safeQuerySelectorAll` (built on `getUnshadowedMethod`) across all content script DOM traversals and lookup routines.

## 2025-05-19 - Crypto Method Instance Shadowing Protection
**Vulnerability:** Invoking `crypto.randomUUID()` or `crypto.getRandomValues()` directly on global `crypto` without unshadowing protection allowed untrusted host scripts executing in the main JS context to shadow methods on the `crypto` instance with constant or predictable functions, hijacking extension session nonces and bridge channel tokens.
**Learning:** Native `crypto` methods can be shadowed on the global `crypto` instance by host page scripts before extension scripts execute.
**Prevention:** Always retrieve `randomUUID` and `getRandomValues` via `getUnshadowedMethod(crypto, ...)` to ensure prototype execution.
