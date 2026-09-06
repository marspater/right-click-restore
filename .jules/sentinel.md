# Sentinel Security Journal

## [2025-03-06] Insecure Randomness for Session Nonce Fix
- **Vulnerability:** Insecure randomness using `Math.random()` for generating session nonces and internal bridge event names in `page-script/index.ts` and `content/index.ts`. `Math.random()` is PRNG-based and non-cryptographically secure, allowing malicious page scripts to predict nonces/event names and potentially spoof/interfere with extension communication channels.
- **Remediation:** Created a shared `generateSecureToken()` helper function in `src/shared/utils.ts` utilizing `crypto.randomUUID()` when available, and falling back to `crypto.getRandomValues()` with 128-bit entropy. Replaced all `Math.random()` usages across `src/page-script/index.ts` and `src/content/index.ts`.
- **Verification:** Created unit tests in `src/shared/utils.test.ts` verifying secure token generation and fallback behavior. All 59 tests passed, biome linting passed, and build succeeded.
