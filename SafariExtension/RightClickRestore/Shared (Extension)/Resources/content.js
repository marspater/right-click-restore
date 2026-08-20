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
   * Main world script payload embedded directly for 0ms synchronous injection
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
  const eventsToUnblock = new Set(['contextmenu', 'selectstart', 'copy', 'cut', 'dragstart', 'mousedown', 'mouseup']);

  Event.prototype.preventDefault = function() {
    if (config.enabled) {
      if (config.restoreRightClick && this.type === 'contextmenu') return;
      if (config.restoreSelection && (this.type === 'selectstart' || this.type === 'copy' || this.type === 'cut' || this.type === 'dragstart')) return;
      if (config.restoreRightClick && (this.type === 'mousedown' || this.type === 'mouseup') && this.button === 2) return;
    }
    return realPreventDefault.apply(this, arguments);
  };

  try {
    Object.defineProperty(Event.prototype, 'returnValue', {
      get() { return true; },
      set(val) {
        if (config.enabled && (this.type === 'contextmenu' || this.type === 'selectstart' || this.type === 'copy')) return;
      },
      configurable: true,
      enumerable: true
    });
  } catch(e) {}

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
        return realAddEventListener.call(this, type, wrappedListener, options);
      } catch(e) {
        return realAddEventListener.call(this, type, listener, options);
      }
    }
    return realAddEventListener.call(this, type, listener, options);
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

  function injectExternalScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('page-script.js');
      script.async = false;
      (document.head || document.documentElement).appendChild(script);
      script.onload = () => script.remove();
    } catch (e) {}
  }

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

    if (el.style) {
      if (el.style.userSelect === 'none') el.style.userSelect = 'auto';
      if (el.style.webkitUserSelect === 'none') el.style.webkitUserSelect = 'auto';
      if (el.style.pointerEvents === 'none' && (el.tagName === 'IMG' || el.tagName === 'VIDEO')) {
        el.style.pointerEvents = 'auto';
      }
    }
  }

  function cleanDOMTree(root = document.documentElement) {
    if (!root) return;
    cleanElement(root);
    const elements = root.querySelectorAll('*');
    for (let i = 0; i < elements.length; i++) {
      cleanElement(elements[i]);
    }
  }

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
    injectSynchronousScript();
    injectExternalScript();

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

    setInterval(() => {
      if (isSiteEnabled(currentConfig) && currentConfig.antiShield) {
        neutralizeClickShields();
      }
    }, 2500);
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
