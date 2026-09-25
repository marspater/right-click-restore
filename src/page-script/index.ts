import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import { getSecureRandomString } from '../shared/crypto';
import { getUnshadowedMethod, safeClosest, safeMatches } from '../shared/dom';
import {
  DEFAULT_SETTINGS,
  type Settings,
  validateSettings,
} from '../shared/settings';

export { getUnshadowedMethod, safeClosest, safeMatches } from '../shared/dom';

const SELECTION_EVENTS = new Set([
  'selectstart',
  'copy',
  'cut',
  'paste',
  'dragstart',
]);

const unmaskTimers = new WeakMap<Element, number>();

export function isInteractiveNode(node: Node | null): boolean {
  if (!node) return false;
  try {
    let curr: Node | null = node;
    if (curr.nodeType === Node.TEXT_NODE) {
      curr = curr.parentElement;
    }
    if (curr instanceof Element) {
      if (safeClosest(curr, ALL_INTERACTIVE_SELECTORS)) return true;
    }
  } catch (_e) {}
  return false;
}

// Fast-path interactive event check. When composedPath is available and non-empty,
// iterating over path elements already inspects target and all parent ancestors.
export function isInteractiveEvent(event: Event): boolean {
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
  } catch (_e) {}
  return isInteractiveNode(event?.target as Node | null);
}

export function isModifierPressed(event: Event): boolean {
  const e = event as KeyboardEvent | MouseEvent;
  return Boolean(e.shiftKey || e.altKey);
}

let activeConfig: Settings = { ...DEFAULT_SETTINGS };

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

function unlockPage(): void {
  // Reset inline handlers or overlays if needed
}

export function handlePageScriptMessage(
  payload: unknown,
  expectedNonce: string,
  onUpdate?: (config: Settings) => void,
  onUnlock?: () => void,
): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const data = payload as {
    nonce?: unknown;
    type?: unknown;
    config?: unknown;
  };

  if (
    typeof expectedNonce !== 'string' ||
    expectedNonce.length === 0 ||
    typeof data.nonce !== 'string' ||
    data.nonce !== expectedNonce
  ) {
    return false;
  }

  if (data.type === 'UNLOCK') {
    onUnlock?.();
    return true;
  }

  if (data.type !== 'UPDATE') return false;
  if (!data.config || typeof data.config !== 'object') return false;

  try {
    const validated = validateSettings(data.config as Partial<Settings>);
    activeConfig = validated;
    onUpdate?.(validated);
    return true;
  } catch (_e) {
    return false;
  }
}

if (typeof window !== 'undefined') {
  const channelName = `__rcr_bridge_${getSecureRandomString()}`;
  const sessionNonce = getSecureRandomString();

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
      } catch (_err) {}
    });
  } catch (_e) {}

  const sendHandshake = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('__rcr_handshake__', {
          detail: { channel: channelName, nonce: sessionNonce },
        }),
      );
    } catch (_e) {}
  };

  try {
    window.addEventListener('__rcr_handshake_req__', () => {
      sendHandshake();
    });
  } catch (_e) {}

  sendHandshake();

  const origPD = Event.prototype.preventDefault;
  const origSP = Event.prototype.stopPropagation;
  const origSIP = Event.prototype.stopImmediatePropagation;

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

  Event.prototype.preventDefault = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      origPD.apply(this);
    } catch (_e) {}
  };

  try {
    const origDescriptor = Object.getOwnPropertyDescriptor(
      Event.prototype,
      'returnValue',
    );
    if (!origDescriptor || origDescriptor.configurable !== false) {
      Object.defineProperty(Event.prototype, 'returnValue', {
        get() {
          if (this && this instanceof Event && shouldBlockEvent(this)) {
            return true;
          }
          try {
            if (origDescriptor?.get) return origDescriptor.get.call(this);
          } catch (_e) {}
          return true;
        },
        set(val) {
          if (this && this instanceof Event && shouldBlockEvent(this)) return;
          try {
            if (origDescriptor?.set) origDescriptor.set.call(this, val);
          } catch (_e) {}
        },
        configurable: true,
        enumerable: true,
      });
    }
  } catch (_e) {}

  Event.prototype.stopPropagation = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      origSP.apply(this);
    } catch (_e) {}
  };

  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      origSIP.apply(this);
    } catch (_e) {}
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
            } catch (_e) {}
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
            } catch (_e) {}
          },
          configurable: true,
          enumerable: true,
        });
      } catch (_err) {}
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
            const prevPriority = el.style.getPropertyPriority('pointer-events');

            el.classList.add('rcr-unmasked-overlay');
            el.style.setProperty('pointer-events', 'none', 'important');

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
              } catch (_err) {}
            }, 1000) as unknown as number;

            unmaskTimers.set(el, timer);
          }
        }
      }
    } catch (_err) {}
  }

  try {
    document.addEventListener('contextmenu', (e) => unmaskMedia(e), false);
  } catch (_e) {}
}
