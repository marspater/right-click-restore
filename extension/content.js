/**
 * Right Click & Selection Restorer - Content Script
 * Coordinates settings, injects page-script, handles DOM cleanup, and neutralizes overlays.
 */
(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    enabled: true,
    restoreRightClick: true,
    restoreSelection: true,
    antiShield: true,
    absoluteForce: true,
    bypassModifierKey: true,
    disabledDomains: []
  };

  let currentConfig = { ...DEFAULT_CONFIG };
  const hostname = window.location.hostname;

  /**
   * Determine effective configuration for the current site
   */
  function isSiteEnabled(cfg) {
    if (!cfg.enabled) return false;
    const disabledList = cfg.disabledDomains || [];
    return !disabledList.some((domain) => hostname === domain || hostname.endsWith('.' + domain));
  }

  /**
   * Apply CSS classes and update DOM dataset
   */
  function applyDOMState() {
    const active = isSiteEnabled(currentConfig);
    if (active) {
      document.documentElement.classList.add('rcr-enabled');
    } else {
      document.documentElement.classList.remove('rcr-enabled');
    }

    const payload = {
      ...currentConfig,
      enabled: active
    };

    try {
      document.documentElement.dataset.rcrConfig = JSON.stringify(payload);
    } catch (e) {}

    // Dispatch event to page-script in main world
    window.dispatchEvent(new CustomEvent('__rcr_update_config__', { detail: payload }));
  }

  /**
   * Inject page-script.js into the main world context
   */
  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('page-script.js');
      script.async = false;
      (document.head || document.documentElement).appendChild(script);
      script.onload = () => script.remove();
    } catch (e) {
      console.warn('[RCR] Main-world script injection deferred:', e);
    }
  }

  /**
   * Remove inline event handler attributes from an element
   */
  const INLINE_ATTRIBUTES = [
    'oncontextmenu',
    'onselectstart',
    'ondragstart',
    'oncopy',
    'oncut',
    'onpaste',
    'onmousedown',
    'onmouseup'
  ];

  function cleanElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    
    INLINE_ATTRIBUTES.forEach((attr) => {
      if (el.hasAttribute(attr)) {
        try {
          el.removeAttribute(attr);
        } catch (e) {}
      }
    });

    // Remove inline user-select: none styles
    if (el.style && el.style.userSelect === 'none') {
      el.style.userSelect = 'auto';
    }
    if (el.style && el.style.webkitUserSelect === 'none') {
      el.style.webkitUserSelect = 'auto';
    }
  }

  /**
   * Clean all elements in the DOM tree
   */
  function cleanDOMTree(root = document.documentElement) {
    if (!root) return;
    cleanElement(root);
    const elements = root.querySelectorAll('*');
    for (let i = 0; i < elements.length; i++) {
      cleanElement(elements[i]);
    }
  }

  /**
   * Anti-Shield detector: Finds and neutralizes transparent full-viewport overlays
   */
  function neutralizeClickShields() {
    if (!isSiteEnabled(currentConfig) || !currentConfig.antiShield) return;

    const allDivs = document.querySelectorAll('div, section, span, ins');
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    for (let i = 0; i < allDivs.length; i++) {
      const el = allDivs[i];
      if (el.id === 'rcr-notification-toast') continue;

      const style = window.getComputedStyle(el);
      const isFixed = style.position === 'fixed' || style.position === 'absolute';
      const zIndex = parseInt(style.zIndex, 10);

      if (isFixed && zIndex > 100) {
        const rect = el.getBoundingClientRect();
        // Check if it spans almost the whole viewport and has transparent background
        const coversViewport = rect.width >= vw * 0.85 && rect.height >= vh * 0.85;
        const isTransparent = style.opacity === '0' || style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent';
        const hasNoText = el.innerText.trim().length === 0;

        if (coversViewport && (isTransparent || style.opacity < 0.05) && hasNoText && el.children.length === 0) {
          el.classList.add('rcr-shield-disabled');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    }
  }

  /**
   * Show Apple-styled toast notification on page
   */
  function showToast(message, icon = '🔓') {
    let toast = document.getElementById('rcr-notification-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rcr-notification-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<span class="rcr-toast-icon">${icon}</span><span>${message}</span>`;
    toast.classList.add('rcr-toast-visible');

    if (toast.__timeout) clearTimeout(toast.__timeout);
    toast.__timeout = setTimeout(() => {
      toast.classList.remove('rcr-toast-visible');
    }, 2400);
  }

  /**
   * Perform an immediate deep unlock sweep across the page
   */
  function performDeepUnlock() {
    cleanDOMTree(document.documentElement);
    neutralizeClickShields();

    // Reset document and body inline handlers directly
    try {
      document.oncontextmenu = null;
      document.onselectstart = null;
      document.ondragstart = null;
      document.oncopy = null;
      document.oncut = null;
      if (document.body) {
        document.body.oncontextmenu = null;
        document.body.onselectstart = null;
        document.body.ondragstart = null;
        document.body.oncopy = null;
        document.body.oncut = null;
      }
    } catch (e) {}

    showToast('Right-click & selection unlocked!', '✨');
  }

  /**
   * Initialize extension
   */
  async function init() {
    try {
      const stored = await chrome.storage.local.get('rcr_settings');
      if (stored && stored.rcr_settings) {
        currentConfig = { ...DEFAULT_CONFIG, ...stored.rcr_settings };
      }
    } catch (err) {
      console.warn('[RCR] Failed to load settings from storage:', err);
    }

    applyDOMState();
    injectMainWorldScript();

    // Clean DOM on ready and observe mutations
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (isSiteEnabled(currentConfig)) {
          cleanDOMTree();
          neutralizeClickShields();
        }
      });
    } else {
      if (isSiteEnabled(currentConfig)) {
        cleanDOMTree();
        neutralizeClickShields();
      }
    }

    // Observe dynamically added elements
    const observer = new MutationObserver((mutations) => {
      if (!isSiteEnabled(currentConfig)) return;
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        if (mutation.type === 'childList') {
          for (let j = 0; j < mutation.addedNodes.length; j++) {
            cleanElement(mutation.addedNodes[j]);
          }
        } else if (mutation.type === 'attributes') {
          cleanElement(mutation.target);
        }
      }
    });

    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: INLINE_ATTRIBUTES
    });

    // Run periodic overlay check for dynamic lazy-loaded shields
    setInterval(() => {
      if (isSiteEnabled(currentConfig) && currentConfig.antiShield) {
        neutralizeClickShields();
      }
    }, 2500);
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'RCR_CONFIG_CHANGED') {
      currentConfig = { ...DEFAULT_CONFIG, ...message.config };
      applyDOMState();
      if (isSiteEnabled(currentConfig)) {
        cleanDOMTree();
        neutralizeClickShields();
      }
      sendResponse({ status: 'ok' });
    } else if (message.type === 'RCR_FORCE_UNLOCK') {
      performDeepUnlock();
      sendResponse({ status: 'unlocked' });
    } else if (message.type === 'RCR_GET_STATUS') {
      sendResponse({
        enabled: isSiteEnabled(currentConfig),
        config: currentConfig,
        hostname: hostname
      });
    }
    return true;
  });

  // Start initialization immediately
  init();
})();
