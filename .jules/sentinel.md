## 2025-02-18 - Content Script Message Sender Verification
**Vulnerability:** `chrome.runtime.onMessage` listeners in content script handled commands (`RCR_FORCE_UNLOCK`, `RCR_CONFIG_CHANGED`) without checking `sender.id`, allowing potential cross-extension message spoofing.
**Learning:** In Web Extensions, `onMessage` listeners receive messages from all extension contexts and potentially external senders.
**Prevention:** Always validate `sender?.id === chrome.runtime.id` inside content script `onMessage` handlers before processing sensitive extension commands or configuration changes.
