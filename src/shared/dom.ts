export function getUnshadowedMethod(
  obj: object,
  methodName: string,
): ((...args: unknown[]) => unknown) | null {
  try {
    let proto = Object.getPrototypeOf(obj);
    while (proto && proto !== Object.prototype) {
      const desc = Object.getOwnPropertyDescriptor(proto, methodName);
      if (desc && typeof desc.value === 'function') {
        return desc.value;
      }
      proto = Object.getPrototypeOf(proto);
    }
    // Fallback if defined on mock/plain object in tests
    const own = Object.getOwnPropertyDescriptor(obj, methodName);
    if (own && typeof own.value === 'function') {
      return own.value;
    }
  } catch (_e) {
    // Ignore property access errors on cross-origin or restricted objects
  }
  return null;
}

export function getUnshadowedGetter(
  obj: object,
  propName: string,
): ((this: unknown) => unknown) | null {
  try {
    let proto = Object.getPrototypeOf(obj);
    while (proto && proto !== Object.prototype) {
      const desc = Object.getOwnPropertyDescriptor(proto, propName);
      if (desc && typeof desc.get === 'function') {
        return desc.get;
      }
      proto = Object.getPrototypeOf(proto);
    }
    const own = Object.getOwnPropertyDescriptor(obj, propName);
    if (own && typeof own.get === 'function') {
      return own.get;
    }
  } catch (_e) {
    // Ignore property access errors on cross-origin or restricted objects
  }
  return null;
}

export function safeMatches(element: Element, selector: string): boolean {
  try {
    const fn = getUnshadowedMethod(element, 'matches');
    if (fn) {
      return Boolean(fn.call(element, selector));
    }
    return element.matches(selector);
  } catch (_e) {
    return false;
  }
}

export function safeClosest(
  element: Element,
  selector: string,
): Element | null {
  try {
    const fn = getUnshadowedMethod(element, 'closest');
    if (fn) {
      return fn.call(element, selector) as Element | null;
    }
    return element.closest(selector);
  } catch (_e) {
    return null;
  }
}

export function safeHasAttribute(element: Element, attr: string): boolean {
  try {
    const fn = getUnshadowedMethod(element, 'hasAttribute');
    if (fn) {
      return Boolean(fn.call(element, attr));
    }
    return element.hasAttribute(attr);
  } catch (_e) {
    return false;
  }
}

export function safeRemoveAttribute(element: Element, attr: string): void {
  try {
    if (!safeHasAttribute(element, attr)) return;
    const fn = getUnshadowedMethod(element, 'removeAttribute');
    if (fn) {
      fn.call(element, attr);
    } else {
      element.removeAttribute(attr);
    }
  } catch (_e) {
    // Fallback if attribute removal throws
  }
}

export function safeGetShadowRoot(element: Element): ShadowRoot | null {
  try {
    const getter = getUnshadowedGetter(element, 'shadowRoot');
    if (getter) {
      return getter.call(element) as ShadowRoot | null;
    }
    return element.shadowRoot;
  } catch (_e) {
    return null;
  }
}

export function safeGetStyle(element: HTMLElement): CSSStyleDeclaration | null {
  try {
    const getter = getUnshadowedGetter(element, 'style');
    if (getter) {
      return getter.call(element) as CSSStyleDeclaration | null;
    }
    return element.style;
  } catch (_e) {
    return null;
  }
}
