## 2025-02-18 - Domain Matching Bypass via Unsanitized Hostname Inputs

**Vulnerability:**
`normalizeHostname` failed to strip leading dots (`.example.com`), protocol schemes (`https://`), ports (`:8080`), and URL paths from domain entries. When users or scripts added domain rules like `.example.com`, `isDomainDisabled` failed to match `example.com`, causing extension controls to remain active on domains meant to be disabled.

**Learning:**
Custom domain matching functions that rely on strict string comparisons or `.endsWith()` need comprehensive input normalization (stripping schemes, paths, ports, and leading dots) before string matching operations.

**Prevention:**
Always normalize domain entries through a centralized sanitizer that strips URL components and leading dots prior to storing or evaluating domain rules.
