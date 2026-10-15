const OBJECT_PROTO_METHODS = new Set(
  Object.getOwnPropertyNames(Object.prototype),
);

const nativeReflectApply =
  typeof Reflect !== 'undefined' && typeof Reflect.apply === 'function'
    ? Reflect.apply
    : null;
const nativeFuncApplyCall = Function.prototype.call.bind(
  Function.prototype.apply,
);

export function safeApply<T, A extends unknown[], R>(
  fn: (this: T, ...args: A) => R,
  thisArg: T,
  args: A | IArguments = [] as unknown as A,
): R {
  if (nativeReflectApply) {
    return nativeReflectApply(fn, thisArg, args as ArrayLike<unknown>) as R;
  }
  return nativeFuncApplyCall(fn, thisArg, args as ArrayLike<unknown>) as R;
}

export function getUnshadowedMethod(
  obj: object,
  methodName: string,
): ((...args: unknown[]) => unknown) | null {
  try {
    // Fast-path: 99.99% of standard DOM nodes do not own the method property on their instance,
    // and DOM methods (matches, closest, etc.) are not on Object.prototype.
    if (
      !OBJECT_PROTO_METHODS.has(methodName) &&
      !Object.hasOwn(obj, methodName)
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

// Performance optimization: Lazy-cached native DOM prototype methods invoked directly via safeApply.
// Fast-paths execution for standard DOM nodes when the instance does not own a clobbered property,
// bypassing Object.prototype checks, index property reads, and unshadowed prototype chain walks.

type NativeDOMMethod<T extends (..._args: never[]) => unknown> = T | null;

let nativeMatchesMethod:
  | NativeDOMMethod<typeof Element.prototype.matches>
  | undefined;
function getNativeMatchesMethod(): NativeDOMMethod<
  typeof Element.prototype.matches
> {
  if (nativeMatchesMethod === undefined) {
    try {
      nativeMatchesMethod =
        typeof Element !== 'undefined' ? Element.prototype.matches : null;
    } catch {
      nativeMatchesMethod = null;
    }
  }
  return nativeMatchesMethod;
}

let nativeClosestMethod:
  | NativeDOMMethod<typeof Element.prototype.closest>
  | undefined;
function getNativeClosestMethod(): NativeDOMMethod<
  typeof Element.prototype.closest
> {
  if (nativeClosestMethod === undefined) {
    try {
      nativeClosestMethod =
        typeof Element !== 'undefined' ? Element.prototype.closest : null;
    } catch {
      nativeClosestMethod = null;
    }
  }
  return nativeClosestMethod;
}

let nativeHasAttributeMethod:
  | NativeDOMMethod<typeof Element.prototype.hasAttribute>
  | undefined;
function getNativeHasAttributeMethod(): NativeDOMMethod<
  typeof Element.prototype.hasAttribute
> {
  if (nativeHasAttributeMethod === undefined) {
    try {
      nativeHasAttributeMethod =
        typeof Element !== 'undefined' ? Element.prototype.hasAttribute : null;
    } catch {
      nativeHasAttributeMethod = null;
    }
  }
  return nativeHasAttributeMethod;
}

let nativeHasAttributesMethod:
  | NativeDOMMethod<typeof Element.prototype.hasAttributes>
  | undefined;
function getNativeHasAttributesMethod(): NativeDOMMethod<
  typeof Element.prototype.hasAttributes
> {
  if (nativeHasAttributesMethod === undefined) {
    try {
      nativeHasAttributesMethod =
        typeof Element !== 'undefined' ? Element.prototype.hasAttributes : null;
    } catch {
      nativeHasAttributesMethod = null;
    }
  }
  return nativeHasAttributesMethod;
}

let nativeRemoveAttributeMethod:
  | NativeDOMMethod<typeof Element.prototype.removeAttribute>
  | undefined;
function getNativeRemoveAttributeMethod(): NativeDOMMethod<
  typeof Element.prototype.removeAttribute
> {
  if (nativeRemoveAttributeMethod === undefined) {
    try {
      nativeRemoveAttributeMethod =
        typeof Element !== 'undefined'
          ? Element.prototype.removeAttribute
          : null;
    } catch {
      nativeRemoveAttributeMethod = null;
    }
  }
  return nativeRemoveAttributeMethod;
}

let nativeGetElementByIdMethod:
  | NativeDOMMethod<typeof Document.prototype.getElementById>
  | undefined;
function getNativeGetElementByIdMethod(): NativeDOMMethod<
  typeof Document.prototype.getElementById
> {
  if (nativeGetElementByIdMethod === undefined) {
    try {
      nativeGetElementByIdMethod =
        typeof Document !== 'undefined'
          ? Document.prototype.getElementById
          : null;
    } catch {
      nativeGetElementByIdMethod = null;
    }
  }
  return nativeGetElementByIdMethod;
}

export function safeMatches(element: Element, selector: string): boolean {
  try {
    const nativeFn = getNativeMatchesMethod();
    if (nativeFn && !Object.hasOwn(element, 'matches')) {
      return Boolean(safeApply(nativeFn, element, [selector]));
    }
    const fn = getUnshadowedMethod(element, 'matches');
    if (fn) {
      return Boolean(safeApply(fn, element, [selector]));
    }
    return element.matches(selector);
  } catch {
    // Return false if selector matching throws on restricted or detached nodes
    return false;
  }
}

export function safeHasAttributes(element: Element): boolean {
  try {
    const nativeFn = getNativeHasAttributesMethod();
    if (nativeFn && !Object.hasOwn(element, 'hasAttributes')) {
      return Boolean(safeApply(nativeFn, element, []));
    }
    const fn = getUnshadowedMethod(element, 'hasAttributes');
    if (fn) {
      return Boolean(safeApply(fn, element, []));
    }
    return element.hasAttributes();
  } catch {
    // Fail safe on restricted or detached nodes: assume attributes exist
    return true;
  }
}

export function safeClosest(
  element: Element,
  selector: string,
): Element | null {
  try {
    const nativeFn = getNativeClosestMethod();
    if (nativeFn && !Object.hasOwn(element, 'closest')) {
      return safeApply(nativeFn, element, [selector]) as Element | null;
    }
    const fn = getUnshadowedMethod(element, 'closest');
    if (fn) {
      return safeApply(fn, element, [selector]) as Element | null;
    }
    return element.closest(selector);
  } catch {
    // Return null if closest traversal throws on restricted or detached nodes
    return null;
  }
}

export function safeCreateElement<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tagName: K,
): HTMLElementTagNameMap[K];
export function safeCreateElement(doc: Document, tagName: string): HTMLElement;
export function safeCreateElement(doc: Document, tagName: string): HTMLElement {
  try {
    const fn = getUnshadowedMethod(doc, 'createElement');
    if (fn) {
      return safeApply(fn, doc, [tagName]) as HTMLElement;
    }
    return doc.createElement(tagName);
  } catch {
    return doc.createElement(tagName);
  }
}

export function safeElementsFromPoint(
  doc: Document,
  x: number,
  y: number,
): Element[] {
  try {
    const fn = getUnshadowedMethod(doc, 'elementsFromPoint');
    if (fn) {
      return Array.from(safeApply(fn, doc, [x, y]) as Element[]);
    }
    if (typeof doc.elementsFromPoint === 'function') {
      return Array.from(doc.elementsFromPoint(x, y));
    }
  } catch {
    // Suppress errors if elementsFromPoint fails
  }
  return [];
}

export function safeGetElementById(
  doc: Document,
  id: string,
): HTMLElement | null {
  try {
    const nativeFn = getNativeGetElementByIdMethod();
    if (
      nativeFn &&
      typeof Document !== 'undefined' &&
      doc instanceof Document &&
      !Object.hasOwn(doc, 'getElementById')
    ) {
      return safeApply(nativeFn, doc, [id]) as HTMLElement | null;
    }
    const fn = getUnshadowedMethod(doc, 'getElementById');
    if (fn) {
      return safeApply(fn, doc, [id]) as HTMLElement | null;
    }
    return doc.getElementById(id);
  } catch {
    // Return null if getElementById throws on restricted document contexts
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
      return Array.from(safeApply(fn, root, [selector]) as NodeListOf<Element>);
    }
    return Array.from(root.querySelectorAll(selector));
  } catch {
    // Return empty array if querySelectorAll throws on invalid selectors or detached nodes
    return [];
  }
}

export function safeGetAttribute(
  element: Element,
  attr: string,
): string | null {
  try {
    const fn = getUnshadowedMethod(element, 'getAttribute');
    if (fn) {
      return (safeApply(fn, element, [attr]) as string | null) ?? null;
    }
    return element.getAttribute(attr);
  } catch {
    // Return null if reading attribute throws on restricted elements
    return null;
  }
}

export function safeHasAttribute(element: Element, attr: string): boolean {
  try {
    const nativeFn = getNativeHasAttributeMethod();
    if (nativeFn && !Object.hasOwn(element, 'hasAttribute')) {
      return Boolean(safeApply(nativeFn, element, [attr]));
    }
    const fn = getUnshadowedMethod(element, 'hasAttribute');
    if (fn) {
      return Boolean(safeApply(fn, element, [attr]));
    }
    return element.hasAttribute(attr);
  } catch {
    // Return false if attribute check throws on restricted elements
    return false;
  }
}

export function safeRemoveAttribute(element: Element, attr: string): void {
  try {
    if (!safeHasAttribute(element, attr)) return;
    const nativeFn = getNativeRemoveAttributeMethod();
    if (nativeFn && !Object.hasOwn(element, 'removeAttribute')) {
      safeApply(nativeFn, element, [attr]);
      return;
    }
    const fn = getUnshadowedMethod(element, 'removeAttribute');
    if (fn) {
      safeApply(fn, element, [attr]);
    } else {
      element.removeAttribute(attr);
    }
  } catch {
    // Suppress attribute removal errors on cross-origin or read-only elements
  }
}

export function safeRemoveElement(element: Element): void {
  try {
    const fn = getUnshadowedMethod(element, 'remove');
    if (fn) {
      safeApply(fn, element, []);
      return;
    }
    const parent = element.parentNode;
    if (parent) {
      const removeChildFn = getUnshadowedMethod(parent, 'removeChild');
      if (removeChildFn) {
        safeApply(removeChildFn, parent, [element]);
      } else {
        parent.removeChild(element);
      }
    }
  } catch {
    // Suppress element removal errors on cross-origin or restricted elements
  }
}

/* eslint-disable @typescript-eslint/unbound-method */
let nativeAppendChildMethod: NativeDOMMethod<
  typeof Node.prototype.appendChild
> = typeof Node !== 'undefined' ? Node.prototype.appendChild : null;
function getNativeAppendChildMethod(): NativeDOMMethod<
  typeof Node.prototype.appendChild
> {
  if (!nativeAppendChildMethod && typeof Node !== 'undefined') {
    try {
      nativeAppendChildMethod = Node.prototype.appendChild;
    } catch {
      nativeAppendChildMethod = null;
    }
  }
  return nativeAppendChildMethod;
}
/* eslint-enable @typescript-eslint/unbound-method */

export function safeAppendChild<T extends Node>(
  parent: Node,
  child: T,
): T | null {
  try {
    const nativeFn = getNativeAppendChildMethod();
    if (nativeFn && !Object.hasOwn(parent, 'appendChild')) {
      return safeApply(nativeFn, parent, [child]);
    }
    const fn = getUnshadowedMethod(parent, 'appendChild');
    if (fn) {
      return safeApply(fn, parent, [child]) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/* eslint-disable @typescript-eslint/unbound-method */
let nativeAttachShadowMethod: NativeDOMMethod<
  typeof Element.prototype.attachShadow
> = typeof Element !== 'undefined' ? Element.prototype.attachShadow : null;
function getNativeAttachShadowMethod(): NativeDOMMethod<
  typeof Element.prototype.attachShadow
> {
  if (!nativeAttachShadowMethod && typeof Element !== 'undefined') {
    try {
      nativeAttachShadowMethod = Element.prototype.attachShadow;
    } catch {
      nativeAttachShadowMethod = null;
    }
  }
  return nativeAttachShadowMethod;
}
/* eslint-enable @typescript-eslint/unbound-method */

export function safeAttachShadow(
  element: Element,
  init: ShadowRootInit,
): ShadowRoot | null {
  try {
    const nativeFn = getNativeAttachShadowMethod();
    if (nativeFn && !Object.hasOwn(element, 'attachShadow')) {
      return safeApply(nativeFn, element, [init]);
    }
    const fn = getUnshadowedMethod(element, 'attachShadow');
    if (fn) {
      return safeApply(fn, element, [init]) as ShadowRoot;
    }
  } catch {
    // Suppress attachShadow errors
  }
  return null;
}

let nativeShadowRootGetter: ((this: unknown) => unknown) | null | undefined;
function getNativeShadowRootGetter(): ((this: unknown) => unknown) | null {
  if (nativeShadowRootGetter === undefined) {
    try {
      nativeShadowRootGetter =
        typeof Element !== 'undefined'
          ? (Object.getOwnPropertyDescriptor(Element.prototype, 'shadowRoot')
              ?.get ?? null)
          : null;
    } catch {
      nativeShadowRootGetter = null;
    }
  }
  return nativeShadowRootGetter;
}

let nativeStyleGetter: ((this: unknown) => unknown) | null | undefined;
function getNativeStyleGetter(): ((this: unknown) => unknown) | null {
  if (nativeStyleGetter === undefined) {
    try {
      nativeStyleGetter =
        typeof HTMLElement !== 'undefined'
          ? (Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style')
              ?.get ?? null)
          : null;
    } catch {
      nativeStyleGetter = null;
    }
  }
  return nativeStyleGetter;
}

export function safeGetShadowRoot(element: Element): ShadowRoot | null {
  try {
    const nativeGetter = getNativeShadowRootGetter();
    const shadow = nativeGetter
      ? safeApply(nativeGetter, element, [])
      : (() => {
          const getter = getUnshadowedGetter(element, 'shadowRoot');
          return getter ? safeApply(getter, element, []) : element.shadowRoot;
        })();
    if (shadow && typeof shadow === 'object') {
      const proto = Object.getPrototypeOf(shadow);
      if (
        proto !== null &&
        proto !== Object.prototype &&
        'nodeType' in shadow &&
        (shadow as Node).nodeType === 11
      ) {
        return shadow as ShadowRoot;
      }
    }
  } catch {
    // Return null if accessing shadowRoot throws on restricted elements
  }
  return null;
}

export function safeGetStyle(element: HTMLElement): CSSStyleDeclaration | null {
  try {
    let style: unknown = null;
    const nativeGetter = getNativeStyleGetter();
    if (
      nativeGetter &&
      typeof HTMLElement !== 'undefined' &&
      element instanceof HTMLElement
    ) {
      style = safeApply(nativeGetter, element, []);
    } else {
      const getter = getUnshadowedGetter(element, 'style');
      style = getter ? safeApply(getter, element, []) : element.style;
    }
    if (style && typeof style === 'object') {
      const proto = Object.getPrototypeOf(style);
      if (
        proto !== null &&
        proto !== Object.prototype &&
        typeof (style as Record<string, unknown>).getPropertyValue ===
          'function'
      ) {
        return style as CSSStyleDeclaration;
      }
    }
  } catch {
    // Return null if accessing style throws on restricted elements
  }
  return null;
}
