(() => {
  const origPD = Event.prototype.preventDefault;
  const origSP = Event.prototype.stopPropagation;
  const origSIP = Event.prototype.stopImmediatePropagation;

  function isShieldActive(): boolean {
    return document.documentElement?.dataset?.rcrEnabled !== 'false';
  }

  function isRightClickActive(): boolean {
    return (
      isShieldActive() &&
      document.documentElement?.dataset?.rcrRightClick !== 'false'
    );
  }

  function isSelectionActive(): boolean {
    return (
      isShieldActive() &&
      document.documentElement?.dataset?.rcrSelection !== 'false'
    );
  }

  function isAntiShieldActive(): boolean {
    return (
      isShieldActive() &&
      document.documentElement?.dataset?.rcrAntiShield !== 'false'
    );
  }

  function isForceModeActive(): boolean {
    return (
      isShieldActive() &&
      document.documentElement?.dataset?.rcrForceMode !== 'false'
    );
  }

  function isModifierBypassActive(): boolean {
    return (
      isShieldActive() &&
      document.documentElement?.dataset?.rcrModifierBypass !== 'false'
    );
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

  // 1. Intercept preventDefault with granular capability checks
  Event.prototype.preventDefault = function (this: Event): void {
    if (isShieldActive()) {
      // 1a. Modifier Key Bypass (<kbd>Shift</kbd> / <kbd>Option</kbd>)
      if (isModifierBypassActive() && isModifierPressed(this)) {
        return; // Allows native browser behavior
      }

      // 1b. Right-Click Restoration
      if (
        this.type === 'contextmenu' &&
        isRightClickActive() &&
        !isInteractiveEvent(this)
      ) {
        return;
      }

      // 1c. Text Selection & Copy Restoration on static content
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

  // 2. Intercept returnValue to prevent inline return false blocking
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

  // 3. Neutralize stopPropagation for protected events
  Event.prototype.stopPropagation = function (this: Event): void {
    if (isShieldActive() && !isInteractiveEvent(this)) {
      if (isModifierBypassActive() && isModifierPressed(this)) return;
      if (this.type === 'contextmenu' && isRightClickActive()) return;
      if (SELECTION_EVENTS.has(this.type) && isSelectionActive()) return;
    }
    origSP.apply(this);
  };

  // 4. Neutralize stopImmediatePropagation for protected events
  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (isShieldActive() && !isInteractiveEvent(this)) {
      if (isModifierBypassActive() && isModifierPressed(this)) return;
      if (this.type === 'contextmenu' && isRightClickActive()) return;
      if (SELECTION_EVENTS.has(this.type) && isSelectionActive()) return;
    }
    origSIP.apply(this);
  };

  // 5. Prototype property traps with clean delegation to original descriptors
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
              return; // Neutralize in force mode on static content
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

  // 6. Anti-Shield Overlay Unmasker (Active only when Anti-Shield is ON)
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

  // 7. Deep Force Unlock Dispatch Receiver
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
