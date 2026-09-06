## 2025-05-18 - Input Sanitization for Hostname Domain Matching
**Vulnerability:** Domain blocklist bypass due to incomplete URL normalization where scheme prefixes, ports, credentials, or trailing query parameters/paths in configured disabled domains allowed site restrictions to be bypassed or misapplied.
**Learning:** Browser storage or user input for hostname settings may contain full URLs (`https://user:pass@domain.com:8080/path?query`). Standard string replace on `www.` or trailing dots is insufficient for hostname matching.
**Prevention:** Always parse hostnames through `URL` constructor or robust URL fallback parsing before domain matching and cache insertion.
