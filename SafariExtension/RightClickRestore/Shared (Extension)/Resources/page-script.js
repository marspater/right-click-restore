/**
 * Right Click & Selection Restorer - Page Script (MAIN World)
 * Injected synchronously at document_start to neutralize anti-contextmenu and anti-copy scripts.
 */
(function () {
  'use strict';

  if (window.__RCR_PAGE_SCRIPT_INITIALIZED__) return;
  window.__RCR_PAGE_SCRIPT_INITIALIZED__ = true;

  // Active configuration
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

  // Dynamic config updates from content script
  window.addEventListener('__rcr_update_config__', (event) => {
    if (event.detail && typeof event.detail === 'object') {
      config = Object.assign(config, event.detail);
    }
  });

  // Preserve native references
  const realPreventDefault = Event.prototype.preventDefault;
  const realAddEventListener = EventTarget.prototype.addEventListener;

  /**
   * 1. Hook Event.prototype.preventDefault across Event, MouseEvent, TouchEvent, UIEvent
   */
  const eventsToUnblock = new Set(['contextmenu', 'selectstart', 'copy', 'cut', 'dragstart', 'mousedown', 'mouseup']);

  Event.prototype.preventDefault = function () {
    if (config.enabled) {
      if (config.restoreRightClick && this.type === 'contextmenu') {
        return;
      }
      if (config.restoreSelection && (this.type === 'selectstart' || this.type === 'copy' || this.type === 'cut' || this.type === 'dragstart')) {
        return;
      }
      if (config.restoreRightClick && (this.type === 'mousedown' || this.type === 'mouseup') && this.button === 2) {
        return;
      }
    }
    return realPreventDefault.apply(this, arguments);
  };

  /**
   * 2. Hook returnValue and defaultPrevented properties
   */
  try {
    Object.defineProperty(Event.prototype, 'returnValue', {
      get() { return true; },
      set(val) {
        if (config.enabled && (this.type === 'contextmenu' || this.type === 'selectstart' || this.type === 'copy')) {
          return;
        }
      },
      configurable: true,
      enumerable: true
    });
  } catch (e) {}

  /**
   * 3. Neutralize inline property setters (document.oncontextmenu, etc.)
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

  blockedProps.forEach((propName) => {
    targets.forEach((proto) => {
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
      } catch (err) {}
    });
  });

  /**
   * 4. Intercept addEventListener
   * Neutralizes contextmenu & selection cancellation handlers
   */
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (!listener) return realAddEventListener.call(this, type, listener, options);

    if (eventsToUnblock.has(type)) {
      const wrappedListener = function (event) {
        if (config.enabled) {
          if (config.restoreRightClick && event.type === 'contextmenu') {
            if (config.absoluteForce || (config.bypassModifierKey && (event.shiftKey || event.altKey))) {
              // Neutralize the website listener completely
              return;
            }
          }
          if (config.restoreSelection && (event.type === 'selectstart' || event.type === 'copy' || event.type === 'cut' || event.type === 'dragstart')) {
            if (config.absoluteForce) {
              return;
            }
          }
          if (config.restoreRightClick && (event.type === 'mousedown' || event.type === 'mouseup') && event.button === 2) {
            return;
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
   * 5. Capture-phase Top-Level Listeners on Window and Document
   */
  function handleContextMenuCapture(e) {
    if (!config.enabled || !config.restoreRightClick) return;

    // Check if right-clicking on an image/video covered by a transparent overlay
    if (config.antiShield && e.clientX && e.clientY) {
      try {
        const stack = document.elementsFromPoint(e.clientX, e.clientY);
        const media = stack.find((el) => el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'CANVAS');
        if (media && stack[0] !== media) {
          for (const el of stack) {
            if (el === media) break;
            const cs = window.getComputedStyle(el);
            if (cs.position === 'absolute' || cs.position === 'fixed') {
              el.style.setProperty('pointer-events', 'none', 'important');
              setTimeout(() => el.style.removeProperty('pointer-events'), 600);
            }
          }
        }
      } catch (err) {}
    }

    // Always stop event propagation to website handlers in absoluteForce mode
    if (config.absoluteForce || (config.bypassModifierKey && (e.shiftKey || e.altKey))) {
      e.stopImmediatePropagation();
    }
  }

  window.addEventListener('contextmenu', handleContextMenuCapture, true);
  document.addEventListener('contextmenu', handleContextMenuCapture, true);

  // Capture selection/copy events
  ['selectstart', 'copy', 'cut', 'dragstart'].forEach((type) => {
    const handler = (e) => {
      if (!config.enabled || !config.restoreSelection) return;
      if (config.absoluteForce) {
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener(type, handler, true);
    document.addEventListener(type, handler, true);
  });

  // Capture right mousedown / mouseup
  ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach((type) => {
    const handler = (e) => {
      if (!config.enabled || !config.restoreRightClick) return;
      if (e.button === 2) {
        if (config.absoluteForce || (config.bypassModifierKey && (e.shiftKey || e.altKey))) {
          e.stopImmediatePropagation();
        }
      }
    };
    window.addEventListener(type, handler, true);
    document.addEventListener(type, handler, true);
  });

})();
