import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import { getSecureRandomString } from '../shared/crypto';
import {
  getUnshadowedMethod,
  safeClosest,
  safeHasAttribute,
  safeHasAttributes,
  safeMatches,
} from '../shared/dom';
import {
  DEFAULT_SETTINGS,
  type Settings,
  validateSettings,
} from '../shared/settings';

export { getUnshadowedMethod, safeClosest, safeMatches } from '../shared/dom';

const FAST_INTERACTIVE_TAGS = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'CANVAS',
  'YTD-APP',
]);

// Performance optimization: Fast-path interactive element check during event composed path traversals.
// Bypasses expensive safeMatches CSS selector evaluation when an element has no attributes,
// avoiding selector matching on attribute-less DOM nodes while guaranteeing exact selector accuracy.
export function isInteractiveElement(item: Element): boolean {
  try {
    const tag = typeof item.tagName === 'string' ? item.tagName : '';
    if (FAST_INTERACTIVE_TAGS.has(tag)) {
      return true;
    }
    if (!safeHasAttributes(item)) {
      return false;
    }
    return safeMatches(item, ALL_INTERACTIVE_SELECTORS);
  } catch {
    return safeMatches(item, ALL_INTERACTIVE_SELECTORS);
  }
}

export function isInteractiveNode(node: Node | null): boolean {
  if (!node) return false;
  try {
    let curr: Node | null = node;
    if (curr.nodeType === Node.TEXT_NODE) {
      curr = curr.parentElement;
    }
    if (curr instanceof Element) {
      if (isInteractiveElement(curr)) {
        return true;
      }
      if (safeClosest(curr, ALL_INTERACTIVE_SELECTORS)) return true;
    }
  } catch {
    // Suppress errors inspecting interactive node
  }
  return false;
}

// Fast-path interactive event check. When composedPath is available and non-empty,
// iterating over path elements inspects target and all parent ancestors using isInteractiveElement.
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
          (item) => item instanceof Element && isInteractiveElement(item),
        );
      }
    }
  } catch {
    // Suppress errors checking composedPath
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
  } catch {
    // Suppress errors checking modifier keys
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
    typeof payload.nonce !== 'string' ||
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

function setupLegacyScriptFallback(
  onUpdate: (config: Settings) => void,
  onUnlock: () => void,
) {
  try {
    const scriptEl = document.currentScript;
    if (
      scriptEl instanceof HTMLScriptElement &&
      scriptEl.dataset.initialConfig
    ) {
      onUpdate(validateSettings(JSON.parse(scriptEl.dataset.initialConfig)));
      const legacyUpdate = scriptEl.dataset.updateEvent;
      const legacyUnlock = scriptEl.dataset.unlockEvent;

      delete scriptEl.dataset.initialConfig;
      delete scriptEl.dataset.updateEvent;
      delete scriptEl.dataset.unlockEvent;
      scriptEl.remove();

      if (legacyUpdate) {
        window.addEventListener(legacyUpdate, (e: Event) => {
          try {
            const customEvent = e as CustomEvent<Settings>;
            if (customEvent.detail && typeof customEvent.detail === 'object') {
              onUpdate(validateSettings(customEvent.detail));
            }
          } catch {
            // Suppress errors applying legacy config update
          }
        });
      }
      if (legacyUnlock) {
        window.addEventListener(legacyUnlock, onUnlock);
      }
    }
  } catch {
    // Suppress errors reading legacy script element
  }
}

function setupEventInterception(shouldBlockEvent: (event: Event) => boolean) {
  const origPD = Event.prototype.preventDefault;
  const origSP = Event.prototype.stopPropagation;
  const origSIP = Event.prototype.stopImmediatePropagation;

  Event.prototype.preventDefault = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      origPD.apply(this);
    } catch {
      // Suppress errors calling original preventDefault
    }
  };

  try {
    const origDescriptor = Object.getOwnPropertyDescriptor(
      Event.prototype,
      'returnValue',
    );
    if (origDescriptor?.configurable !== false) {
      Object.defineProperty(Event.prototype, 'returnValue', {
        get() {
          if (this && this instanceof Event && shouldBlockEvent(this))
            return true;
          try {
            if (origDescriptor?.get) return origDescriptor.get.call(this);
          } catch {
            // Suppress errors calling original returnValue getter
          }
          return true;
        },
        set(val) {
          if (this && this instanceof Event && shouldBlockEvent(this)) return;
          try {
            if (origDescriptor?.set) origDescriptor.set.call(this, val);
          } catch {
            // Suppress errors calling original returnValue setter
          }
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch {
    // Suppress errors intercepting returnValue property
  }

  Event.prototype.stopPropagation = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      origSP.apply(this);
    } catch {
      // Suppress errors calling original stopPropagation
    }
  };

  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      origSIP.apply(this);
    } catch {
      // Suppress errors calling original stopImmediatePropagation
    }
  };
}

function setupPropertyTraps(isForceModeActive: () => boolean) {
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
        if (origDescriptor?.configurable === false) {
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
            } catch {
              // Suppress errors calling original event getter
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
            } catch {
              // Suppress errors calling original event setter
            }
          },
          configurable: true,
          enumerable: true,
        });
      } catch {
        // Suppress errors defining event handler properties
      }
    }
  }
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
    const sessionNonce = getSecureRandomString();

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
      } catch {
        // Suppress errors clearing inline event handlers
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
        } catch {
          // Suppress errors processing session message
        }
      });
    } catch {
      // Suppress errors listening on session channel
    }

    const sendHandshake = () => {
      try {
        window.dispatchEvent(
          new CustomEvent('__rcr_handshake__', {
            detail: { channel: channelName, nonce: sessionNonce },
          }),
        );
      } catch {
        // Suppress errors dispatching handshake event
      }
    };

    // Bidirectional handshake: respond if content script requested handshake probe
    try {
      window.addEventListener('__rcr_handshake_req__', () => {
        sendHandshake();
      });
    } catch {
      // Suppress errors adding handshake request listener
    }

    // Announce presence immediately in case content script is already listening
    sendHandshake();

    // Fallback support for legacy injected script element
    setupLegacyScriptFallback((newConfig) => {
      activeConfig = newConfig;
    }, unlockPage);

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

      // If modifier bypass is active and modifier key is held, allow native page action
      if (isModifierBypassActive() && isModifierPressed(event)) {
        return false;
      }
      if (isContextMenu && isRightClickActive()) {
        return true;
      }
      if (isSelection && isSelectionActive()) {
        return true;
      }
      return false;
    }

    setupEventInterception(shouldBlockEvent);
    setupPropertyTraps(isForceModeActive);

    function isMediaOrTextElement(el: Element): boolean {
      return (
        el.tagName === 'IMG' ||
        el.tagName === 'VIDEO' ||
        el.tagName === 'CANVAS' ||
        el.tagName === 'PICTURE' ||
        el.tagName === 'SVG' ||
        (el instanceof HTMLElement &&
          (el.innerText || el.textContent || '').trim().length > 0)
      );
    }

    function findUnderlyingTarget(elements: Element[]): Element | undefined {
      return elements.find(
        (el, idx) => idx > 0 && el && isMediaOrTextElement(el),
      );
    }

    function applyUnmaskOverlay(
      el: HTMLElement,
      timers: Map<HTMLElement, number>,
    ) {
      const prevPointerEvents = el.style.pointerEvents;
      const prevPriority = el.style.getPropertyPriority('pointer-events');

      el.classList.add('rcr-unmasked-overlay');
      el.style.setProperty('pointer-events', 'none', 'important');

      const existingTimer = timers.get(el);
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
          timers.delete(el);
        } catch {
          // Suppress errors restoring pointer-events
        }
      }, 1000) as unknown as number;

      timers.set(el, timer);
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

        const target = findUnderlyingTarget(elements);
        if (target && elements[0] !== target) {
          for (const el of elements) {
            if (el === target) break;
            if (el instanceof HTMLElement) {
              applyUnmaskOverlay(el, unmaskTimers);
            }
          }
        }
      } catch {
        // Suppress errors during media unmasking
      }
    }

    try {
      document.addEventListener('contextmenu', (e) => unmaskMedia(e), false);
    } catch {
      // Suppress errors attaching contextmenu listener
    }
  }
}
