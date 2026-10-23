import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import {
  safeClosest,
  safeGetAttribute,
  safeGetShadowRoot,
  safeGetStyle,
  safeHasAttribute,
  safeHasAttributes,
  safeQuerySelectorAll,
  safeRemoveAttribute,
  safeRemoveElement,
} from '../shared/dom';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

export {
  getUnshadowedGetter,
  getUnshadowedMethod,
  safeAppendChild,
  safeAttachShadow,
  safeClosest,
  safeCreateElement,
  safeGetAttribute,
  safeGetElementById,
  safeGetShadowRoot,
  safeGetStyle,
  safeHasAttribute,
  safeHasAttributes,
  safeMatches,
  safeQuerySelectorAll,
  safeRemoveAttribute,
  safeRemoveElement,
} from '../shared/dom';

const FAST_INTERACTIVE_TAGS = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'CANVAS',
  'YTD-APP',
]);

export const SCRUB_ATTRS = [
  'oncontextmenu',
  'onselectstart',
  'ondragstart',
  'oncopy',
  'oncut',
  'onbeforecopy',
];

export const SELECTION_ATTRS = SCRUB_ATTRS.filter(
  (attr) => attr !== 'oncontextmenu',
);

export const SCRUB_SELECTOR = [
  ...SCRUB_ATTRS.map((attr) => `[${attr}]`),
  '[style*="user-select"]',
  '[style*="UserSelect"]',
].join(',');

export const RIGHT_CLICK_SELECTOR = '[oncontextmenu]';

export const SELECTION_SELECTOR = [
  ...SELECTION_ATTRS.map((attr) => `[${attr}]`),
  '[style*="user-select"]',
  '[style*="UserSelect"]',
].join(',');

// Performance optimization: Construct minimal targeted CSS selectors based on active restoration settings.
// Scanning for disabled features (e.g. searching for user-select styles when restoreSelection is false)
// causes unnecessary querySelectorAll work across large DOM trees.
export function getScrubSelector(
  settings: Settings = DEFAULT_SETTINGS,
): string {
  if (settings.restoreRightClick && settings.restoreSelection) {
    return SCRUB_SELECTOR;
  }
  if (settings.restoreRightClick) {
    return RIGHT_CLICK_SELECTOR;
  }
  if (settings.restoreSelection) {
    return SELECTION_SELECTOR;
  }
  return '';
}

function hasUserSelectNone(node: Element): boolean {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) {
    return false;
  }
  // Performance optimization: Fast-path raw inline style attribute inspection.
  // Accessing safeGetAttribute directly bypasses redundant safeHasAttribute calls
  // since null is returned if the style attribute is absent. Accessing safeGetStyle(node)
  // computes/resolves CSSStyleDeclaration properties, which is expensive.
  // Over 95% of styled DOM nodes do not configure user-select. Short-circuiting if
  // the style attribute string lacks 'user-select' or 'userselect' avoids unnecessary
  // CSS property accesses while retaining complete accuracy.
  const styleAttr = safeGetAttribute(node, 'style');
  if (!styleAttr) {
    return false;
  }
  const styleAttrLower = styleAttr.toLowerCase();
  if (
    !styleAttrLower.includes('user-select') &&
    !styleAttrLower.includes('userselect')
  ) {
    return false;
  }
  const style = safeGetStyle(node);
  if (!style) return false;
  return (
    style.userSelect === 'none' ||
    style.getPropertyValue('-webkit-user-select') === 'none'
  );
}

function restoreUserSelect(node: Element): void {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) {
    return;
  }
  const styleAttr = safeGetAttribute(node, 'style');
  if (!styleAttr) {
    return;
  }
  const styleAttrLower = styleAttr.toLowerCase();
  if (
    !styleAttrLower.includes('user-select') &&
    !styleAttrLower.includes('userselect')
  ) {
    return;
  }
  try {
    const style = safeGetStyle(node);
    if (style) {
      if (style.userSelect === 'none') {
        style.userSelect = 'auto';
      }
      if (style.getPropertyValue('-webkit-user-select') === 'none') {
        style.setProperty('-webkit-user-select', 'auto');
      }
    }
  } catch {
    // Suppress style modification errors on restricted or read-only elements
  }
}

function hasScrubbableSelection(node: Element): boolean {
  for (const attr of SELECTION_ATTRS) {
    if (safeHasAttribute(node, attr)) {
      return true;
    }
  }
  return hasUserSelectNone(node);
}

function hasScrubbableTarget(
  node: Element,
  settings: Settings,
  shadow?: ShadowRoot | null,
): boolean {
  try {
    if (shadow) {
      return true;
    }
    // Fast-path: Elements without attributes cannot have event handler attributes or inline style attributes
    if (!safeHasAttributes(node)) {
      return false;
    }
    if (settings.restoreRightClick && safeHasAttribute(node, 'oncontextmenu')) {
      return true;
    }
    if (settings.restoreSelection && hasScrubbableSelection(node)) {
      return true;
    }
  } catch {
    // Suppress errors inspecting attributes or shadow roots on detached elements
  }
  return false;
}

function isInteractiveOrDescendant(node: Element): boolean {
  if (
    typeof node.tagName === 'string' &&
    FAST_INTERACTIVE_TAGS.has(node.tagName)
  ) {
    return true;
  }
  try {
    return Boolean(safeClosest(node, ALL_INTERACTIVE_SELECTORS));
  } catch {
    // Return true on error to avoid modifying detached or protected elements
    return true;
  }
}

function stripScrubbableAttributes(node: Element, settings: Settings): void {
  if (settings.restoreRightClick) {
    safeRemoveAttribute(node, 'oncontextmenu');
  }

  if (settings.restoreSelection) {
    for (const attr of SELECTION_ATTRS) {
      safeRemoveAttribute(node, attr);
    }
    restoreUserSelect(node);
  }
}

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  // Early return if both restoration settings are disabled
  if (!settings.restoreRightClick && !settings.restoreSelection) {
    return;
  }

  // Single-pass open shadow root inspection reused for target validation and shadow DOM cleaning
  const shadow = safeGetShadowRoot(node);

  // Fast-path: Skip expensive tree traversal if element has no scrubbable attributes/styles or shadow
  if (!hasScrubbableTarget(node, settings, shadow)) {
    return;
  }

  if (isInteractiveOrDescendant(node)) {
    if (
      settings.restoreRightClick &&
      (node.tagName === 'VIDEO' ||
        node.tagName === 'AUDIO' ||
        node.tagName === 'IMG')
    ) {
      safeRemoveAttribute(node, 'oncontextmenu');
    }
    return;
  }

  stripScrubbableAttributes(node, settings);

  // Traverse open shadow root if accessible
  if (shadow) {
    try {
      cleanDOMTree(shadow, settings);
    } catch {
      // Suppress errors traversing shadow roots on restricted elements
    }
  }
}

export function cleanAddedNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;
  cleanNode(node, settings);
  const selector = getScrubSelector(settings);
  if (!selector) return;
  try {
    for (const child of safeQuerySelectorAll(node, selector)) {
      cleanNode(child, settings);
    }
  } catch {
    // Suppress querySelectorAll errors on detached elements
  }
}

export function cleanDOMTree(
  root: ParentNode = document,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element !== 'undefined' && root instanceof Element) {
    cleanNode(root, settings);
  }
  const selector = getScrubSelector(settings);
  if (!selector) return;
  try {
    for (const node of safeQuerySelectorAll(root, selector)) {
      cleanNode(node, settings);
    }
  } catch {
    // Suppress querySelectorAll errors during DOM tree traversal
  }
}
