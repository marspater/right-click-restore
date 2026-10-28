import {
  ALL_INTERACTIVE_SELECTORS,
  INTERACTIVE_ELEMENTS,
} from '../shared/constants';
import { getSecureRandomString } from '../shared/crypto';
import {
  getUnshadowedMethod,
  safeAddClass,
  safeApply,
  safeClosest,
  safeElementsFromPoint,
  safeGetParentElement,
  safeGetStyle,
  safeGetTagName,
  safeGetTextContent,
  safeHasAttributes,
  safeMatches,
  safeRemoveClass,
  safeRemoveElement,
} from '../shared/dom';
import {
  DEFAULT_SETTINGS,
  type Settings,
  validateSettings,
} from '../shared/settings';

export {
  getUnshadowedMethod,
  safeApply,
  safeClosest,
  safeMatches,
} from '../shared/dom';

const NativeEvent = typeof Event !== 'undefined' ? Event : null;
const objectToString = Object.prototype.toString;

export function isEventInstance(obj: unknown): obj is Event {
  if (!obj || typeof obj !== 'object') return false;
  if (NativeEvent && obj instanceof NativeEvent) return true;
  try {
    return (
      objectToString.call(obj) === '[object Event]' ||
      ('type' in obj && 'target' in obj && 'preventDefault' in obj)
    );
  } catch {
    return false;
  }
}

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
    const tag = safeGetTagName(item);
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

function isElementNode(item: unknown): item is Element {
  return Boolean(
    item &&
      typeof item === 'object' &&
      'nodeType' in item &&
      (item as Node).nodeType === 1,
  );
}

// Performance optimization: Avoid redundant CSS selector matching on target element.
// isInteractiveElement(curr) already evaluates whether curr matches ALL_INTERACTIVE_SELECTORS.
// Calling safeClosest on curr.parentElement avoids re-evaluating the multi-selector CSS rule
// against curr when isInteractiveElement returns false.
export function isInteractiveNode(node: Node | null): boolean {
  if (!node) return false;
  try {
    let curr: Node | null = node;
    if (curr.nodeType === 3) {
      curr = safeGetParentElement(curr);
    }
    if (isElementNode(curr) || curr instanceof Element) {
      const el = curr as Element;
      if (isInteractiveElement(el)) {
        return true;
      }
      const parent = safeGetParentElement(el);
      if (parent && safeClosest(parent, ALL_INTERACTIVE_SELECTORS)) {
        return true;
      }
    }
  } catch {
    // Suppress errors inspecting interactive node
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
      const path = safeApply(composedPathFn, event, []) as unknown[];
      if (Array.isArray(path) && path.length > 0) {
        return path.some(
          (item) =>
            (isElementNode(item) || item instanceof Element) &&
            isInteractiveElement(item as Element),
        );
      }
    }
  } catch {
    // Suppress errors checking composedPath
  }
  return isInteractiveNode(
    event.target &&
      (isElementNode(event.target) || event.target instanceof Node)
      ? (event.target as Node)
      : null,
  );
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

const OVERLAY_TAGS = new Set(['CANVAS', 'PICTURE', 'SVG']);

// Player wrappers must not exempt the media itself from native-menu restoration.
// Performance optimization: Use O(1) Set lookup instead of regex execution
export function isMediaContextEvent(event: Event): boolean {
  if (event.type !== 'contextmenu') return false;
  const method = getUnshadowedMethod(event, 'composedPath');
  const path = method ? safeApply(method, event, []) : [];
  return (
    Array.isArray(path) &&
    path.some((node) => {
      if (!(node instanceof Element)) return false;
      const tag = safeGetTagName(node);
      return tag === 'VIDEO' || tag === 'AUDIO' || tag === 'IMG';
    })
  );
}

export function findUnderlyingMedia(elements: Element[]): Element | undefined {
  return elements.find((el) => {
    const tag = safeGetTagName(el);
    return tag === 'VIDEO' || tag === 'AUDIO' || tag === 'IMG';
  });
}

const unmaskTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

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

  // Single-evaluation local variable binding prevents getter TOCTOU bypasses
  const nonce = payload.nonce;
  const type = payload.type;
  const config = payload.config;

  // Cryptographic nonce validation
  if (
    typeof expectedNonce !== 'string' ||
    expectedNonce.length === 0 ||
    typeof nonce !== 'string' ||
    nonce !== expectedNonce
  ) {
    return false;
  }

  if (type === 'UPDATE' && config) {
    const validated = validateSettings(config);
    onConfigUpdated?.(validated);
    return true;
  }

  if (type === 'UNLOCK') {
    onUnlock?.();
    return true;
  }

  return false;
}

function setupEventInterception(shouldBlockEvent: (event: Event) => boolean) {
  const origPD = Event.prototype.preventDefault;
  const origSP = Event.prototype.stopPropagation;
  const origSIP = Event.prototype.stopImmediatePropagation;

  Event.prototype.preventDefault = function (this: Event): void {
    if (!this || !isEventInstance(this) || shouldBlockEvent(this)) return;
    try {
      safeApply(origPD, this, []);
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
          if (this && isEventInstance(this) && shouldBlockEvent(this))
            return true;
          try {
            if (origDescriptor?.get)
              return safeApply(origDescriptor.get, this, []);
          } catch {
            // Suppress errors calling original returnValue getter
          }
          return true;
        },
        set(val) {
          if (this && isEventInstance(this) && shouldBlockEvent(this)) return;
          try {
            if (origDescriptor?.set) safeApply(origDescriptor.set, this, [val]);
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
    if (!this || !isEventInstance(this) || shouldBlockEvent(this)) return;
    try {
      safeApply(origSP, this, []);
    } catch {
      // Suppress errors calling original stopPropagation
    }
  };

  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (!this || !isEventInstance(this) || shouldBlockEvent(this)) return;
    try {
      safeApply(origSIP, this, []);
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
                return safeApply(origDescriptor.get, this, []);
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
                safeApply(origDescriptor.set, this, [val]);
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

    // Hot-path optimization: Check event type and active restoration setting BEFORE
    // inspecting DOM path or running CSS selector matches via isInteractiveEvent().
    // Bypasses expensive composedPath() traversals and CSS selector evaluations when
    // features are disabled or events are non-targets.
    function shouldBlockEvent(event: Event): boolean {
      if (!event || !isShieldActive()) {
        return false;
      }

      const isContextMenu = event.type === 'contextmenu';
      const isSelection = SELECTION_EVENTS.has(event.type);

      const isRightClickTarget = isContextMenu && isRightClickActive();
      const isSelectionTarget = isSelection && isSelectionActive();
      if (!isRightClickTarget && !isSelectionTarget) {
        return false;
      }

      if (
        isInteractiveEvent(event) &&
        !isMediaContextEvent(event) &&
        !(isContextMenu && isModifierBypassActive() && isModifierPressed(event))
      ) {
        return false;
      }

      return true;
    }

    setupEventInterception(shouldBlockEvent);
    Object.defineProperty(Event.prototype.preventDefault, INIT_SYMBOL, {
      value: true,
    });
    setupPropertyTraps(isForceModeActive);

    function applyUnmaskOverlay(
      el: HTMLElement,
      timers: WeakMap<HTMLElement, ReturnType<typeof setTimeout>>,
    ) {
      if (timers.has(el)) return;
      const style = safeGetStyle(el);
      if (!style) return;
      const prevPointerEvents = style.pointerEvents;
      const prevPriority = style.getPropertyPriority('pointer-events');

      safeAddClass(el, 'rcr-unmasked-overlay');
      style.setProperty('pointer-events', 'none', 'important');

      const timer = setTimeout(() => {
        try {
          safeRemoveClass(el, 'rcr-unmasked-overlay');
          const currentStyle = safeGetStyle(el);
          if (currentStyle) {
            if (prevPointerEvents) {
              currentStyle.setProperty(
                'pointer-events',
                prevPointerEvents,
                prevPriority,
              );
            } else {
              currentStyle.removeProperty('pointer-events');
            }
          }
          timers.delete(el);
        } catch {
          // Suppress errors restoring pointer-events
        }
      }, 1000);

      timers.set(el, timer);
    }

    function unmaskMedia(e: MouseEvent) {
      if (!isAntiShieldActive()) return;
      if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number')
        return;
      try {
        // Preserve buttons/editors, but allow transparent player surfaces to yield.
        if (
          e.target instanceof Element &&
          safeClosest(e.target, INTERACTIVE_ELEMENTS)
        )
          return;
        if (typeof document === 'undefined') return;

        const elements = safeElementsFromPoint(document, e.clientX, e.clientY);
        if (!elements || elements.length <= 1) return;

        // Performance optimization: Use el.textContent instead of el.innerText to avoid
        // forced synchronous layout reflows on high-frequency mousemove events.
        // Also use constant Set lookups (OVERLAY_TAGS, MEDIA_TAGS) instead of regex tests
        // for faster tag matching in element loops.
        const target =
          findUnderlyingMedia(elements) ??
          elements.find(
            (el, index) =>
              index > 0 &&
              (OVERLAY_TAGS.has(safeGetTagName(el)) ||
                (el instanceof HTMLElement &&
                  safeGetTextContent(el).trim().length > 0)),
          );
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
      // A contextmenu event cannot change the browser's already hit-tested target.
      // Prepare media on hover in force/modifier mode, or on secondary-button down.
      document.addEventListener(
        'mousemove',
        (e) => {
          if (
            isForceModeActive() ||
            (isModifierBypassActive() && isModifierPressed(e))
          ) {
            unmaskMedia(e);
          }
        },
        true,
      );
      document.addEventListener(
        'mousedown',
        (e) => {
          if (e.button === 2) unmaskMedia(e);
        },
        true,
      );
    } catch {
      // Suppress errors attaching contextmenu listener
    }
  }
}
