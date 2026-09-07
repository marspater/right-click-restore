function findProtoMethod(
  obj: object,
  methodName: string,
): ((...args: unknown[]) => unknown) | null {
  let proto = Object.getPrototypeOf(obj);
  while (proto && proto !== Object.prototype) {
    const desc = Object.getOwnPropertyDescriptor(proto, methodName);
    if (typeof desc?.value === 'function') {
      return desc.value;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return null;
}

export function getUnshadowedMethod(
  obj: object,
  methodName: string,
): ((...args: unknown[]) => unknown) | null {
  try {
    if (!Object.prototype.hasOwnProperty.call(obj, methodName)) {
      const fn = (obj as Record<string, unknown>)[methodName];
      if (typeof fn === 'function') {
        return fn as (...args: unknown[]) => unknown;
      }
    }
    const protoFn = findProtoMethod(obj, methodName);
    if (protoFn) return protoFn;

    const own = Object.getOwnPropertyDescriptor(obj, methodName);
    return typeof own?.value === 'function' ? own.value : null;
  } catch (_e) {
    return null;
  }
}

export function safeMatches(element: Element, selector: string): boolean {
  try {
    const fn = getUnshadowedMethod(element, 'matches');
    return fn ? Boolean(fn.call(element, selector)) : element.matches(selector);
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
    return fn
      ? (fn.call(element, selector) as Element | null)
      : element.closest(selector);
  } catch (_e) {
    return null;
  }
}
