(() => {
  const TARGET_EVENTS = new Set(['contextmenu', 'selectstart']);

  const origPD = Event.prototype.preventDefault;
  const origSP = Event.prototype.stopPropagation;
  const origSIP = Event.prototype.stopImmediatePropagation;
  const origAddEventListener = EventTarget.prototype.addEventListener;
  const origRemoveEventListener = EventTarget.prototype.removeEventListener;

  function isShieldActive(): boolean {
    return document.documentElement?.dataset?.rcrEnabled !== 'false';
  }

  function isInteractiveElement(target: EventTarget | null): boolean {
    if (!target) return false;
    let node: Node | null =
      target instanceof Node
        ? target
        : (target as { correspondingElement?: Node }).correspondingElement ||
          null;

    if (node && node.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    if (node instanceof Element) {
      try {
        if (
          node.closest(
            'input, textarea, select, button, [contenteditable], [contenteditable="true"], .ProseMirror, .monaco-editor, .html5-video-player, video, audio, [class*="ytp-"], [class*="player-"], ytd-app, [role="textbox"], [role="combobox"], [role="button"], [role="menuitem"], canvas, form',
          )
        ) {
          return true;
        }
      } catch (_e) {}
    }
    return false;
  }

  // 1. Intercept preventDefault ONLY for contextmenu and selectstart on non-interactive content
  Event.prototype.preventDefault = function (this: Event): void {
    if (
      isShieldActive() &&
      TARGET_EVENTS.has(this.type) &&
      !isInteractiveElement(this.target)
    ) {
      return; // Silently discard blocking attempts on static content
    }
    origPD.apply(this);
  };

  // 2. Intercept returnValue to prevent legacy inline return false blocking on contextmenu
  try {
    const origDescriptor = Object.getOwnPropertyDescriptor(
      Event.prototype,
      'returnValue',
    );
    Object.defineProperty(Event.prototype, 'returnValue', {
      get() {
        if (
          isShieldActive() &&
          TARGET_EVENTS.has(this.type) &&
          !isInteractiveElement(this.target)
        ) {
          return true;
        }
        if (origDescriptor?.get) return origDescriptor.get.call(this);
        return true;
      },
      set(val) {
        if (
          isShieldActive() &&
          TARGET_EVENTS.has(this.type) &&
          !isInteractiveElement(this.target)
        ) {
          return;
        }
        if (origDescriptor?.set) origDescriptor.set.call(this, val);
      },
      configurable: true,
      enumerable: true,
    });
  } catch (_e) {}

  // 3. Neutralize stopPropagation on contextmenu only on non-interactive elements
  Event.prototype.stopPropagation = function (this: Event): void {
    if (
      isShieldActive() &&
      this.type === 'contextmenu' &&
      !isInteractiveElement(this.target)
    ) {
      return;
    }
    origSP.apply(this);
  };

  // 4. Neutralize stopImmediatePropagation on contextmenu only on non-interactive elements
  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (
      isShieldActive() &&
      this.type === 'contextmenu' &&
      !isInteractiveElement(this.target)
    ) {
      return;
    }
    origSIP.apply(this);
  };

  // 5. WeakMap-based listener tracking strictly scoped to contextmenu and selectstart
  const listenerMap = new WeakMap<
    EventListenerOrEventListenerObject,
    Map<string, EventListener>
  >();

  function getOrCreateMap(
    listener: EventListenerOrEventListenerObject,
  ): Map<string, EventListener> {
    let map = listenerMap.get(listener);
    if (!map) {
      map = new Map<string, EventListener>();
      listenerMap.set(listener, map);
    }
    return map;
  }

  function listenerKey(
    type: string,
    options?: boolean | AddEventListenerOptions,
  ): string {
    const capture =
      typeof options === 'boolean' ? options : options?.capture || false;
    return `${type}|${capture}`;
  }

  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) {
      origAddEventListener.call(this, type, listener, options);
      return;
    }

    // Only wrap contextmenu and selectstart — NEVER wrap mousedown, mouseup, copy, or paste!
    if (type === 'contextmenu' || type === 'selectstart') {
      const wrappedListener: EventListener = function (
        this: unknown,
        event: Event,
      ) {
        if (typeof listener === 'function') {
          listener.apply(this, [event]);
          return;
        }
        if (listener && typeof listener.handleEvent === 'function') {
          listener.handleEvent(event);
          return;
        }
      };

      try {
        const map = getOrCreateMap(listener);
        map.set(listenerKey(type, options), wrappedListener);
      } catch (_e) {}

      try {
        origAddEventListener.call(this, type, wrappedListener, options);
        return;
      } catch (_e) {
        origAddEventListener.call(this, type, listener, options);
        return;
      }
    }

    origAddEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (listener && (type === 'contextmenu' || type === 'selectstart')) {
      try {
        const map = listenerMap.get(listener);
        if (map) {
          const key = listenerKey(type, options);
          const wrapped = map.get(key);
          if (wrapped) {
            map.delete(key);
            origRemoveEventListener.call(this, type, wrapped, options);
            return;
          }
        }
      } catch (_e) {}
    }
    origRemoveEventListener.call(this, type, listener, options);
  };

  // 6. Neutralize prototype property setters on Window, Document, HTMLElement
  const targets = [
    typeof Window !== 'undefined' ? Window.prototype : null,
    typeof Document !== 'undefined' ? Document.prototype : null,
    typeof HTMLElement !== 'undefined' ? HTMLElement.prototype : null,
    typeof HTMLBodyElement !== 'undefined' ? HTMLBodyElement.prototype : null,
  ].filter(Boolean) as object[];

  for (const prop of ['oncontextmenu', 'onselectstart', 'ondragstart']) {
    for (const proto of targets) {
      try {
        Object.defineProperty(proto, prop, {
          get() {
            return null;
          },
          set(_val) {
            // Swallow inline blocking assignments on static prototypes
          },
          configurable: true,
          enumerable: true,
        });
      } catch (_err) {}
    }
  }

  // 7. Unmask transparent click shields without touching interactive inputs
  function unmaskMedia(e: MouseEvent) {
    if (!isShieldActive()) return;
    if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number')
      return;
    try {
      if (isInteractiveElement(e.target)) return;
      if (typeof document.elementsFromPoint !== 'function') return;

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length <= 1) return;

      const isPlayerOrInteractive = elements.some((el) =>
        isInteractiveElement(el),
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

  // 8. Deep Force Unlock Dispatch Receiver
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
    } catch (_e) {}
  });
})();
