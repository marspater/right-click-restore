import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

(() => {
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
      activeConfig = {
        ...DEFAULT_SETTINGS,
        ...JSON.parse(scriptEl.dataset.initialConfig),
      };
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
          activeConfig = { ...DEFAULT_SETTINGS, ...customEvent.detail };
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

  const INTERACTIVE_CONTAINERS =
    '.ProseMirror, .monaco-editor, .html5-video-player, [class*="ytp-"], [class*="player-"], ytd-app, [contenteditable="true"]';

  const INTERACTIVE_ELEMENTS =
    'input, textarea, select, button, [contenteditable], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="button"], [role="menuitem"], [role="dialog"], canvas';

  function isInteractiveNode(node: Node | null): boolean {
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

  function isInteractiveEvent(event: Event): boolean {
    try {
      if (typeof event.composedPath === 'function') {
        const path = event.composedPath();
        for (const item of path) {
          if (item instanceof Element) {
            if (
              item.matches(INTERACTIVE_ELEMENTS) ||
              item.matches(INTERACTIVE_CONTAINERS)
            ) {
              return true;
            }
          }
        }
      }
    } catch (_e) {}
    return isInteractiveNode(
      event.target instanceof Node ? event.target : null,
    );
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
})();
