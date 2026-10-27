import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import {
  safeClosest,
  safeGetAttribute,
  safeGetShadowRoot,
  safeGetStyle,
  safeGetTagName,
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
  safeGetTagName,
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

// Performance optimization: Returns the resolved CSSStyleDeclaration if user-select: none is detected.
// Returning the style object directly allows cleanNode to reuse it during restoration, bypassing duplicate
// safeGetAttribute and safeGetStyle calls on styled elements.
function getUserSelectStyle(node: Element): CSSStyleDeclaration | null {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) {
    return null;
  }
  const styleAttr = safeGetAttribute(node, 'style');
  if (!styleAttr) {
    return null;
  }
  const styleAttrLower = styleAttr.toLowerCase();
  if (
    !styleAttrLower.includes('user-select') &&
    !styleAttrLower.includes('userselect')
  ) {
    return null;
  }
  const style = safeGetStyle(node);
  if (!style) return null;
  if (
    style.userSelect === 'none' ||
    style.getPropertyValue('-webkit-user-select') === 'none'
  ) {
    return style;
  }
  return null;
}

function restoreUserSelect(
  node: Element,
  cachedStyle?: CSSStyleDeclaration | null,
): void {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) {
    return;
  }
  let style = cachedStyle;
  if (!style) {
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
    style = safeGetStyle(node);
  }
  if (!style) return;
  try {
    if (style.userSelect === 'none') {
      style.userSelect = 'auto';
    }
    if (style.getPropertyValue('-webkit-user-select') === 'none') {
      style.setProperty('-webkit-user-select', 'auto');
    }
  } catch {
    // Suppress style modification errors on restricted or read-only elements
  }
}

interface ScrubbableTargetResult {
  isTarget: boolean;
  userSelectStyle: CSSStyleDeclaration | null;
}

function checkScrubbableTarget(
  node: Element,
  settings: Settings,
  shadow?: ShadowRoot | null,
): ScrubbableTargetResult {
  try {
    if (shadow) {
      return { isTarget: true, userSelectStyle: null };
    }
    // Fast-path: Elements without attributes cannot have event handler attributes or inline style attributes
    if (!safeHasAttributes(node)) {
      return { isTarget: false, userSelectStyle: null };
    }
    if (settings.restoreRightClick && safeHasAttribute(node, 'oncontextmenu')) {
      return { isTarget: true, userSelectStyle: null };
    }
    if (settings.restoreSelection) {
      for (const attr of SELECTION_ATTRS) {
        if (safeHasAttribute(node, attr)) {
          return { isTarget: true, userSelectStyle: null };
        }
      }
      const userSelectStyle = getUserSelectStyle(node);
      if (userSelectStyle) {
        return { isTarget: true, userSelectStyle };
      }
    }
  } catch {
    // Suppress errors inspecting attributes or shadow roots on detached elements
  }
  return { isTarget: false, userSelectStyle: null };
}

function isInteractiveOrDescendant(node: Element): boolean {
  const tag = safeGetTagName(node);
  if (tag && FAST_INTERACTIVE_TAGS.has(tag)) {
    return true;
  }
  try {
    return Boolean(safeClosest(node, ALL_INTERACTIVE_SELECTORS));
  } catch {
    // Return true on error to avoid modifying detached or protected elements
    return true;
  }
}

function stripScrubbableAttributes(
  node: Element,
  settings: Settings,
  userSelectStyle?: CSSStyleDeclaration | null,
): void {
  if (settings.restoreRightClick) {
    safeRemoveAttribute(node, 'oncontextmenu');
  }

  if (settings.restoreSelection) {
    for (const attr of SELECTION_ATTRS) {
      safeRemoveAttribute(node, attr);
    }
    restoreUserSelect(node, userSelectStyle);
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
  const { isTarget, userSelectStyle } = checkScrubbableTarget(
    node,
    settings,
    shadow,
  );
  if (!isTarget) {
    return;
  }

  if (isInteractiveOrDescendant(node)) {
    const tag = safeGetTagName(node);
    if (
      settings.restoreRightClick &&
      (tag === 'VIDEO' || tag === 'AUDIO' || tag === 'IMG')
    ) {
      safeRemoveAttribute(node, 'oncontextmenu');
    }
    return;
  }

  stripScrubbableAttributes(node, settings, userSelectStyle);

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
  // Performance optimization: Fast-path return if restoration settings are disabled.
  // Checking getScrubSelector before cleanNode avoids unnecessary attribute checks
  // and subtree DOM scans when both restoreRightClick and restoreSelection are false.
  const selector = getScrubSelector(settings);
  if (!selector) return;

  cleanNode(node, settings);
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
