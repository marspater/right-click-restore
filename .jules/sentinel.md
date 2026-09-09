## 2025-05-18 - Lock Handshake Channel and Nonce to Prevent Extension Bridge Hijacking
**Vulnerability:** Untrusted page scripts running in the main world could dispatch a secondary `__rcr_handshake__` event to overwrite `bridgeChannel` and `bridgeNonce` in the content script, allowing malicious web JS to hijack extension bridge notifications.
**Learning:** Custom event handshake mechanisms between isolated world content scripts and main world page scripts must make bridge identifiers immutable once established.
**Prevention:** Always verify that `bridgeChannel === null` before recording channel details, and enforce strict non-empty string type validation on channel and nonce parameters.
