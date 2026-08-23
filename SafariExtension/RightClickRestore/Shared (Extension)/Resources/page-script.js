/**
 * Right Click & Selection Restorer - Page Script (MAIN World)
 * Injected at document_start to neutralize anti-contextmenu and anti-copy scripts.
 */
(() => {
  if (window.__RCR_PAGE_SCRIPT_INITIALIZED__) return;
  window.__RCR_PAGE_SCRIPT_INITIALIZED__ = true;

  let config = {
    enabled: true,
    restoreRightClick: true,
    restoreSelection: true,
    antiShield: true,
    absoluteForce: true,
    bypassModifierKey: true
  };

  try {
    const raw = document.documentElement?.dataset?.rcrConfig;
    if (raw) config = Object.assign(config, JSON.parse(raw));
  } catch (_e) {}

  window.addEventListener('__rcr_update_config__', (event) => {
    if (event.detail && typeof event.detail === 'object') {
      config = Object.assign(config, event.detail);
    }
  });

  const realPreventDefault = Event.prototype.preventDefault;
  const realAddEventListener = EventTarget.prototype.addEventListener;
  const realRemoveEventListener = EventTarget.prototype.removeEventListener;

  // Target events that anti-right-click scripts abuse
  const eventsToUnblock = new Set([
    'contextmenu',
    'selectstart',
    'dragstart',
    'mousedown',
    'mouseup'
  ]);

  // --- Bug 1 Fix: returnValue override with original descriptor fallback ---
  try {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Event.prototype, 'returnValue');
    const targetReturnValueEvents = new Set(['contextmenu', 'selectstart', 'copy']);

    Object.defineProperty(Event.prototype, 'returnValue', {
      get() {
        if (config.enabled && targetReturnValueEvents.has(this.type)) {
          return true;
        }
        // Delegate to original getter for all other events
        if (originalDescriptor?.get) {
          return originalDescriptor.get.call(this);
        }
        return true;
      },
      set(val) {
        if (config.enabled && targetReturnValueEvents.has(this.type)) {
          return; // Swallow — prevent cancellation of our target events
        }
        // Delegate to original setter for all other events
        if (originalDescriptor?.set) {
          originalDescriptor.set.call(this, val);
        }
      },
      configurable: true,
      enumerable: true
    });
  } catch (_e) {}

  // 1. Prevent default override — only for target events
  Event.prototype.preventDefault = function () {
    if (config.enabled) {
      if (config.restoreRightClick && this.type === 'contextmenu') return;
      if (
        config.restoreSelection &&
        (this.type === 'selectstart' ||
          this.type === 'copy' ||
          this.type === 'cut' ||
          this.type === 'dragstart')
      )
        return;
      if (
        config.restoreRightClick &&
        (this.type === 'mousedown' || this.type === 'mouseup') &&
        this.button === 2
      )
        return;
    }
    return realPreventDefault.apply(this, arguments);
  };

  // 3. Neutralize property setters on prototypes
  const blockedProps = ['oncontextmenu', 'onselectstart', 'oncopy', 'oncut', 'ondragstart'];
  const targets = [
    typeof Window !== 'undefined' ? Window.prototype : null,
    typeof Document !== 'undefined' ? Document.prototype : null,
    typeof HTMLElement !== 'undefined' ? HTMLElement.prototype : null,
    typeof HTMLBodyElement !== 'undefined' ? HTMLBodyElement.prototype : null,
    typeof SVGElement !== 'undefined' ? SVGElement.prototype : null,
    typeof Element !== 'undefined' ? Element.prototype : null
  ].filter(Boolean);

  blockedProps.forEach((propName) => {
    targets.forEach((proto) => {
      try {
        Object.defineProperty(proto, propName, {
          get() {
            return null;
          },
          set(_val) {
            if (config.enabled) {
              if (propName === 'oncontextmenu' && config.restoreRightClick) return;
              if (propName !== 'oncontextmenu' && config.restoreSelection) return;
            }
          },
          configurable: true,
          enumerable: true
        });
      } catch (_err) {}
    });
  });

  // --- Bug 2 Fix: WeakMap-based listener tracking + removeEventListener patch ---
  const listenerMap = new WeakMap();

  function getOrCreateMap(listener) {
    let map = listenerMap.get(listener);
    if (!map) {
      map = new Map();
      listenerMap.set(listener, map);
    }
    return map;
  }

  // Build a stable key for deduplication: "type|capture"
  function listenerKey(type, options) {
    const capture = typeof options === 'boolean' ? options : options?.capture || false;
    return `${type}|${capture}`;
  }

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (!listener) return realAddEventListener.call(this, type, listener, options);

    if (eventsToUnblock.has(type)) {
      const wrappedListener = function (event) {
        if (config.enabled) {
          if (config.restoreRightClick && event.type === 'contextmenu') {
            if (
              config.absoluteForce ||
              (config.bypassModifierKey && (event.shiftKey || event.altKey))
            )
              return;
          }
          if (
            config.restoreSelection &&
            (event.type === 'selectstart' || event.type === 'dragstart')
          ) {
            if (config.absoluteForce) return;
          }
          if (
            config.restoreRightClick &&
            (event.type === 'mousedown' || event.type === 'mouseup') &&
            event.button === 2
          ) {
            return;
          }
        }
        if (typeof listener === 'function') return listener.apply(this, arguments);
        else if (listener && typeof listener.handleEvent === 'function')
          return listener.handleEvent(event);
      };

      // Store mapping so removeEventListener can find the wrapper
      try {
        const map = getOrCreateMap(listener);
        map.set(listenerKey(type, options), wrappedListener);
      } catch (_e) {}

      try {
        return realAddEventListener.call(this, type, wrappedListener, options);
      } catch (_e) {
        return realAddEventListener.call(this, type, listener, options);
      }
    }
    return realAddEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (type, listener, options) {
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
      } catch (_e) {}
    }
    return realRemoveEventListener.call(this, type, listener, options);
  };

  // 5. Unmask media underneath cursor (only on right-click)
  function unmaskMedia(e) {
    if (
      !config.enabled ||
      !config.antiShield ||
      !e ||
      typeof e.clientX !== 'number' ||
      typeof e.clientY !== 'number'
    )
      return;
    if (
      e.clientX < 0 ||
      e.clientY < 0 ||
      e.clientX > window.innerWidth ||
      e.clientY > window.innerHeight
    )
      return;

    try {
      if (typeof document.elementsFromPoint !== 'function') return;
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length <= 1) return;

      const media = elements.find(
        (el) => el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS'
      );
      if (media && elements[0] !== media) {
        for (const el of elements) {
          if (el === media) break;
          el.classList.add('rcr-unmasked-overlay');
          el.style.setProperty('pointer-events', 'none', 'important');
          setTimeout(() => {
            try {
              el.classList.remove('rcr-unmasked-overlay');
              el.style.removeProperty('pointer-events');
            } catch (_err) {}
          }, 800);
        }
      }
    } catch (_err) {}
  }

  // 6. Capture listeners
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

  ['selectstart', 'dragstart'].forEach((type) => {
    const handler = (e) => {
      if (!config.enabled || !config.restoreSelection) return;
      if (config.absoluteForce) e.stopImmediatePropagation();
    };
    window.addEventListener(type, handler, true);
    document.addEventListener(type, handler, true);
  });
})();
