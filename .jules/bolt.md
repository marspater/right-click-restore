## 2025-05-18 - Fast-path attribute guards for DOM cleaning
**Learning:** `Element.closest()` traverses ancestor chains ($O(\text{depth})$) and is expensive when called indiscriminately across thousands of DOM nodes during cleaning or mutation observer batching. Checking for target attribute presence (`safeHasAttribute`) before ancestor traversal allows an immediate fast-path exit for non-matching nodes.
**Action:** Always check node attributes and shadow root presence before running `safeClosest()` ancestor selector matching in DOM scrubber functions.
