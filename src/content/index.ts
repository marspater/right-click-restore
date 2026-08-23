(() => {
  interface Settings {
    enabled: boolean;
    restoreRightClick: boolean;
    restoreSelection: boolean;
    antiShield: boolean;
    absoluteForce: boolean;
    bypassModifierKey: boolean;
    disabledDomains: string[];
  }

  const DEFAULT_SETTINGS: Settings = {
    enabled: true,
    restoreRightClick: true,
    restoreSelection: true,
    antiShield: true,
    absoluteForce: true,
    bypassModifierKey: true,
    disabledDomains: [],
  };

  let currentSettings: Settings = { ...DEFAULT_SETTINGS };
  let mainWorldInjected = false;

  function isDomainDisabled(
    hostname: string,
    disabledDomains: string[],
  ): boolean {
    if (!hostname || !disabledDomains || disabledDomains.length === 0)
      return false;
    const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
    return disabledDomains.some((d) => {
      const cleanDomain = d.toLowerCase().replace(/^www\./, '');
      return cleanHost === cleanDomain || cleanHost.endsWith(`.${cleanDomain}`);
    });
  }

  function applySettings(settings: Settings) {
    currentSettings = settings;

    const hostname = window.location.hostname;
    const isDisabled = isDomainDisabled(hostname, settings.disabledDomains);
    const effectiveSettings: Settings = {
      ...settings,
      enabled: settings.enabled !== false && !isDisabled,
    };

    const root = document.documentElement;
    if (root) {
      root.dataset.rcrEnabled = effectiveSettings.enabled ? 'true' : 'false';
      root.dataset.rcrRightClick = effectiveSettings.restoreRightClick
        ? 'true'
        : 'false';
      root.dataset.rcrSelection = effectiveSettings.restoreSelection
        ? 'true'
        : 'false';
      root.dataset.rcrAntiShield = effectiveSettings.antiShield
        ? 'true'
        : 'false';
      root.dataset.rcrForceMode = effectiveSettings.absoluteForce
        ? 'true'
        : 'false';
      root.dataset.rcrModifierBypass = effectiveSettings.bypassModifierKey
        ? 'true'
        : 'false';
    }

    try {
      window.dispatchEvent(
        new CustomEvent('__rcr_update_config', {
          detail: effectiveSettings,
        }),
      );
    } catch (_e) {}
  }

  function injectMainWorldScript(initialConfig: Settings) {
    if (mainWorldInjected) return;
    mainWorldInjected = true;
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('page-script.js');
      script.dataset.initialConfig = JSON.stringify(initialConfig);

      const target = document.head || document.documentElement || document.body;
      if (target) {
        target.appendChild(script);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          (
            document.head ||
            document.documentElement ||
            document.body
          )?.appendChild(script);
        });
      }
    } catch (_e) {}
  }

  // Load configuration FIRST, then inject script (fixes race condition)
  try {
    chrome.storage.local.get(['rcr_settings', 'shieldEnabled'], (res) => {
      const settings = {
        ...DEFAULT_SETTINGS,
        ...(res.rcr_settings || {}),
      };
      if (res.shieldEnabled !== undefined) {
        settings.enabled = res.shieldEnabled;
      }
      const hostname = window.location.hostname;
      const isDisabled = isDomainDisabled(hostname, settings.disabledDomains);
      const effectiveSettings: Settings = {
        ...settings,
        enabled: settings.enabled !== false && !isDisabled,
      };

      applySettings(effectiveSettings);
      injectMainWorldScript(effectiveSettings);
    });
  } catch (_e) {
    applySettings(DEFAULT_SETTINGS);
    injectMainWorldScript(DEFAULT_SETTINGS);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.rcr_settings || changes.shieldEnabled) {
          chrome.storage.local.get(['rcr_settings', 'shieldEnabled'], (res) => {
            const settings = {
              ...DEFAULT_SETTINGS,
              ...(res.rcr_settings || {}),
            };
            if (res.shieldEnabled !== undefined) {
              settings.enabled = res.shieldEnabled;
            }
            applySettings(settings);
          });
        }
      }
    });
  } catch (_e) {}

  function showUnlockToast() {
    try {
      const existing = document.getElementById('rcr-unlock-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'rcr-unlock-toast';
      toast.textContent = '🔓 Protection & Right-Click Unlocked';
      Object.assign(toast.style, {
        position: 'fixed',
        top: '18px',
        left: '50%',
        transform: 'translateX(-50%) translateY(-10px)',
        zIndex: '2147483647',
        background: 'rgba(20, 24, 35, 0.94)',
        color: '#ffffff',
        padding: '8px 18px',
        borderRadius: '9999px',
        fontSize: '12.5px',
        fontWeight: '600',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        boxShadow:
          '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
        border: '0.5px solid rgba(255,255,255,0.25)',
        backdropFilter: 'blur(16px)',
        webkitBackdropFilter: 'blur(16px)',
        pointerEvents: 'none',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        opacity: '0',
      });

      document.documentElement.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      });

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
      }, 1600);
    } catch (_e) {}
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'RCR_FORCE_UNLOCK') {
        cleanDOMTree();
        window.dispatchEvent(new CustomEvent('__rcr_force_unlock__'));
        showUnlockToast();
        sendResponse({ status: 'unlocked' });
      } else if (message.type === 'RCR_CONFIG_CHANGED') {
        if (message.config) {
          applySettings(message.config);
        }
        sendResponse({ status: 'ok' });
      }
      return true;
    });
  } catch (_e) {}

  const INTERACTIVE_CONTAINERS =
    '.ProseMirror, .monaco-editor, .html5-video-player, [class*="ytp-"], [class*="player-"], ytd-app, [contenteditable="true"]';

  const INTERACTIVE_ELEMENTS =
    'input, textarea, select, button, [contenteditable], [contenteditable="true"]';

  const SCRUB_ATTRS = [
    'oncontextmenu',
    'onselectstart',
    'ondragstart',
    'oncopy',
    'oncut',
    'onbeforecopy',
  ];

  const SCRUB_SELECTOR = SCRUB_ATTRS.map((a) => `[${a}]`).join(',');

  function cleanNode(el: Element) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    if (el.matches(INTERACTIVE_ELEMENTS)) return;
    if (el.closest(INTERACTIVE_CONTAINERS)) return;

    if (currentSettings.restoreRightClick) {
      if (el.hasAttribute('oncontextmenu')) {
        try {
          el.removeAttribute('oncontextmenu');
        } catch (_e) {}
      }
    }

    if (currentSettings.restoreSelection) {
      for (const attr of SCRUB_ATTRS) {
        if (attr !== 'oncontextmenu' && el.hasAttribute(attr)) {
          try {
            el.removeAttribute(attr);
          } catch (_e) {}
        }
      }
      if (
        el instanceof HTMLElement &&
        (el.style.userSelect === 'none' || el.style.webkitUserSelect === 'none')
      ) {
        el.style.userSelect = 'auto';
        el.style.webkitUserSelect = 'auto';
      }
    }
  }

  function cleanDOMTree(root: Element | Document = document) {
    if (root instanceof Element) cleanNode(root);
    try {
      for (const node of root.querySelectorAll(SCRUB_SELECTOR)) {
        cleanNode(node);
      }
    } catch (_e) {}
  }

  if (document.documentElement) {
    cleanDOMTree(document.documentElement);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => cleanDOMTree());
  } else {
    cleanDOMTree();
  }

  // Strict resource-budgeted batched MutationObserver
  const pendingNodes = new Set<Element>();
  let isBatchScheduled = false;
  let isBackoffMode = false;
  let backoffTimeout: ReturnType<typeof setTimeout> | null = null;
  const MAX_NODES_PER_BATCH = 50;
  const MAX_PENDING_NODES = 50000;

  function processBatch() {
    if (isBackoffMode) {
      isBatchScheduled = false;
      return;
    }

    const nodes = Array.from(pendingNodes);
    const batch = nodes.slice(0, MAX_NODES_PER_BATCH);

    // Remove processed nodes from the queue
    for (const node of batch) {
      pendingNodes.delete(node);
    }

    for (const node of batch) {
      cleanNode(node);
      try {
        for (const child of node.querySelectorAll(SCRUB_SELECTOR)) {
          cleanNode(child);
        }
      } catch (_e) {}
    }

    if (pendingNodes.size > 0) {
      requestAnimationFrame(processBatch);
    } else {
      isBatchScheduled = false;
    }
  }

  function scheduleBatch() {
    if (isBatchScheduled || isBackoffMode) return;
    isBatchScheduled = true;
    requestAnimationFrame(processBatch);
  }

  function enterBackoffMode() {
    if (isBackoffMode) return;
    isBackoffMode = true;
    pendingNodes.clear();
    isBatchScheduled = false;

    if (backoffTimeout) clearTimeout(backoffTimeout);
    // 5-second penalty backoff for mutation storms
    backoffTimeout = setTimeout(() => {
      isBackoffMode = false;
      backoffTimeout = null;
    }, 5000);
  }

  const obs = new MutationObserver((mutations) => {
    if (isBackoffMode) return;

    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof Element) {
        pendingNodes.add(m.target);
      } else if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n instanceof Element) {
            pendingNodes.add(n);
          }
        }
      }
    }

    // Memory exhaustion circuit breaker
    if (pendingNodes.size > MAX_PENDING_NODES) {
      enterBackoffMode();
      return;
    }

    if (pendingNodes.size > 0) {
      scheduleBatch();
    }
  });

  const targetObs = document.documentElement || document;
  obs.observe(targetObs, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: SCRUB_ATTRS,
  });
})();
