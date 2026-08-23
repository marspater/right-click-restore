(() => {
  const PROTECTED = new Set([
    'contextmenu',
    'selectstart',
    'copy',
    'cut',
    'paste',
    'dragstart',
    'mousedown',
    'mouseup',
  ]);

  const origPD = Event.prototype.preventDefault;
  const origSP = Event.prototype.stopPropagation;
  const origSIP = Event.prototype.stopImmediatePropagation;

  // 1. Intercept preventDefault for protected event types
  Event.prototype.preventDefault = function (this: Event): void {
    if (PROTECTED.has(this.type)) {
      if (this.type === 'mousedown' || this.type === 'mouseup') {
        if ((this as MouseEvent).button === 2) {
          return;
        }
      } else {
        return; // Silently discard blocking attempts
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
        if (PROTECTED.has(this.type)) return true;
        if (origDescriptor?.get) return origDescriptor.get.call(this);
        return true;
      },
      set(val) {
        if (PROTECTED.has(this.type)) return;
        if (origDescriptor?.set) origDescriptor.set.call(this, val);
      },
      configurable: true,
      enumerable: true,
    });
  } catch (_e) {}

  // 3. Neutralize stopPropagation on contextmenu and selection
  Event.prototype.stopPropagation = function (this: Event): void {
    if (this.type === 'contextmenu' || this.type === 'selectstart') {
      return;
    }
    origSP.apply(this);
  };

  // 4. Neutralize stopImmediatePropagation
  Event.prototype.stopImmediatePropagation = function (this: Event): void {
    if (this.type === 'contextmenu' || this.type === 'selectstart') {
      return;
    }
    origSIP.apply(this);
  };

  // 5. Neutralize prototype property setters (e.g. element.oncontextmenu = ...)
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
            // Swallow assignment of inline blocker handlers
          },
          configurable: true,
          enumerable: true,
        });
      } catch (_err) {}
    }
  }

  // 6. Unmask transparent click shields & overlays under cursor
  function unmaskMedia(e: MouseEvent) {
    if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number')
      return;
    try {
      if (typeof document.elementsFromPoint !== 'function') return;
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      if (!elements || elements.length <= 1) return;

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
})();
