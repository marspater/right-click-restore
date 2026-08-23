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

  function applySettingsToDOM(settings: Settings) {
    currentSettings = settings;
    const root = document.documentElement;
    if (!root) return;

    const hostname = window.location.hostname;
    const isDisabled = isDomainDisabled(hostname, settings.disabledDomains);
    const isGloballyEnabled = settings.enabled !== false && !isDisabled;

    root.dataset.rcrEnabled = isGloballyEnabled ? 'true' : 'false';
    root.dataset.rcrRightClick = settings.restoreRightClick ? 'true' : 'false';
    root.dataset.rcrSelection = settings.restoreSelection ? 'true' : 'false';
    root.dataset.rcrAntiShield = settings.antiShield ? 'true' : 'false';
    root.dataset.rcrForceMode = settings.absoluteForce ? 'true' : 'false';
    root.dataset.rcrModifierBypass = settings.bypassModifierKey
      ? 'true'
      : 'false';
  }

  // Load and apply initial settings
  try {
    chrome.storage.local.get(['rcr_settings', 'shieldEnabled'], (res) => {
      const settings = {
        ...DEFAULT_SETTINGS,
        ...(res.rcr_settings || {}),
      };
      if (res.shieldEnabled !== undefined) {
        settings.enabled = res.shieldEnabled;
      }
      applySettingsToDOM(settings);
    });
  } catch (_e) {
    applySettingsToDOM(DEFAULT_SETTINGS);
  }

  // React to storage changes from popup
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
            applySettingsToDOM(settings);
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

  // Handle messages from popup
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'RCR_FORCE_UNLOCK') {
        cleanDOMTree();
        window.dispatchEvent(new CustomEvent('__rcr_force_unlock__'));
        showUnlockToast();
        sendResponse({ status: 'unlocked' });
      } else if (message.type === 'RCR_CONFIG_CHANGED') {
        if (message.config) {
          applySettingsToDOM(message.config);
        }
        sendResponse({ status: 'ok' });
      }
      return true;
    });
  } catch (_e) {}

  function injectMainWorldScript() {
    try {
      if (document.getElementById('rcr-main-world-script')) return;
      const script = document.createElement('script');
      script.id = 'rcr-main-world-script';
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

  function cleanNode(el: Element) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    // Never alter interactive inputs, rich text editors, or video players
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
      for (const attr of [
        'onselectstart',
        'ondragstart',
        'oncopy',
        'oncut',
        'onbeforecopy',
      ]) {
        if (el.hasAttribute(attr)) {
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
      const selector = SCRUB_ATTRS.map((a) => `[${a}]`).join(',');
      for (const node of root.querySelectorAll(selector)) {
        cleanNode(node);
      }
    } catch (_e) {}
  }

  // 1. Inject MAIN-world script
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

  // 3. Observe dynamic mutations
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof Element) {
        cleanNode(m.target);
      } else if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n instanceof Element) {
            cleanNode(n);
            const selector = SCRUB_ATTRS.map((a) => `[${a}]`).join(',');
            for (const child of n.querySelectorAll(selector)) {
              cleanNode(child);
            }
          }
        }
      }
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
