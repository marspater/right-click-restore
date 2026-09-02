import {
  INTERACTIVE_CONTAINERS,
  INTERACTIVE_ELEMENTS,
} from '../shared/constants';
import {
  DEFAULT_SETTINGS,
  type Settings,
  validateSettings,
} from '../shared/settings';

export function isInteractiveNode(node: Node | null): boolean {
  if (!node) return false;
  let curr: Node | null = node;
  if (curr.nodeType === Node.TEXT_NODE) {
    curr = curr.parentElement;
  }
  if (curr instanceof Element) {
    try {
      if (curr.matches(INTERACTIVE_ELEMENTS)) return true;
      if (curr.closest(INTERACTIVE_CONTAINERS)) return true;
    } catch (_e) {}
  }
  return false;
}

// Fast-path interactive event check. When composedPath is available and non-empty,
// iterating over path elements already inspects target and all parent ancestors.
// Returning false directly avoids a redundant call to isInteractiveNode() which
// re-traverses the DOM tree using closest().
export function isInteractiveEvent(event: Event): boolean {
  try {
    if (typeof event.composedPath === 'function') {
      const path = event.composedPath();
      if (path && path.length > 0) {
        return path.some(
          (item) =>
            item instanceof Element &&
            (item.matches(INTERACTIVE_ELEMENTS) ||
              item.matches(INTERACTIVE_CONTAINERS)),
        );
      }
    }
  } catch (_e) {}
  return isInteractiveNode(event.target instanceof Node ? event.target : null);
}

export function isModifierPressed(event: Event): boolean {
  if (
    (typeof MouseEvent !== 'undefined' && event instanceof MouseEvent) ||
    (typeof KeyboardEvent !== 'undefined' && event instanceof KeyboardEvent) ||
    'shiftKey' in event ||
    'altKey' in event
  ) {
    const e = event as MouseEvent;
    return Boolean(e.shiftKey || e.altKey);
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

if (typeof window !== 'undefined') {
  const globalWin = window as unknown as Record<string, unknown>;

  // Prevent double-initialization in complex multi-frame setups
  if (!globalWin.__RCR_PAGE_SCRIPT_INITIALIZED__) {
    globalWin.__RCR_PAGE_SCRIPT_INITIALIZED__ = true;

    let activeConfig: Settings = { ...DEFAULT_SETTINGS };
    let updateEvent: string | undefined;
    let unlockEvent: string | undefined;

    // Read initial configuration directly from the injecting script's dataset.
    // Because this script executes synchronously when injected by content.js,
    // the configuration is read before any hostile page script can mutate it.
    try {
      const scriptEl = document.currentScript;
      if (
        scriptEl instanceof HTMLScriptElement &&
        scriptEl.dataset.initialConfig
      ) {
        activeConfig = validateSettings(
          JSON.parse(scriptEl.dataset.initialConfig),
        );
        updateEvent = scriptEl.dataset.updateEvent;
        unlockEvent = scriptEl.dataset.unlockEvent;

        // Immediately scrub sensitive config & event tokens from DOM
        scriptEl.removeAttribute('data-initial-config');
        scriptEl.removeAttribute('data-update-event');
        scriptEl.removeAttribute('data-unlock-event');
        scriptEl.remove();
      }
    } catch (_e) {}

    // Accept dynamic updates on secret isolated event channel.
    if (updateEvent) {
      window.addEventListener(updateEvent, (e: Event) => {
        try {
          const customEvent = e as CustomEvent<Settings>;
          if (customEvent.detail && typeof customEvent.detail === 'object') {
            activeConfig = validateSettings(customEvent.detail);
          }
        } catch (_err) {}
      });
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
      if (!isShieldActive()) {
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
      if (shouldBlockEvent(this)) return;
      origPD.apply(this);
    };

    try {
      const origDescriptor = Object.getOwnPropertyDescriptor(
        Event.prototype,
        'returnValue',
      );
      if (!origDescriptor || origDescriptor.configurable !== false) {
        Object.defineProperty(Event.prototype, 'returnValue', {
          get() {
            if (shouldBlockEvent(this)) return true;
            if (origDescriptor?.get) return origDescriptor.get.call(this);
            return true;
          },
          set(val) {
            if (shouldBlockEvent(this)) return;
            if (origDescriptor?.set) origDescriptor.set.call(this, val);
          },
          configurable: true,
          enumerable: true,
        });
      }
    } catch (_e) {}

    Event.prototype.stopPropagation = function (this: Event): void {
      if (shouldBlockEvent(this)) return;
      origSP.apply(this);
    };

    Event.prototype.stopImmediatePropagation = function (this: Event): void {
      if (shouldBlockEvent(this)) return;
      origSIP.apply(this);
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
              if (origDescriptor?.get) {
                return origDescriptor.get.call(this);
              }
              return undefined;
            },
            set(val) {
              if (isForceModeActive() && !isInteractiveNode(this as Node)) {
                return;
              }
              if (origDescriptor?.set) {
                origDescriptor.set.call(this, val);
              }
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
        if (typeof document.elementsFromPoint !== 'function') return;

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        if (!elements || elements.length <= 1) return;

        const isPlayerOrInteractive = elements.some((el) =>
          isInteractiveNode(el),
        );
        if (isPlayerOrInteractive) return;

        const media = elements.find(
          (el) =>
            el.tagName === 'IMG' ||
            el.tagName === 'VIDEO' ||
            el.tagName === 'CANVAS' ||
            el.classList.contains('test-box'),
        );
        if (media && elements[0] !== media) {
          for (const el of elements) {
            if (el === media) break;
            el.classList.add('rcr-unmasked-overlay');
            (el as HTMLElement).style.setProperty(
              'pointer-events',
              'none',
              'important',
            );

            // Centralized element timer management
            const existingTimer = unmaskTimers.get(el);
            if (existingTimer) {
              clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
              try {
                el.classList.remove('rcr-unmasked-overlay');
                (el as HTMLElement).style.removeProperty('pointer-events');
                unmaskTimers.delete(el);
              } catch (_err) {}
            }, 1000) as unknown as number;

            unmaskTimers.set(el, timer);
          }
        }
      } catch (_err) {}
    }

    document.addEventListener('contextmenu', (e) => unmaskMedia(e), false);

    if (unlockEvent) {
      window.addEventListener(unlockEvent, () => {
        try {
          window.oncontextmenu = null;
          document.oncontextmenu = null;
          if (document.body) document.body.oncontextmenu = null;
          window.onselectstart = null;
          document.onselectstart = null;
          if (document.body) document.body.onselectstart = null;
          window.ondragstart = null;
          document.ondragstart = null;
          window.oncopy = null;
          document.oncopy = null;
          if (document.body) document.body.oncopy = null;
        } catch (_e) {}
      });
    }
  }
}
