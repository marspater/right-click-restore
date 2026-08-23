(() => {
  const TARGET_EVENTS = new Set([
    'contextmenu',
    'selectstart',
    'copy',
    'cut',
    'paste',
    'dragstart',
  ]);

  const TARGET_RETURN_VALUE_EVENTS = new Set([
    'contextmenu',
    'selectstart',
    'copy',
  ]);

  const origPD = Event.prototype.preventDefault;
  const origSP = Event.prototype.stopPropagation;
  const origSIP = Event.prototype.stopImmediatePropagation;
  const origAddEventListener = EventTarget.prototype.addEventListener;
  const origRemoveEventListener = EventTarget.prototype.removeEventListener;

  function isShieldActive(): boolean {
    return document.documentElement?.dataset?.rcrEnabled !== 'false';
  }

  // 1. Intercept preventDefault for protected event types
  Event.prototype.preventDefault = function (this: Event): void {
    if (isShieldActive()) {
      if (TARGET_EVENTS.has(this.type)) {
        return; // Silently discard blocking attempts
      }
      if (this.type === 'mousedown' || this.type === 'mouseup') {
        if ((this as MouseEvent).button === 2) {
          return;
        }
      }
    }
    origPD.apply(this);
  };

  // 2. Intercept returnValue to prevent legacy inline return false blocking
  try {
    const origDescriptor = Object.getOwnPropertyDescriptor(
      Event.prototype,
      'returnValue',
    );
    Object.defineProperty(Event.prototype, 'returnValue', {
      get() {
        if (isShieldActive() && TARGET_RETURN_VALUE_EVENTS.has(this.type)) {
          return true;
        }
        if (origDescriptor?.get) return origDescriptor.get.call(this);
        return true;
      },
      set(val) {
        if (isShieldActive() && TARGET_RETURN_VALUE_EVENTS.has(this.type)) {
          return;
        }
        if (origDescriptor?.set) origDescriptor.set.call(this, val);
      },
      configurable: true,
      enumerable: true,
    });
  } catch (_e) {}

  // 3. Neutralize stopPropagation on contextmenu and selection
  Event.prototype.stopPropagation = function (this: Event): void {
    if (isShieldActive()) {
      if (this.type === 'contextmenu' || this.type === 'selectstart') {
        return;
      }
    }
    origSP.apply(this);
  };

  // 4. Neutralize stopImmediatePropagation
  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (isShieldActive()) {
      if (this.type === 'contextmenu' || this.type === 'selectstart') {
        return;
      }
    }
    origSIP.apply(this);
  };

  // 5. WeakMap-based listener tracking + removeEventListener patch
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

    if (TARGET_EVENTS.has(type) || type === 'mousedown' || type === 'mouseup') {
      const wrappedListener: EventListener = function (
        this: unknown,
        event: Event,
      ) {
        if (isShieldActive()) {
          if (type === 'contextmenu' || type === 'selectstart') {
            // Bypass malicious handler
            return;
          }
          if (
            (type === 'mousedown' || type === 'mouseup') &&
            (event as MouseEvent).button === 2
          ) {
            return;
          }
        }
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
    if (
      listener &&
      (TARGET_EVENTS.has(type) || type === 'mousedown' || type === 'mouseup')
    ) {
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

  // 6. Neutralize prototype property setters (e.g. element.oncontextmenu = ...)
  const targets = [
    typeof Window !== 'undefined' ? Window.prototype : null,
    typeof Document !== 'undefined' ? Document.prototype : null,
    typeof HTMLElement !== 'undefined' ? HTMLElement.prototype : null,
    typeof HTMLBodyElement !== 'undefined' ? HTMLBodyElement.prototype : null,
    typeof SVGElement !== 'undefined' ? SVGElement.prototype : null,
    typeof Element !== 'undefined' ? Element.prototype : null,
  ].filter(Boolean) as object[];

  for (const prop of [
    'oncontextmenu',
    'onselectstart',
    'oncopy',
    'oncut',
    'ondragstart',
  ]) {
    for (const proto of targets) {
      try {
        Object.defineProperty(proto, prop, {
          get() {
            return null;
          },
          set(_val) {
            // Swallow inline assignment
          },
          configurable: true,
          enumerable: true,
        });
      } catch (_err) {}
    }
  }

  // 7. Unmask transparent click shields & overlays under cursor without breaking video players
  function unmaskMedia(e: MouseEvent) {
    if (!isShieldActive()) return;
    if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number')
      return;
    try {
      if (typeof document.elementsFromPoint !== 'function') return;
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length <= 1) return;

      // Never tamper with video player controls (e.g. YouTube, Vimeo, custom video controls)
      const isPlayerControl = elements.some((el) => {
        const className = typeof el.className === 'string' ? el.className : '';
        return (
          el.closest('.html5-video-player') !== null ||
          className.includes('ytp-') ||
          el.closest('button, input, textarea, select, [contenteditable]') !==
            null
        );
      });

      if (isPlayerControl) return;

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

  window.addEventListener('contextmenu', (e) => unmaskMedia(e), true);
  document.addEventListener('contextmenu', (e) => unmaskMedia(e), true);
  window.addEventListener(
    'mousedown',
    (e) => {
      if (e.button === 2) unmaskMedia(e);
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
      window.oncopy = null;
      document.oncopy = null;
      window.oncut = null;
      document.oncut = null;
    } catch (_e) {}
  });
})();
