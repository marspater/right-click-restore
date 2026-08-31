import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

export const INTERACTIVE_CONTAINERS =
  '.ProseMirror, .monaco-editor, .html5-video-player, [class*="ytp-"], [class*="player-"], ytd-app, [contenteditable="true"]';

export const INTERACTIVE_ELEMENTS =
  'input, textarea, select, button, [contenteditable], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="button"], [role="menuitem"], [role="dialog"], canvas';

export function isInteractiveNode(node: Node | null): boolean {
  if (!node) return false;
  let curr: Node | null = node;
  const TEXT_NODE_TYPE = typeof Node !== 'undefined' ? Node.TEXT_NODE : 3;
  if (curr.nodeType === TEXT_NODE_TYPE) {
    curr = curr.parentElement;
  }
  if (
    curr &&
    (typeof Element !== 'undefined'
      ? curr instanceof Element
      : 'matches' in curr)
  ) {
    const el = curr as Element;
    try {
      if (el.matches(INTERACTIVE_ELEMENTS)) return true;
      if (el.closest(INTERACTIVE_CONTAINERS)) return true;
    } catch (_e) {}
  }
  return false;
}

export function isInteractiveEvent(event: Event): boolean {
  try {
    if (typeof event.composedPath === 'function') {
      const path = event.composedPath();
      for (const item of path) {
        if (
          item &&
          (typeof Element !== 'undefined'
            ? item instanceof Element
            : 'matches' in item)
        ) {
          const el = item as Element;
          if (
            el.matches(INTERACTIVE_ELEMENTS) ||
            el.matches(INTERACTIVE_CONTAINERS)
          ) {
            return true;
          }
        }
      }
    }
  } catch (_e) {}
  const targetNode =
    event.target &&
    (typeof Node !== 'undefined'
      ? event.target instanceof Node
      : typeof (event.target as Record<string, unknown>).nodeType === 'number')
      ? (event.target as Node)
      : null;
  return isInteractiveNode(targetNode);
}

(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let activeConfig: Settings = { ...DEFAULT_SETTINGS };

  // Read initial configuration directly from the injecting script's dataset.
  // Because this script executes synchronously when injected by content.js,
  // the configuration is read before any hostile page script can mutate it.
  try {
    const scriptEl = document.currentScript;
    if (
      scriptEl instanceof HTMLScriptElement &&
      scriptEl.dataset.initialConfig
    ) {
      activeConfig = {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(scriptEl.dataset.initialConfig),
      };
      // Immediately scrub the sensitive config data from the DOM
      scriptEl.removeAttribute('data-initial-config');
      scriptEl.remove();
    }
  } catch (_e) {}

  // Accept dynamic updates on a hardcoded un-authenticated event.
  window.addEventListener('__rcr_update_config', (e: Event) => {
    try {
      const customEvent = e as CustomEvent<Settings>;
      if (customEvent.detail && typeof customEvent.detail === 'object') {
        activeConfig = { ...DEFAULT_SETTINGS, ...customEvent.detail };
      }
    } catch (_err) {}
  });

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

  function isModifierPressed(event: Event): boolean {
    if (
      event instanceof MouseEvent ||
      event instanceof KeyboardEvent ||
      'shiftKey' in event ||
      'altKey' in event
    ) {
      const e = event as MouseEvent;
      return Boolean(e.shiftKey || e.altKey);
    }
    return false;
  }

  const SELECTION_EVENTS = new Set([
    'selectstart',
    'dragstart',
    'copy',
    'cut',
    'beforecopy',
  ]);

  Event.prototype.preventDefault = function (this: Event): void {
    if (isShieldActive()) {
      if (isModifierBypassActive() && isModifierPressed(this)) {
        return;
      }
      if (
        this.type === 'contextmenu' &&
        isRightClickActive() &&
        !isInteractiveEvent(this)
      ) {
        return;
      }
      if (
        isSelectionActive() &&
        SELECTION_EVENTS.has(this.type) &&
        !isInteractiveEvent(this)
      ) {
        return;
      }
    }
    origPD.apply(this);
  };

  try {
    const origDescriptor = Object.getOwnPropertyDescriptor(
      Event.prototype,
      'returnValue',
    );
    Object.defineProperty(Event.prototype, 'returnValue', {
      get() {
        if (isShieldActive() && !isInteractiveEvent(this)) {
          if (isModifierBypassActive() && isModifierPressed(this)) return true;
          if (this.type === 'contextmenu' && isRightClickActive()) return true;
          if (SELECTION_EVENTS.has(this.type) && isSelectionActive()) {
            return true;
          }
        }
        if (origDescriptor?.get) return origDescriptor.get.call(this);
        return true;
      },
      set(val) {
        if (isShieldActive() && !isInteractiveEvent(this)) {
          if (isModifierBypassActive() && isModifierPressed(this)) return;
          if (this.type === 'contextmenu' && isRightClickActive()) return;
          if (SELECTION_EVENTS.has(this.type) && isSelectionActive()) {
            return;
          }
        }
        if (origDescriptor?.set) origDescriptor.set.call(this, val);
      },
      configurable: true,
      enumerable: true,
    });
  } catch (_e) {}

  Event.prototype.stopPropagation = function (this: Event): void {
    if (isShieldActive() && !isInteractiveEvent(this)) {
      if (isModifierBypassActive() && isModifierPressed(this)) return;
      if (this.type === 'contextmenu' && isRightClickActive()) return;
      if (SELECTION_EVENTS.has(this.type) && isSelectionActive()) return;
    }
    origSP.apply(this);
  };

  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (isShieldActive() && !isInteractiveEvent(this)) {
      if (isModifierBypassActive() && isModifierPressed(this)) return;
      if (this.type === 'contextmenu' && isRightClickActive()) return;
      if (SELECTION_EVENTS.has(this.type) && isSelectionActive()) return;
    }
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
          setTimeout(() => {
            try {
              el.classList.remove('rcr-unmasked-overlay');
              (el as HTMLElement).style.removeProperty('pointer-events');
            } catch (_err) {}
          }, 1000);
        }
      }
    } catch (_err) {}
  }

  document.addEventListener('contextmenu', (e) => unmaskMedia(e), false);

  window.addEventListener('__rcr_force_unlock__', () => {
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
})();
