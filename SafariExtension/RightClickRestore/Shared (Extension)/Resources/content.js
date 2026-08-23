/**
 * Right Click & Selection Restorer - Content Script
 * Synchronously injects main world overrides, sanitizes DOM, and neutralizes overlays.
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

  function isSiteEnabled(cfg) {
    if (!cfg.enabled) return false;
    const disabledList = cfg.disabledDomains || [];
    return !disabledList.some((domain) => hostname === domain || hostname.endsWith('.' + domain));
  }

  /**
   * Main world script payload — synchronized with page-script.js
   * Fixes applied:
   *   Bug 1: returnValue override with original descriptor fallback
   *   Bug 2: WeakMap listener tracking + removeEventListener patch
   */
  const MAIN_WORLD_SCRIPT = `
(function() {
  if (window.__RCR_PAGE_SCRIPT_INITIALIZED__) return;
  window.__RCR_PAGE_SCRIPT_INITIALIZED__ = true;

  let config = ${JSON.stringify(DEFAULT_CONFIG)};
  try {
    const raw = document.documentElement?.dataset?.rcrConfig;
    if (raw) config = Object.assign(config, JSON.parse(raw));
  } catch(e) {}

  window.addEventListener('__rcr_update_config__', (event) => {
    if (event.detail && typeof event.detail === 'object') {
      config = Object.assign(config, event.detail);
    }
  });

  const realPreventDefault = Event.prototype.preventDefault;
  const realAddEventListener = EventTarget.prototype.addEventListener;
  const realRemoveEventListener = EventTarget.prototype.removeEventListener;
  const eventsToUnblock = new Set(['contextmenu', 'selectstart', 'dragstart', 'mousedown', 'mouseup']);

  // Bug 1 Fix: returnValue override with original descriptor fallback
  try {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Event.prototype, 'returnValue');
    const targetReturnValueEvents = new Set(['contextmenu', 'selectstart', 'copy']);

    Object.defineProperty(Event.prototype, 'returnValue', {
      get() {
        if (config.enabled && targetReturnValueEvents.has(this.type)) return true;
        if (originalDescriptor && originalDescriptor.get) return originalDescriptor.get.call(this);
        return true;
      },
      set(val) {
        if (config.enabled && targetReturnValueEvents.has(this.type)) return;
        if (originalDescriptor && originalDescriptor.set) originalDescriptor.set.call(this, val);
      },
      configurable: true,
      enumerable: true
    });
  } catch(e) {}

  Event.prototype.preventDefault = function() {
    if (config.enabled) {
      if (config.restoreRightClick && this.type === 'contextmenu') return;
      if (config.restoreSelection && (this.type === 'selectstart' || this.type === 'copy' || this.type === 'cut' || this.type === 'dragstart')) return;
      if (config.restoreRightClick && (this.type === 'mousedown' || this.type === 'mouseup') && this.button === 2) return;
    }
    return realPreventDefault.apply(this, arguments);
  };

  const blockedProps = ['oncontextmenu', 'onselectstart', 'oncopy', 'oncut', 'ondragstart'];
  const targets = [
    typeof Window !== 'undefined' ? Window.prototype : null,
    typeof Document !== 'undefined' ? Document.prototype : null,
    typeof HTMLElement !== 'undefined' ? HTMLElement.prototype : null,
    typeof HTMLBodyElement !== 'undefined' ? HTMLBodyElement.prototype : null,
    typeof SVGElement !== 'undefined' ? SVGElement.prototype : null,
    typeof Element !== 'undefined' ? Element.prototype : null
  ].filter(Boolean);

  blockedProps.forEach(propName => {
    targets.forEach(proto => {
      try {
        Object.defineProperty(proto, propName, {
          get() { return null; },
          set(val) {
            if (config.enabled) {
              if (propName === 'oncontextmenu' && config.restoreRightClick) return;
              if (propName !== 'oncontextmenu' && config.restoreSelection) return;
            }
          },
          configurable: true,
          enumerable: true
        });
      } catch(err) {}
    });
  });

  // Bug 2 Fix: WeakMap-based listener tracking + removeEventListener patch
  const listenerMap = new WeakMap();

  function getOrCreateMap(listener) {
    let map = listenerMap.get(listener);
    if (!map) { map = new Map(); listenerMap.set(listener, map); }
    return map;
  }

  function listenerKey(type, options) {
    const capture = typeof options === 'boolean' ? options : (options?.capture || false);
    return type + '|' + capture;
  }

  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (!listener) return realAddEventListener.call(this, type, listener, options);
    if (eventsToUnblock.has(type)) {
      const wrappedListener = function(event) {
        if (config.enabled) {
          if (config.restoreRightClick && event.type === 'contextmenu') {
            if (config.absoluteForce || (config.bypassModifierKey && (event.shiftKey || event.altKey))) return;
          }
          if (config.restoreSelection && (event.type === 'selectstart' || event.type === 'dragstart')) {
            if (config.absoluteForce) return;
          }
          if (config.restoreRightClick && (event.type === 'mousedown' || event.type === 'mouseup') && event.button === 2) {
            return;
          }
        }
        if (typeof listener === 'function') return listener.apply(this, arguments);
        else if (listener && typeof listener.handleEvent === 'function') return listener.handleEvent(event);
      };
      try {
        const map = getOrCreateMap(listener);
        map.set(listenerKey(type, options), wrappedListener);
      } catch(e) {}
      try {
        return realAddEventListener.call(this, type, wrappedListener, options);
      } catch(e) {
        return realAddEventListener.call(this, type, listener, options);
      }
    }
    return realAddEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    if (listener && eventsToUnblock.has(type)) {
      try {
        const map = listenerMap.get(listener);
        if (map) {
          const key = listenerKey(type, options);
          const wrapped = map.get(key);
          if (wrapped) {
            map.delete(key);
            return realRemoveEventListener.call(this, type, wrapped, options);
          }
        }
      } catch(e) {}
    }
    return realRemoveEventListener.call(this, type, listener, options);
  };

  function unmaskMedia(e) {
    if (!config.enabled || !config.antiShield || !e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return;
    if (e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight) return;
    try {
      if (typeof document.elementsFromPoint !== 'function') return;
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length <= 1) return;
      const media = elements.find(el => el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS');
      if (media && elements[0] !== media) {
        for (const el of elements) {
          if (el === media) break;
          el.classList.add('rcr-unmasked-overlay');
          el.style.setProperty('pointer-events', 'none', 'important');
          setTimeout(() => {
            try {
              el.classList.remove('rcr-unmasked-overlay');
              el.style.removeProperty('pointer-events');
            } catch(err) {}
          }, 800);
        }
      }
    } catch(err) {}
  }

  function handleContextMenu(e) {
    if (!config.enabled || !config.restoreRightClick) return;
    unmaskMedia(e);
    if (config.absoluteForce || (config.bypassModifierKey && (e.shiftKey || e.altKey))) {
      e.stopImmediatePropagation();
    }
  }

  function handleMouseDown(e) {
    if (!config.enabled || !config.restoreRightClick) return;
    if (e.button === 2) {
      unmaskMedia(e);
      if (config.absoluteForce || (config.bypassModifierKey && (e.shiftKey || e.altKey))) {
        e.stopImmediatePropagation();
      }
    }
  }

  window.addEventListener('contextmenu', handleContextMenu, true);
  document.addEventListener('contextmenu', handleContextMenu, true);
  window.addEventListener('mousedown', handleMouseDown, true);
  document.addEventListener('mousedown', handleMouseDown, true);

  ['selectstart', 'dragstart'].forEach(type => {
    const handler = (e) => {
      if (!config.enabled || !config.restoreSelection) return;
      if (config.absoluteForce) e.stopImmediatePropagation();
    };
    window.addEventListener(type, handler, true);
    document.addEventListener(type, handler, true);
  });
})();
`;

  function injectSynchronousScript() {
    try {
      const script = document.createElement('script');
      script.textContent = MAIN_WORLD_SCRIPT;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  // Bug 8 Fix: Removed injectExternalScript() — inline script handles everything

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

    window.dispatchEvent(new CustomEvent('__rcr_update_config__', { detail: payload }));
  }

  // Bug 6/7 Fix: Removed onmousedown, onmouseup, onpaste — too aggressive,
  // breaks YouTube player controls. addEventListener wrapper handles right-click.
  const INLINE_ATTRIBUTES = [
    'oncontextmenu',
    'onselectstart',
    'ondragstart',
    'oncopy',
    'oncut'
  ];

  function cleanElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;

    for (let i = 0; i < INLINE_ATTRIBUTES.length; i++) {
      if (el.hasAttribute(INLINE_ATTRIBUTES[i])) {
        try {
          el.removeAttribute(INLINE_ATTRIBUTES[i]);
        } catch (e) {}
      }
    }

    if (el.style) {
      if (el.style.userSelect === 'none') el.style.userSelect = 'auto';
      if (el.style.webkitUserSelect === 'none') el.style.webkitUserSelect = 'auto';
      if (el.style.pointerEvents === 'none' && (el.tagName === 'IMG' || el.tagName === 'VIDEO')) {
        el.style.pointerEvents = 'auto';
      }
    }
  }

  // Bug 9 Fix: Use targeted attribute selectors instead of querySelectorAll('*')
  function cleanDOMTree(root = document.documentElement) {
    if (!root) return;
    cleanElement(root);

    // Only query elements that actually have the inline attributes we target
    const selector = INLINE_ATTRIBUTES.map(attr => '[' + attr + ']').join(',');
    try {
      const elements = root.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        cleanElement(elements[i]);
      }
    } catch (e) {}

    // Also fix user-select:none on text-like elements
    try {
      const selectBlocked = root.querySelectorAll('[style*="user-select"]');
      for (let i = 0; i < selectBlocked.length; i++) {
        cleanElement(selectBlocked[i]);
      }
    } catch (e) {}
  }

  // Bug 3 Fix: Pre-filter shields with cheap checks, use requestIdleCallback for batching
  function neutralizeClickShields() {
    if (!isSiteEnabled(currentConfig) || !currentConfig.antiShield) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Only query elements with explicit positioning styles — much smaller set
    const candidates = document.querySelectorAll(
      '[style*="position: fixed"], [style*="position:fixed"], ' +
      '[style*="position: absolute"], [style*="position:absolute"]'
    );

    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (el.id === 'rcr-notification-toast') continue;
      if (el.classList.contains('rcr-shield-disabled')) continue;

      // Cheap pre-filter: skip elements with visible content
      if (el.children.length > 0) continue;
      if (el.innerText && el.innerText.trim().length > 0) continue;

      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex, 10);
      if (isNaN(zIndex) || zIndex <= 100) continue;

      const rect = el.getBoundingClientRect();
      const coversViewport = rect.width >= vw * 0.85 && rect.height >= vh * 0.85;
      if (!coversViewport) continue;

      const isTransparent = style.opacity === '0' || parseFloat(style.opacity) < 0.05 ||
                            style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent';

      if (isTransparent) {
        el.classList.add('rcr-shield-disabled');
        el.style.setProperty('pointer-events', 'none', 'important');
      }
    }
  }

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

  function performDeepUnlock() {
    cleanDOMTree(document.documentElement);
    neutralizeClickShields();
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

  async function init() {
    // Bug 8 Fix: Only inject inline script — external script is redundant
    injectSynchronousScript();

    try {
      const stored = await chrome.storage.local.get('rcr_settings');
      if (stored && stored.rcr_settings) {
        currentConfig = { ...DEFAULT_CONFIG, ...stored.rcr_settings };
      }
    } catch (err) {}

    applyDOMState();

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

    // Bug 3 Fix: Only run in top frame, use requestIdleCallback, longer interval
    if (window === window.top) {
      const scheduleShieldScan = typeof requestIdleCallback === 'function'
        ? (fn) => requestIdleCallback(fn, { timeout: 2000 })
        : (fn) => setTimeout(fn, 0);

      setInterval(() => {
        if (isSiteEnabled(currentConfig) && currentConfig.antiShield) {
          scheduleShieldScan(neutralizeClickShields);
        }
      }, 8000);
    }
  }

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

  init();
})();
