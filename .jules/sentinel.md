## 2025-02-18 - Input Length Capping in Extension Domain Sanitization
**Vulnerability:** Unbounded hostname string processing in `normalizeHostname` allowed processing arbitrarily long strings before string slicing, posing CPU exhaustion/DoS risks.
**Learning:** Even when output length is bounded via `.slice(0, MAX_HOSTNAME_LENGTH)` late in processing, early string iteration over raw inputs can freeze the main script thread.
**Prevention:** Cap raw input length (`input.slice(0, 2048)`) before running character loop or regex operations on user/untrusted web inputs.
