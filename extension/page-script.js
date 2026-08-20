/**
 * Right Click & Selection Restorer - Page Script (MAIN World)
 * Injected as early as document_start to neutralize anti-contextmenu and anti-copy scripts.
 */
(function () {
  'use strict';

  // Prevent double injection
  if (window.__RCR_INJECTED__) return;
  window.__RCR_INJECTED__ = true;

  // Active configuration state
  let config = {
    enabled: true,
    restoreRightClick: true,
    restoreSelection: true,
    antiShield: true,
    absoluteForce: true,
    bypassModifierKey: true
  };

  // Read initial configuration if passed via dataset
  try {
    const raw = document.documentElement?.dataset?.rcrConfig;
    if (raw) {
      config = Object.assign(config, JSON.parse(raw));
    }
  } catch (e) {}

  // Listen for dynamic config updates from content script
  window.addEventListener('__rcr_update_config__', (event) => {
    if (event.detail && typeof event.detail === 'object') {
      config = Object.assign(config, event.detail);
    }
  });

  // Preserve native references
  const realPreventDefault = Event.prototype.preventDefault;
  const realStopPropagation = Event.prototype.stopPropagation;
  const realStopImmediatePropagation = Event.prototype.stopImmediatePropagation;
  const realAddEventListener = EventTarget.prototype.addEventListener;

  /**
   * 1. Hook Event.prototype.preventDefault
   * Prevents web scripts from cancelling right-click or text-selection events.
   */
  Event.prototype.preventDefault = function () {
    if (config.enabled) {
      if (config.restoreRightClick && this.type === 'contextmenu') {
        return;
      }
      if (config.restoreSelection && (this.type === 'selectstart' || this.type === 'copy' || this.type === 'cut' || this.type === 'dragstart')) {
        return;
      }
    }
    return realPreventDefault.apply(this, arguments);
  };

  /**
   * 2. Hook Object.defineProperty to neutralize inline property setters (oncontextmenu, etc.)
   */
  const blockedProps = ['oncontextmenu', 'onselectstart', 'oncopy', 'oncut', 'ondragstart'];
  const targets = [
    typeof Window !== 'undefined' ? Window.prototype : null,
    typeof Document !== 'undefined' ? Document.prototype : null,
    typeof HTMLElement !== 'undefined' ? HTMLElement.prototype : null,
    typeof HTMLBodyElement !== 'undefined' ? HTMLBodyElement.prototype : null,
    typeof SVGElement !== 'undefined' ? SVGElement.prototype : null,
    typeof Element !== 'undefined' ? Element.prototype : null
  ].filter(Boolean);

  const shadowHandlers = new WeakMap();

  blockedProps.forEach((propName) => {
    targets.forEach((proto) => {
      try {
        const originalDescriptor = Object.getOwnPropertyDescriptor(proto, propName);
        Object.defineProperty(proto, propName, {
          get() {
            if (!config.enabled) {
              return originalDescriptor?.get ? originalDescriptor.get.call(this) : (shadowHandlers.get(this)?.[propName] || null);
            }
            if (propName === 'oncontextmenu' && config.restoreRightClick) return null;
            if (propName !== 'oncontextmenu' && config.restoreSelection) return null;
            return originalDescriptor?.get ? originalDescriptor.get.call(this) : (shadowHandlers.get(this)?.[propName] || null);
          },
          set(val) {
            let objMap = shadowHandlers.get(this);
            if (!objMap) {
              objMap = {};
              shadowHandlers.set(this, objMap);
            }
            objMap[propName] = val;

            if (config.enabled) {
              if (propName === 'oncontextmenu' && config.restoreRightClick) return;
              if (propName !== 'oncontextmenu' && config.restoreSelection) return;
            }
            if (originalDescriptor?.set) {
              try {
                originalDescriptor.set.call(this, val);
              } catch (e) {}
            }
          },
          configurable: true,
          enumerable: true
        });
      } catch (err) {
        // Prototype descriptor may be sealed in edge cases
      }
    });
  });

  /**
   * 3. Intercept EventTarget.prototype.addEventListener
   * Neutralizes inline event handlers attempting to cancel contextmenu.
   */
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (!listener) return realAddEventListener.call(this, type, listener, options);

    if (type === 'contextmenu' || type === 'selectstart' || type === 'copy' || type === 'cut' || type === 'dragstart') {
      const wrappedListener = function (event) {
        if (config.enabled) {
          if (config.restoreRightClick && event.type === 'contextmenu') {
            // Suppress listener if in absoluteForce mode or if user holds modifier
            if (config.absoluteForce || (config.bypassModifierKey && (event.shiftKey || event.altKey))) {
              return;
            }
          }
          if (config.restoreSelection && (event.type === 'selectstart' || event.type === 'copy' || event.type === 'cut' || event.type === 'dragstart')) {
            if (config.absoluteForce) {
              return;
            }
          }
        }

        if (typeof listener === 'function') {
          return listener.apply(this, arguments);
        } else if (listener && typeof listener.handleEvent === 'function') {
          return listener.handleEvent(event);
        }
      };

      try {
        return realAddEventListener.call(this, type, wrappedListener, options);
      } catch (e) {
        return realAddEventListener.call(this, type, listener, options);
      }
    }

    return realAddEventListener.call(this, type, listener, options);
  };

  /**
   * 4. Top-Level Capture Listener on Window
   * Executes before all website scripts and stops blocking propagation.
   */
  window.addEventListener('contextmenu', (e) => {
    if (!config.enabled || !config.restoreRightClick) return;

    // Shift or Option/Alt bypass
    if (config.bypassModifierKey && (e.shiftKey || e.altKey)) {
      e.stopImmediatePropagation();
      return;
    }

    if (config.absoluteForce) {
      e.stopImmediatePropagation();
    }
  }, true);

  // Capture selection/copy events
  ['selectstart', 'copy', 'cut', 'dragstart'].forEach((type) => {
    window.addEventListener(type, (e) => {
      if (!config.enabled || !config.restoreSelection) return;
      if (config.absoluteForce) {
        e.stopImmediatePropagation();
      }
    }, true);
  });

  // Also capture mousedown / mouseup right clicks (button === 2)
  ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach((type) => {
    window.addEventListener(type, (e) => {
      if (!config.enabled || !config.restoreRightClick) return;
      if (e.button === 2 && config.absoluteForce) {
        // Allow the event, but prevent scripts from hijacking it
        e.stopImmediatePropagation();
      }
    }, true);
  });

})();
