import { ALL_INTERACTIVE_SELECTORS } from './constants';

const OBJECT_PROTO_METHODS = new Set(
  Object.getOwnPropertyNames(Object.prototype),
);

const INTERACTIVE_TAG_NAMES = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'CANVAS',
  'YTD-APP',
]);

const INTERACTIVE_CLASS_SUBSTRINGS = [
  'ProseMirror',
  'monaco-editor',
  'html5-video-player',
  'ytp-',
  'player-',
];

export function getUnshadowedMethod(
  obj: object,
  methodName: string,
): ((...args: unknown[]) => unknown) | null {
  try {
    // Fast-path: 99.99% of standard DOM nodes do not own the method property on their instance,
    // and DOM methods (matches, closest, etc.) are not on Object.prototype.
    if (
      !OBJECT_PROTO_METHODS.has(methodName) &&
      !Object.prototype.hasOwnProperty.call(obj, methodName)
    ) {
      const fn = (obj as Record<string, unknown>)[methodName];
      if (typeof fn === 'function') {
        return fn as (...args: unknown[]) => unknown;
      }
    }

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

/**
 * Fast-path pre-filtering for interactive DOM elements.
 * Bypasses expensive browser CSS selector matching on standard non-interactive
 * DOM elements (div, span, p, section, li, etc.) during high-frequency event handling
 * and DOM cleaning traversals.
 */
export function isInteractiveElement(element: Element): boolean {
  try {
    const tagName = element.tagName;
    if (tagName && INTERACTIVE_TAG_NAMES.has(tagName)) {
      return true;
    }

    // Fast structural check: if the element has no interactive attributes (role, contenteditable)
    // or class indicators, it cannot match ALL_INTERACTIVE_SELECTORS.
    const hasRole = safeHasAttribute(element, 'role');
    const hasContentEditable =
      safeHasAttribute(element, 'contenteditable') ||
      Boolean((element as HTMLElement).isContentEditable);

    let hasInteractiveClass = false;
    let classNameStr = '';
    const className = element.className;
    if (typeof className === 'string') {
      classNameStr = className;
    } else if (
      className &&
      typeof (className as { baseVal?: unknown }).baseVal === 'string'
    ) {
      classNameStr = (className as { baseVal: string }).baseVal;
    }

    if (classNameStr.length > 0) {
      hasInteractiveClass = INTERACTIVE_CLASS_SUBSTRINGS.some((sub) =>
        classNameStr.includes(sub),
      );
    }

    if (!hasRole && !hasContentEditable && !hasInteractiveClass) {
      return false;
    }
  } catch (_e) {
    // Fall back to full selector check on unexpected property access error
  }

  return safeMatches(element, ALL_INTERACTIVE_SELECTORS);
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

export function safeGetElementById(
  doc: Document,
  id: string,
): HTMLElement | null {
  try {
    const fn = getUnshadowedMethod(doc, 'getElementById');
    if (fn) {
      return fn.call(doc, id) as HTMLElement | null;
    }
    return doc.getElementById(id);
  } catch (_e) {
    return null;
  }
}

export function safeQuerySelectorAll(
  root: ParentNode,
  selector: string,
): Element[] {
  try {
    const fn = getUnshadowedMethod(root, 'querySelectorAll');
    if (fn) {
      return Array.from(fn.call(root, selector) as NodeListOf<Element>);
    }
    return Array.from(root.querySelectorAll(selector));
  } catch (_e) {
    return [];
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
    if (!Object.prototype.hasOwnProperty.call(element, 'shadowRoot')) {
      return element.shadowRoot;
    }
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
    if (!Object.prototype.hasOwnProperty.call(element, 'style')) {
      return element.style;
    }
    const getter = getUnshadowedGetter(element, 'style');
    if (getter) {
      return getter.call(element) as CSSStyleDeclaration | null;
    }
    return element.style;
  } catch (_e) {
    return null;
  }
}
