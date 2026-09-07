export function getUnshadowedMethod(
  obj: object,
  methodName: string,
): ((...args: unknown[]) => unknown) | null {
  try {
    // Fast path: if no own property shadows `methodName`, direct property access
    // retrieves the prototype method in O(1) without prototype descriptor iteration.
    if (!Object.prototype.hasOwnProperty.call(obj, methodName)) {
      const fn = (obj as Record<string, unknown>)[methodName];
      if (typeof fn === 'function') {
        return fn as (...args: unknown[]) => unknown;
      }
    }
    // Clobbered path: walk prototype chain to find genuine unshadowed function
    let proto = Object.getPrototypeOf(obj);
    while (proto && proto !== Object.prototype) {
      const desc = Object.getOwnPropertyDescriptor(proto, methodName);
      if (desc && typeof desc.value === 'function') {
        return desc.value;
      }
      proto = Object.getPrototypeOf(proto);
    }
    // Fallback if defined as own property on mock/plain object in tests
    const own = Object.getOwnPropertyDescriptor(obj, methodName);
    if (own && typeof own.value === 'function') {
      return own.value;
    }
  } catch (_e) {}
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
