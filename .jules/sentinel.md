## 2025-05-18 - DOM Clobbering Resistance for Content Script DOM Operations
**Vulnerability:** Untrusted web pages can clobber `document.getElementById` and `querySelectorAll` (e.g. using `<form id="getElementById">` or `<input name="querySelectorAll">`), causing content script runtime TypeErrors and bypassing DOM event/attribute scrubbing and UI injection.
**Learning:** Content scripts executing in untrusted host page DOM contexts must never invoke element or document methods directly without prototype unshadowing protection.
**Prevention:** Use `safeGetElementById` and `safeQuerySelectorAll` (built on `getUnshadowedMethod`) across all content script DOM traversals and lookup routines.

## 2025-05-19 - Crypto Method Instance Shadowing Protection & Fail-Closed Defense
**Vulnerability:** Invoking `crypto.randomUUID()` or `crypto.getRandomValues()` directly on global `crypto` without unshadowing protection allowed untrusted host scripts executing in the main JS context to shadow methods on the `crypto` instance with constant or predictable functions, hijacking extension session nonces and bridge channel tokens. Furthermore, silently falling back to timestamps upon crypto failure allowed forced downgrades.
**Learning:** Native `crypto` methods can be shadowed on the global `crypto` instance by host page scripts. Silently catching crypto errors and falling back to timestamps degrades secure random guarantees.
**Prevention:** Snapshot native `randomUUID` and `getRandomValues` at module evaluation time, retrieve prototype methods via `getUnshadowedMethod`, and fail closed (throw) when crypto is present in the browser runtime but unusable.

## 2025-05-20 - DOM Clobbering Bypasses `Object.hasOwn` in Property Access
**Vulnerability:** Checking `Object.hasOwn(element, 'style')` or `Object.hasOwn(element, 'shadowRoot')` allowed `<form>` or `<fieldset>` child elements with matching names (e.g. `<input name="style">`) to clobber `style` and `shadowRoot` via named property getters without triggering `hasOwn`. Accessing `element.style` returned an `HTMLInputElement`, leading to runtime TypeErrors and bypassing style restoration.
**Learning:** Named element getters on HTML collections and form elements do not create own properties on instance objects, causing `Object.hasOwn` checks to evaluate to `false` and fall back to clobbered instance properties.
**Prevention:** Always retrieve unshadowed prototype getter descriptors directly using `getUnshadowedGetter` without checking `Object.hasOwn`, and validate that returned objects match expected interface specifications (`getPropertyValue` for CSS styles, `nodeType === 11` for shadow roots).

## 2025-05-21 - Bridge Channel Nonce Validation & Handshake Tampering Resistance
**Vulnerability:** Untrusted page scripts could trigger fake `__rcr_handshake__` events with standard DOM event names (e.g. `click`) or arbitrary channel strings, potentially confusing communication channels or hijacking message relays.
**Learning:** Handshake payloads must be strictly validated before channel registration. Nonce strings must satisfy minimum length constraints, and channel names must adhere strictly to the internal naming convention (`__rcr_bridge_${nonce}`).
**Prevention:** Verify `typeof detail.nonce === 'string' && detail.nonce.length >= 8 && detail.channel === '__rcr_bridge_' + detail.nonce` and permanently lock channel state upon initial establishment.

## 2025-05-21 - Interface Prototype Verification & Duck-Typing Bypass Resistance
**Vulnerability:** Relying solely on structural duck-typing (`'nodeType' in shadow && shadow.nodeType === 11` or `typeof style.getPropertyValue === 'function'`) allowed host page scripts to spoof `shadowRoot` or `style` with plain JS objects like `{ nodeType: 11 }` or `{ getPropertyValue: fn }`.
**Learning:** Checking structural properties on objects returned by unshadowed getters is insufficient if plain JS objects (`{ ... }`) pass duck-typing checks. Plain objects inherit directly from `Object.prototype` or `null`.
**Prevention:** Verify interface prototype inheritance (`Object.getPrototypeOf(obj) !== null && Object.getPrototypeOf(obj) !== Object.prototype`) ensuring objects are genuine DOM interface instances.

## 2025-05-21 - Function Prototype Shadowing Resistance with safeApply
**Vulnerability:** Malicious host scripts could monkey-patch or shadow `Function.prototype.apply` and `Function.prototype.call`, causing extension DOM helpers and event traps to fail or execute attacker-controlled logic.
**Learning:** Calling `.call()` or `.apply()` directly relies on `Function.prototype` methods remaining unmodified in the current JS realm.
**Prevention:** Implement `safeApply` using snapshotted native `Reflect.apply` (or fallback `Function.prototype.call.bind(Function.prototype.apply)`), ensuring untrusted host script modifications to `Function.prototype` cannot compromise DOM operations.

## 2025-05-22 - DOM Clobbering Resistance for Coordinate Lookup Methods
**Vulnerability:** Untrusted web pages could clobber or shadow `document.elementsFromPoint` (e.g. using `<input name="elementsFromPoint">` or instance overrides), causing Anti-Shield media unmasking routines to throw TypeErrors or fail silently.
**Learning:** Document coordinate lookup methods invoked in main-world page scripts are susceptible to element named-property clobbering and instance shadowing.
**Prevention:** Use `safeElementsFromPoint` (built on `getUnshadowedMethod` and `safeApply`) to retrieve `Document.prototype.elementsFromPoint` unshadowed and invoke it safely.

