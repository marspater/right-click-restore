import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

export const SCRUB_ATTRS = [
  'oncontextmenu',
  'onselectstart',
  'ondragstart',
  'oncopy',
  'oncut',
  'onbeforecopy',
];

export const SCRUB_SELECTOR = [
  ...SCRUB_ATTRS.map((attr) => `[${attr}]`),
  '[style*="user-select"]',
  '[style*="UserSelect"]',
].join(',');

function getUnshadowedMethod(
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

function getUnshadowedGetter(
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
  } catch (_e) {}
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

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  try {
    // Single consolidated check for interactive containers or elements:
    // Element.closest() checks node itself then ancestors in a single fast traversal.
    if (safeClosest(node, ALL_INTERACTIVE_SELECTORS)) {
      return;
    }
  } catch (_e) {
    return;
  }

  if (settings.restoreRightClick) {
    safeRemoveAttribute(node, 'oncontextmenu');
  }

  if (settings.restoreSelection) {
    for (let i = 0; i < SCRUB_ATTRS.length; i++) {
      const attr = SCRUB_ATTRS[i];
      if (attr !== 'oncontextmenu') {
        safeRemoveAttribute(node, attr);
      }
    }
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
      try {
        const style = safeGetStyle(node);
        if (style) {
          if (style.userSelect === 'none') style.userSelect = 'auto';
          if (
            'webkitUserSelect' in style &&
            style.webkitUserSelect === 'none'
          ) {
            style.webkitUserSelect = 'auto';
          }
        }
      } catch (_e) {}
    }
  }

  // Traverse open shadow root if accessible
  try {
    const shadow = safeGetShadowRoot(node);
    if (shadow) {
      cleanDOMTree(shadow, settings);
    }
  } catch (_e) {}
}

export function cleanAddedNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;
  cleanNode(node, settings);
  try {
    for (const child of node.querySelectorAll(SCRUB_SELECTOR)) {
      cleanNode(child, settings);
    }
  } catch (_e) {}
}

export function cleanDOMTree(
  root: ParentNode = document,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element !== 'undefined' && root instanceof Element) {
    cleanNode(root, settings);
  }
  try {
    for (const node of root.querySelectorAll(SCRUB_SELECTOR)) {
      cleanNode(node, settings);
    }
  } catch (_e) {}
}
