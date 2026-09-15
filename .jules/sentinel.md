## 2025-02-17 - Rejected constant-time comparison for extension bridge nonces
**Vulnerability:** Attempted to implement custom constant-time string comparison for in-page extension bridge session nonces.
**Learning:** In-page window messaging nonces across extension content scripts and injected page scripts operate in a local browser JS runtime execution context where remote network-based side-channel timing attacks are not realistic threats. Handwritten constant-time string algorithms add maintenance complexity and potential false security assurances without security benefit.
**Prevention:** Avoid implementing custom crypto/constant-time primitives for local browser extension IPC/bridge nonces unless protecting remote auth secrets against timing-oracle threats.
