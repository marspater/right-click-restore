import {
  ALL_INTERACTIVE_SELECTORS,
  INTERACTIVE_CONTAINERS,
  INTERACTIVE_ELEMENTS,
} from '../shared/constants';
import { getUnshadowedMethod, safeClosest, safeMatches } from '../shared/dom';
import {
  DEFAULT_SETTINGS,
  type Settings,
  validateSettings,
} from '../shared/settings';

export { safeMatches, safeClosest };

export function isInteractiveNode(node: Node | null): boolean {
  if (!node) return false;
  try {
    let curr: Node | null = node;
    if (curr.nodeType === Node.TEXT_NODE) {
      curr = curr.parentElement;
    }
    if (curr instanceof Element) {
      if (safeMatches(curr, INTERACTIVE_ELEMENTS)) return true;
      if (safeClosest(curr, INTERACTIVE_CONTAINERS)) return true;
      if (safeClosest(curr, INTERACTIVE_ELEMENTS)) return true;
    }
  } catch (_e) {
    // Ignore DOM inspection errors on restricted or detached nodes
  }
  return false;
}

// Fast-path interactive event check. When composedPath is available and non-empty,
// iterating over path elements already inspects target and all parent ancestors.
// Returning false directly avoids a redundant call to isInteractiveNode() which
// re-traverses the DOM tree using closest().
export function isInteractiveEvent(event: Event): boolean {
  if (!event) return false;
  try {
    const composedPathFn = getUnshadowedMethod(event, 'composedPath');
    if (composedPathFn) {
      const path = composedPathFn.call(event) as unknown[];
      if (Array.isArray(path) && path.length > 0) {
        return path.some(
          (item) =>
            item instanceof Element &&
            safeMatches(item, ALL_INTERACTIVE_SELECTORS),
        );
      }
    }
  } catch (_e) {
    // Ignore event inspection errors
  }
  return isInteractiveNode(event.target instanceof Node ? event.target : null);
}

export function isModifierPressed(event: Event): boolean {
  if (!event) return false;
  try {
    if (
      (typeof MouseEvent !== 'undefined' && event instanceof MouseEvent) ||
      (typeof KeyboardEvent !== 'undefined' &&
        event instanceof KeyboardEvent) ||
      'shiftKey' in event ||
      'altKey' in event
    ) {
      const e = event as MouseEvent;
      return Boolean(e.shiftKey || e.altKey);
    }
  } catch (_e) {
    // Ignore property inspection errors on synthetic events
  }
  return false;
}

export const SELECTION_EVENTS = new Set([
  'selectstart',
  'dragstart',
  'copy',
  'cut',
  'beforecopy',
]);

const unmaskTimers = new WeakMap<Element, number>();

export function handlePageScriptMessage(
  detail: unknown,
  expectedNonce: string,
  onConfigUpdated?: (config: Settings) => void,
  onUnlock?: () => void,
): boolean {
  if (!detail || typeof detail !== 'object') return false;
  const payload = detail as {
    nonce?: unknown;
    type?: unknown;
    config?: unknown;
  };

  // Cryptographic nonce validation
  if (
    typeof expectedNonce !== 'string' ||
    expectedNonce.length === 0 ||
    payload.nonce !== expectedNonce
  ) {
    return false;
  }

  if (payload.type === 'UPDATE' && payload.config) {
    const validated = validateSettings(payload.config);
    onConfigUpdated?.(validated);
    return true;
  }

  if (payload.type === 'UNLOCK') {
    onUnlock?.();
    return true;
  }

  return false;
}

if (typeof window !== 'undefined') {
  const INIT_SYMBOL = Symbol.for('__rcr_active__');
  const isAlreadyInitialized =
    typeof Event !== 'undefined' &&
    Boolean(
      (Event.prototype.preventDefault as unknown as Record<symbol, boolean>)?.[
        INIT_SYMBOL
      ],
    );

  if (!isAlreadyInitialized) {
    let activeConfig: Settings = { ...DEFAULT_SETTINGS };

    // 128-bit cryptographically secure session nonce
    const sessionNonce =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) +
          Math.random().toString(36).slice(2);

    const channelName = `__rcr_bridge_${sessionNonce}`;

    const unlockPage = () => {
      try {
        window.oncontextmenu = null;
        document.oncontextmenu = null;
        if (document.documentElement)
          document.documentElement.oncontextmenu = null;
        if (document.body) document.body.oncontextmenu = null;
        window.onselectstart = null;
        document.onselectstart = null;
        if (document.documentElement)
          document.documentElement.onselectstart = null;
        if (document.body) document.body.onselectstart = null;
        window.ondragstart = null;
        document.ondragstart = null;
        window.oncopy = null;
        document.oncopy = null;
        if (document.documentElement) document.documentElement.oncopy = null;
        if (document.body) document.body.oncopy = null;
      } catch (_e) {
        // Ignore handler cleanup errors on restricted frames
      }
    };

    // Listen on the unguessable private session channel
    try {
      window.addEventListener(channelName, (e: Event) => {
        try {
          const customEvent = e as CustomEvent;
          handlePageScriptMessage(
            customEvent.detail,
            sessionNonce,
            (newConfig) => {
              activeConfig = newConfig;
            },
            unlockPage,
          );
        } catch (_err) {
          // Ignore message processing errors
        }
      });
    } catch (_e) {
      // Ignore channel setup error
    }

    const sendHandshake = () => {
      try {
        window.dispatchEvent(
          new CustomEvent('__rcr_handshake__', {
            detail: { channel: channelName, nonce: sessionNonce },
          }),
        );
      } catch (_e) {
        // Ignore event dispatch errors
      }
    };

    // Bidirectional handshake: respond if content script requested handshake probe
    try {
      window.addEventListener('__rcr_handshake_req__', () => {
        sendHandshake();
      });
    } catch (_e) {
      // Ignore handshake setup error
    }

    // Announce presence immediately in case content script is already listening
    sendHandshake();

    // Fallback support for legacy injected script element
    try {
      const scriptEl = document.currentScript;
      if (
        scriptEl instanceof HTMLScriptElement &&
        scriptEl.dataset.initialConfig
      ) {
        activeConfig = validateSettings(
          JSON.parse(scriptEl.dataset.initialConfig),
        );
        const legacyUpdate = scriptEl.dataset.updateEvent;
        const legacyUnlock = scriptEl.dataset.unlockEvent;

        scriptEl.removeAttribute('data-initial-config');
        scriptEl.removeAttribute('data-update-event');
        scriptEl.removeAttribute('data-unlock-event');
        scriptEl.remove();

        if (legacyUpdate) {
          window.addEventListener(legacyUpdate, (e: Event) => {
            try {
              const customEvent = e as CustomEvent<Settings>;
              if (
                customEvent.detail &&
                typeof customEvent.detail === 'object'
              ) {
                activeConfig = validateSettings(customEvent.detail);
              }
            } catch (_err) {
              // Ignore legacy update error
            }
          });
        }
        if (legacyUnlock) {
          window.addEventListener(legacyUnlock, unlockPage);
        }
      }
    } catch (_e) {
      // Ignore legacy script dataset read error
    }

    const origPD = Event.prototype.preventDefault;
    const origSP = Event.prototype.stopPropagation;
    const origSIP = Event.prototype.stopImmediatePropagation;

    function isShieldActive(): boolean {
      return activeConfig.enabled !== false;
    }

    function isRightClickActive(): boolean {
      return isShieldActive() && activeConfig.restoreRightClick !== false;
    }

    function isSelectionActive(): boolean {
      return isShieldActive() && activeConfig.restoreSelection !== false;
    }

    function isAntiShieldActive(): boolean {
      return isShieldActive() && activeConfig.antiShield !== false;
    }

    function isForceModeActive(): boolean {
      return isShieldActive() && activeConfig.absoluteForce !== false;
    }

    function isModifierBypassActive(): boolean {
      return isShieldActive() && activeConfig.bypassModifierKey !== false;
    }

    // Hot-path optimization: Check event type BEFORE inspecting DOM path or running
    // CSS selector matches via isInteractiveEvent(). 99.9% of web page events (click,
    // mousemove, keydown, scroll, etc.) are non-target types and exit immediately in O(1),
    // eliminating expensive composedPath() and Element.matches() DOM traversals.
    function shouldBlockEvent(event: Event): boolean {
      if (!event || !isShieldActive()) {
        return false;
      }

      const isContextMenu = event.type === 'contextmenu';
      const isSelection = SELECTION_EVENTS.has(event.type);
      if (!isContextMenu && !isSelection) {
        return false;
      }

      if (isInteractiveEvent(event)) {
        return false;
      }

      if (isModifierBypassActive() && isModifierPressed(event)) {
        return true;
      }
      if (isContextMenu && isRightClickActive()) {
        return true;
      }
      if (isSelection && isSelectionActive()) {
        return true;
      }
      return false;
    }

    Event.prototype.preventDefault = function (this: Event): void {
      if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
      try {
        origPD.apply(this);
      } catch (_e) {
        // Ignore native preventDefault failure
      }
    };

    try {
      const origDescriptor = Object.getOwnPropertyDescriptor(
        Event.prototype,
        'returnValue',
      );
      if (!origDescriptor || origDescriptor.configurable !== false) {
        Object.defineProperty(Event.prototype, 'returnValue', {
          get() {
            if (this && this instanceof Event && shouldBlockEvent(this))
              return true;
            try {
              if (origDescriptor?.get) return origDescriptor.get.call(this);
            } catch (_e) {
              // Ignore native returnValue getter failure
            }
            return true;
          },
          set(val) {
            if (this && this instanceof Event && shouldBlockEvent(this)) return;
            try {
              if (origDescriptor?.set) origDescriptor.set.call(this, val);
            } catch (_e) {
              // Ignore native returnValue setter failure
            }
          },
          configurable: true,
          enumerable: true,
        });
      }
    } catch (_e) {
      // Ignore property definition error
    }

    Event.prototype.stopPropagation = function (this: Event): void {
      if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
      try {
        origSP.apply(this);
      } catch (_e) {
        // Ignore native stopPropagation failure
      }
    };

    Event.prototype.stopImmediatePropagation = function (this: Event): void {
      if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
      try {
        origSIP.apply(this);
      } catch (_e) {
        // Ignore native stopImmediatePropagation failure
      }
    };

    const targets = [
      typeof Window !== 'undefined' ? Window.prototype : null,
      typeof Document !== 'undefined' ? Document.prototype : null,
      typeof HTMLElement !== 'undefined' ? HTMLElement.prototype : null,
      typeof HTMLBodyElement !== 'undefined' ? HTMLBodyElement.prototype : null,
    ].filter(Boolean) as object[];

    for (const prop of [
      'oncontextmenu',
      'onselectstart',
      'ondragstart',
      'oncopy',
      'oncut',
      'onbeforecopy',
    ]) {
      for (const proto of targets) {
        try {
          const origDescriptor = Object.getOwnPropertyDescriptor(proto, prop);
          if (origDescriptor && origDescriptor.configurable === false) {
            continue;
          }
          Object.defineProperty(proto, prop, {
            get() {
              if (isForceModeActive() && !isInteractiveNode(this as Node)) {
                return null;
              }
              try {
                if (origDescriptor?.get) {
                  return origDescriptor.get.call(this);
                }
              } catch (_e) {
                // Ignore native getter call failure
              }
              return undefined;
            },
            set(val) {
              if (isForceModeActive() && !isInteractiveNode(this as Node)) {
                return;
              }
              try {
                if (origDescriptor?.set) {
                  origDescriptor.set.call(this, val);
                }
              } catch (_e) {
                // Ignore native setter call failure
              }
            },
            configurable: true,
            enumerable: true,
          });
        } catch (_err) {
          // Ignore event handler property override failure
        }
      }
    }

    function unmaskMedia(e: MouseEvent) {
      if (!isAntiShieldActive()) return;
      if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number')
        return;
      try {
        if (isInteractiveEvent(e)) return;
        if (
          typeof document === 'undefined' ||
          typeof document.elementsFromPoint !== 'function'
        )
          return;

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        if (!elements || elements.length <= 1) return;

        const isPlayerOrInteractive = elements.some((el) =>
          isInteractiveNode(el),
        );
        if (isPlayerOrInteractive) return;

        const target = elements.find(
          (el, idx) =>
            idx > 0 &&
            el &&
            (el.tagName === 'IMG' ||
              el.tagName === 'VIDEO' ||
              el.tagName === 'CANVAS' ||
              el.tagName === 'PICTURE' ||
              el.tagName === 'SVG' ||
              (el instanceof HTMLElement &&
                (el.innerText || el.textContent || '').trim().length > 0)),
        );
        if (target && elements[0] !== target) {
          for (const el of elements) {
            if (el === target) break;
            if (el && el instanceof HTMLElement) {
              const prevPointerEvents = el.style.pointerEvents;
              const prevPriority =
                el.style.getPropertyPriority('pointer-events');

              el.classList.add('rcr-unmasked-overlay');
              el.style.setProperty('pointer-events', 'none', 'important');

              // Centralized element timer management
              const existingTimer = unmaskTimers.get(el);
              if (existingTimer) {
                clearTimeout(existingTimer);
              }

              const timer = setTimeout(() => {
                try {
                  el.classList.remove('rcr-unmasked-overlay');
                  if (prevPointerEvents) {
                    el.style.setProperty(
                      'pointer-events',
                      prevPointerEvents,
                      prevPriority,
                    );
                  } else {
                    el.style.removeProperty('pointer-events');
                  }
                  unmaskTimers.delete(el);
                } catch (_err) {
                  // Ignore overlay style restoration error
                }
              }, 1000) as unknown as number;

              unmaskTimers.set(el, timer);
            }
          }
        }
      } catch (_err) {
        // Ignore unmaskMedia error
      }
    }

    try {
      document.addEventListener('contextmenu', (e) => unmaskMedia(e), false);
    } catch (_e) {
      // Ignore contextmenu listener attachment error
    }
  }
}
