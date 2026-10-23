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

/* eslint-disable @typescript-eslint/unbound-method */
let nativeGetAttributeMethod: NativeDOMMethod<
  typeof Element.prototype.getAttribute
> = typeof Element !== 'undefined' ? Element.prototype.getAttribute : null;
function getNativeGetAttributeMethod(): NativeDOMMethod<
  typeof Element.prototype.getAttribute
> {
  if (!nativeGetAttributeMethod && typeof Element !== 'undefined') {
    try {
      nativeGetAttributeMethod = Element.prototype.getAttribute;
    } catch {
      nativeGetAttributeMethod = null;
    }
  }
  return nativeGetAttributeMethod;
}

let nativeElementQuerySelectorAllMethod: NativeDOMMethod<
  typeof Element.prototype.querySelectorAll
> = typeof Element !== 'undefined' ? Element.prototype.querySelectorAll : null;
function getNativeElementQuerySelectorAllMethod(): NativeDOMMethod<
  typeof Element.prototype.querySelectorAll
> {
  if (!nativeElementQuerySelectorAllMethod && typeof Element !== 'undefined') {
    try {
      nativeElementQuerySelectorAllMethod = Element.prototype.querySelectorAll;
    } catch {
      nativeElementQuerySelectorAllMethod = null;
    }
  }
  return nativeElementQuerySelectorAllMethod;
}

let nativeDocumentQuerySelectorAllMethod: NativeDOMMethod<
  typeof Document.prototype.querySelectorAll
> =
  typeof Document !== 'undefined' ? Document.prototype.querySelectorAll : null;
function getNativeDocumentQuerySelectorAllMethod(): NativeDOMMethod<
  typeof Document.prototype.querySelectorAll
> {
  if (
    !nativeDocumentQuerySelectorAllMethod &&
    typeof Document !== 'undefined'
  ) {
    try {
      nativeDocumentQuerySelectorAllMethod =
        Document.prototype.querySelectorAll;
    } catch {
      nativeDocumentQuerySelectorAllMethod = null;
    }
  }
  return nativeDocumentQuerySelectorAllMethod;
}

let nativeDocumentFragmentQuerySelectorAllMethod: NativeDOMMethod<
  typeof DocumentFragment.prototype.querySelectorAll
> =
  typeof DocumentFragment !== 'undefined'
    ? DocumentFragment.prototype.querySelectorAll
    : null;
function getNativeDocumentFragmentQuerySelectorAllMethod(): NativeDOMMethod<
  typeof DocumentFragment.prototype.querySelectorAll
> {
  if (
    !nativeDocumentFragmentQuerySelectorAllMethod &&
    typeof DocumentFragment !== 'undefined'
  ) {
    try {
      nativeDocumentFragmentQuerySelectorAllMethod =
        DocumentFragment.prototype.querySelectorAll;
    } catch {
      nativeDocumentFragmentQuerySelectorAllMethod = null;
    }
  }
  return nativeDocumentFragmentQuerySelectorAllMethod;
}
/* eslint-enable @typescript-eslint/unbound-method */

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

/* eslint-disable no-unused-vars */
function getTargetQuerySelectorAll(
  root: ParentNode,
): ((selectors: string) => NodeListOf<Element>) | null {
  const nodeType = (root as Node).nodeType;
  if (nodeType === 1) return getNativeElementQuerySelectorAllMethod();
  if (nodeType === 9) return getNativeDocumentQuerySelectorAllMethod();
  if (nodeType === 11) return getNativeDocumentFragmentQuerySelectorAllMethod();
  return null;
}
/* eslint-enable no-unused-vars */

function invokeCachedQuerySelectorAll(
  root: ParentNode,
  selector: string,
): Element[] | null {
  if (Object.hasOwn(root, 'querySelectorAll')) {
    return null;
  }
  const nativeFn = getTargetQuerySelectorAll(root);
  if (nativeFn) {
    return Array.from(safeApply(nativeFn, root, [selector]));
  }
  return null;
}

export function safeQuerySelectorAll(
  root: ParentNode,
  selector: string,
): Element[] {
  try {
    // Performance optimization: Fast-path native prototype execution for unshadowed querySelectorAll calls.
    // Avoids getUnshadowedMethod lookup overhead and prototype walks on standard DOM subtrees during frequent scans.
    const cached = invokeCachedQuerySelectorAll(root, selector);
    if (cached) {
      return cached;
    }
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

export function safeQuerySelector(
  root: ParentNode,
  selector: string,
): Element | null {
  try {
    const fn = getUnshadowedMethod(root, 'querySelector');
    if (fn) {
      return (safeApply(fn, root, [selector]) as Element | null) ?? null;
    }
    return root.querySelector(selector);
  } catch {
    // Return null if querySelector throws on invalid selectors or detached nodes
    return null;
  }
}

function tryCachedGetAttribute(
  element: Element,
  attr: string,
): string | null | undefined {
  const nativeFn = getNativeGetAttributeMethod();
  if (
    nativeFn &&
    typeof Element !== 'undefined' &&
    element instanceof Element &&
    !Object.hasOwn(element, 'getAttribute')
  ) {
    return safeApply(nativeFn, element, [attr]) ?? null;
  }
  return undefined;
}

export function safeGetAttribute(
  element: Element,
  attr: string,
): string | null {
  try {
    // Performance optimization: Fast-path native prototype execution for unshadowed getAttribute calls.
    // Bypasses getUnshadowedMethod prototype searches during high-frequency attribute checks.
    const cached = tryCachedGetAttribute(element, attr);
    if (cached !== undefined) {
      return cached;
    }
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
const nativeAppendChild: NativeDOMMethod<typeof Node.prototype.appendChild> =
  typeof Node !== 'undefined' ? Node.prototype.appendChild : null;
/* eslint-enable @typescript-eslint/unbound-method */

export function safeAppendChild<T extends Node>(
  parent: Node,
  child: T,
): T | null {
  try {
    if (nativeAppendChild && !Object.hasOwn(parent, 'appendChild')) {
      return safeApply(nativeAppendChild, parent, [child]);
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
const nativeAttachShadow: NativeDOMMethod<
  typeof Element.prototype.attachShadow
> = typeof Element !== 'undefined' ? Element.prototype.attachShadow : null;
/* eslint-enable @typescript-eslint/unbound-method */

export function safeAttachShadow(
  element: Element,
  init: ShadowRootInit,
): ShadowRoot | null {
  try {
    if (nativeAttachShadow && !Object.hasOwn(element, 'attachShadow')) {
      return safeApply(nativeAttachShadow, element, [init]);
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

let nativeParentElementGetter: ((this: unknown) => unknown) | null | undefined;
function getNativeParentElementGetter(): ((this: unknown) => unknown) | null {
  if (nativeParentElementGetter === undefined) {
    try {
      nativeParentElementGetter =
        typeof Node !== 'undefined'
          ? (Object.getOwnPropertyDescriptor(Node.prototype, 'parentElement')
              ?.get ??
            Object.getOwnPropertyDescriptor(Element.prototype, 'parentElement')
              ?.get ??
            null)
          : null;
    } catch {
      nativeParentElementGetter = null;
    }
  }
  return nativeParentElementGetter;
}

let nativeTagNameGetter: ((this: unknown) => unknown) | null | undefined;
function getNativeTagNameGetter(): ((this: unknown) => unknown) | null {
  if (nativeTagNameGetter === undefined) {
    try {
      nativeTagNameGetter =
        typeof Element !== 'undefined'
          ? (Object.getOwnPropertyDescriptor(Element.prototype, 'tagName')
              ?.get ?? null)
          : null;
    } catch {
      nativeTagNameGetter = null;
    }
  }
  return nativeTagNameGetter;
}

export function safeGetTagName(element: Element): string {
  try {
    let tag: unknown = null;
    const nativeGetter = getNativeTagNameGetter();
    if (
      nativeGetter &&
      typeof Element !== 'undefined' &&
      element instanceof Element &&
      !Object.hasOwn(element, 'tagName')
    ) {
      tag = safeApply(nativeGetter, element, []);
    } else {
      const getter = getUnshadowedGetter(element, 'tagName');
      tag = getter ? safeApply(getter, element, []) : element.tagName;
    }
    if (typeof tag === 'string') {
      return tag.toUpperCase();
    }
  } catch {
    // Return empty string if accessing tagName throws on restricted elements
  }
  return '';
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

export function safeGetParentElement(element: Node): Element | null {
  try {
    let parent: unknown = null;
    const nativeGetter = getNativeParentElementGetter();
    if (
      nativeGetter &&
      typeof Node !== 'undefined' &&
      element instanceof Node
    ) {
      parent = safeApply(nativeGetter, element, []);
    } else {
      const getter = getUnshadowedGetter(element, 'parentElement');
      parent = getter
        ? safeApply(getter, element, [])
        : (element as Element).parentElement;
    }
    if (parent && typeof parent === 'object') {
      const proto = Object.getPrototypeOf(parent);
      if (
        proto !== null &&
        proto !== Object.prototype &&
        'nodeType' in parent &&
        (parent as Node).nodeType === 1
      ) {
        return parent as Element;
      }
    }
  } catch {
    // Return null if accessing parentElement throws on restricted elements
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
