import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import {
  getUnshadowedMethod,
  isInteractiveElement,
  safeClosest,
  safeMatches,
} from '../shared/dom';
import {
  DEFAULT_SETTINGS,
  type Settings,
  validateSettings,
} from '../shared/settings';

export {
  getUnshadowedMethod,
  isInteractiveElement,
  safeClosest,
  safeMatches,
} from '../shared/dom';

const SELECTION_EVENTS = new Set(['selectstart', 'copy', 'cut', 'beforecopy']);

export function isInteractiveNode(node: Node | null): boolean {
  if (!node) return false;
  try {
    let curr: Node | null = node;
    if (curr.nodeType === Node.TEXT_NODE) {
      curr = curr.parentElement;
    }
    if (curr instanceof Element) {
      if (isInteractiveElement(curr)) return true;
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
          (item) => item instanceof Element && isInteractiveElement(item),
        );
      }
    }
  } catch (_e) {}
  return isInteractiveNode(event?.target as Node | null);
}

function isModifierPressed(event: Event): boolean {
  const e = event as KeyboardEvent | MouseEvent;
  return Boolean(e.shiftKey || e.altKey);
}

let activeConfig: Settings = { ...DEFAULT_SETTINGS };
let bridgeChannel: string | null = null;
let bridgeNonce: string | null = null;

function isShieldActive(): boolean {
  return activeConfig.enabled;
}

function isRightClickActive(): boolean {
  return activeConfig.restoreRightClick;
}

function isSelectionActive(): boolean {
  return activeConfig.restoreSelection;
}

function isModifierBypassActive(): boolean {
  return activeConfig.bypassModifierKey;
}

export function notifyContentScript(type: string, config: Settings): void {
  if (bridgeChannel === null || bridgeNonce === null) return;
  try {
    window.dispatchEvent(
      new CustomEvent(bridgeChannel, {
        detail: {
          nonce: bridgeNonce,
          type,
          config,
        },
      }),
    );
  } catch (_e) {}
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
  const originalPreventDefault = Event.prototype.preventDefault;
  const originalStopPropagation = Event.prototype.stopPropagation;
  const originalStopImmediatePropagation =
    Event.prototype.stopImmediatePropagation;

  function shouldBlockEvent(event: Event): boolean {
    if (!event || !isShieldActive()) {
      return false;
    }

    const isContextMenu = event.type === 'contextmenu';
    const isSelection = SELECTION_EVENTS.has(event.type);
    if (!isContextMenu && !isSelection) {
      return false;
    }

    const isRightClick = isContextMenu && isRightClickActive();
    const isSelect = isSelection && isSelectionActive();
    if (!isRightClick && !isSelect) {
      return false;
    }

    if (isInteractiveEvent(event)) {
      return false;
    }

    if (isModifierBypassActive() && isModifierPressed(event)) {
      return false;
    }
    return true;
  }

  Event.prototype.preventDefault = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      originalPreventDefault.apply(this);
    } catch (_e) {}
  };

  Event.prototype.stopPropagation = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      originalStopPropagation.apply(this);
    } catch (_e) {}
  };

  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (!this || !(this instanceof Event) || shouldBlockEvent(this)) return;
    try {
      originalStopImmediatePropagation.apply(this);
    } catch (_e) {}
  };

  window.addEventListener('__rcr_handshake_req__', () => {
    if (bridgeChannel === null) {
      bridgeChannel = `__rcr_channel_${Math.random().toString(36).substring(2)}`;
      bridgeNonce = `__rcr_nonce_${Math.random().toString(36).substring(2)}`;
      window.dispatchEvent(
        new CustomEvent('__rcr_handshake__', {
          detail: { channel: bridgeChannel, nonce: bridgeNonce },
        }),
      );
    }
  });
}
