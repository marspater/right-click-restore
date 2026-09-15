## 2025-02-18 - Rejected Exception-Based RNG Fallback for Utility API
**Vulnerability:** Weak pseudo-random fallback in `getSecureRandomString` when `crypto` is unavailable.
**Learning:** Changing a helper function's contract from "always returns a string token" to "throws when crypto is unavailable" can cause extension initialization failures if `crypto` is somehow absent in rare execution environments. In browser extension contexts, Web Crypto is assumed to exist, so throwing errors introduces breaking changes and initialization risks.
**Prevention:** Avoid throwing errors in fundamental browser extension utility functions that can break app startup; maintain fallback compatibility or ensure safe handling at callers when strict nonces are required.
