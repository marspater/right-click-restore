(() => {
  const BLOCKED_ATTRS = [
    'oncontextmenu',
    'onselectstart',
    'ondragstart',
    'oncopy',
    'oncut',
  ];

  const TARGET_SELECTOR = BLOCKED_ATTRS.map((a) => `[${a}]`).join(',');

  function updateEnabledState(enabled: boolean) {
    if (document.documentElement) {
      document.documentElement.dataset.rcrEnabled = enabled ? 'true' : 'false';
    }
  }

  // Sync initial state from storage
  try {
    chrome.storage.local.get(['shieldEnabled', 'rcr_settings'], (res) => {
      const hostname = window.location.hostname;
      const settings = res.rcr_settings;
      if (
        settings?.disabledDomains &&
        hostname &&
        settings.disabledDomains.includes(hostname)
      ) {
        updateEnabledState(false);
      } else {
        updateEnabledState(res.shieldEnabled !== false);
      }
    });
  } catch (_e) {
    updateEnabledState(true);
  }

  // Listen for dynamic toggle changes from popup
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.shieldEnabled || changes.rcr_settings) {
          chrome.storage.local.get(['shieldEnabled', 'rcr_settings'], (res) => {
            const hostname = window.location.hostname;
            const settings = res.rcr_settings;
            if (
              settings?.disabledDomains &&
              hostname &&
              settings.disabledDomains.includes(hostname)
            ) {
              updateEnabledState(false);
            } else {
              updateEnabledState(res.shieldEnabled !== false);
            }
          });
        }
      }
    });
  } catch (_e) {}

  // Handle messages from popup (force unlock & dynamic config)
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'RCR_FORCE_UNLOCK') {
        cleanDOMTree();
        sendResponse({ status: 'unlocked' });
      } else if (message.type === 'RCR_CONFIG_CHANGED') {
        const hostname = window.location.hostname;
        const settings = message.config;
        if (
          settings?.disabledDomains &&
          hostname &&
          settings.disabledDomains.includes(hostname)
        ) {
          updateEnabledState(false);
        } else {
          updateEnabledState(settings?.enabled !== false);
        }
        sendResponse({ status: 'ok' });
      }
      return true;
    });
  } catch (_e) {}

  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('page-script.js');
      script.async = false;
      const target = document.head || document.documentElement || document.body;
      if (target) {
        target.appendChild(script);
        script.onload = () => script.remove();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          (
            document.head ||
            document.documentElement ||
            document.body
          )?.appendChild(script);
          script.onload = () => script.remove();
        });
      }
    } catch (_e) {}
  }

  function cleanNode(el: Element) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    for (const attr of BLOCKED_ATTRS) {
      if (el.hasAttribute(attr)) {
        try {
          el.removeAttribute(attr);
        } catch (_e) {}
      }
    }
    // Clear userSelect only if explicitly set to none on text containers
    if (
      el instanceof HTMLElement &&
      (el.style.userSelect === 'none' || el.style.webkitUserSelect === 'none')
    ) {
      if (
        !el.closest(
          '.html5-video-player, button, input, textarea, select, [contenteditable]',
        )
      ) {
        el.style.userSelect = 'auto';
        el.style.webkitUserSelect = 'auto';
      }
    }
  }

  function cleanDOMTree(root: Element | Document = document) {
    if (root instanceof Element) cleanNode(root);
    try {
      // Use targeted attribute query instead of expensive querySelectorAll('*')
      for (const node of root.querySelectorAll(TARGET_SELECTOR)) {
        cleanNode(node);
      }
    } catch (_e) {}
  }

  // 1. Synchronously inject MAIN-world script
  injectMainWorldScript();

  // 2. Scrub DOM
  if (document.documentElement) {
    cleanDOMTree(document.documentElement);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => cleanDOMTree());
  } else {
    cleanDOMTree();
  }

  // 3. Observe mutations with fast attributeFilter
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof Element) {
        cleanNode(m.target);
      } else if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n instanceof Element) {
            cleanNode(n);
            if (n.querySelector(TARGET_SELECTOR)) {
              for (const child of n.querySelectorAll(TARGET_SELECTOR)) {
                cleanNode(child);
              }
            }
          }
        }
      }
    }
  });

  if (document.documentElement) {
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: BLOCKED_ATTRS,
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: BLOCKED_ATTRS,
      });
    });
  }
})();
