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
## 2025-05-22 - DOM Clobbering Resistance for Element Removal & Document Utilities
**Vulnerability:** Invoking `.remove()`, `document.createElement`, or `document.elementsFromPoint` directly on DOM objects allowed untrusted page scripts to shadow methods using named inputs (e.g. `<form><input name="remove"></form>` or `<form id="createElement">`), throwing TypeErrors and bypassing style restoration, element unmasking, or toast notifications.
**Learning:** Calling instance methods directly assumes instance properties remain unshadowed by child form inputs or named properties.
**Prevention:** Use `safeRemoveElement`, `safeCreateElement`, and `safeElementsFromPoint` across all DOM operations to unshadow methods via `getUnshadowedMethod` and `safeApply`.

## 2025-05-22 - Nonce Enforcement on Bridge Channels & Removal of Legacy Window Event Fallbacks
**Vulnerability:** Maintaining legacy fallback event listeners on `window` and reading `document.currentScript.dataset` allowed host page scripts to override extension configuration and trigger unlock callbacks without possessing the cryptographic session nonce.
**Learning:** Maintaining legacy unauthenticated DOM custom event listeners alongside a secure nonce-based bridge creates an unauthenticated control vector that untrusted page scripts can exploit.
**Prevention:** Eliminate all unauthenticated global DOM event listeners and dataset attributes; enforce that all inter-script communications strictly require cryptographically verified session nonces over isolated bridge channels.

## 2025-05-22 - Domain Normalization & Array Type Enforcement for Domain Exclusion Lookups
**Vulnerability:** Passing unnormalized domain strings (containing uppercase letters, schemes/ports, or leading dots) or non-array objects into `isDomainDisabled` caused domain exclusion lookups to fail or throw unhandled `TypeError`s during iteration, bypassing protection settings on disabled domains.
**Learning:** Checking domain exemptions requires strict normalization of both target and candidate domain strings, plus explicit `Array.isArray` validation before iterating over dynamic settings collections.
**Prevention:** Always validate `Array.isArray` and apply `normalizeHostname` dynamically to each domain candidate during domain matching operations.

## 2025-05-22 - State Mutation Prevention on Dispatched CustomEvents
**Vulnerability:** Dispatched CustomEvents carrying references to the extension's live settings object allowed untrusted host page scripts to mutate internal settings objects (such as pushing malicious domains to `disabledDomains`).
**Learning:** Objects passed in CustomEvent details across JS contexts can be mutated in-place by listening scripts.
**Prevention:** Deep-clone settings (`cloneSettings`) before dispatching CustomEvents over bridge channels.

## 2025-05-23 - DOM Clobbering Resistance for Element Insertion & Shadow Attachment
**Vulnerability:** Invoking `.appendChild(...)` or `.attachShadow(...)` directly on elements or shadow roots allowed untrusted host page scripts or named elements (e.g. `<form id="head"><input name="appendChild"></form>` or `<input name="attachShadow">`) to clobber methods on container instances, throwing TypeErrors and breaking selection style injection and toast notifications.
**Learning:** Container elements and root documents can have instance methods like `appendChild` or `attachShadow` clobbered by named form controls or host-page prototype modifications.
**Prevention:** Use `safeAppendChild` and `safeAttachShadow` across content script DOM construction to retrieve unshadowed prototype methods via `getUnshadowedMethod` and execute via `safeApply`.

## 2025-05-24 - DOM Clobbering Resistance for Parent Element Traversal
**Vulnerability:** Direct property access to `element.parentElement` allowed untrusted web pages to clobber `parentElement` using named child inputs (e.g. `<form><input name="parentElement"></form>`), returning input elements or spoofed non-Element objects that caused DOM traversal errors and bypassed interactive element checks or video unblur scanning.
**Learning:** Accessing `.parentElement` directly assumes the property is unshadowed by child form controls or named getters.
**Prevention:** Use `safeGetParentElement` across all DOM parent element traversals to retrieve native getters via `getNativeParentElementGetter`/`getUnshadowedGetter` and verify node interface prototype inheritance.
