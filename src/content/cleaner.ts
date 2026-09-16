import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import {
  safeClosest,
  safeGetShadowRoot,
  safeGetStyle,
  safeHasAttribute,
  safeQuerySelectorAll,
  safeRemoveAttribute,
} from '../shared/dom';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

export {
  getUnshadowedGetter,
  getUnshadowedMethod,
  safeClosest,
  safeGetElementById,
  safeGetShadowRoot,
  safeGetStyle,
  safeHasAttribute,
  safeMatches,
  safeQuerySelectorAll,
  safeRemoveAttribute,
} from '../shared/dom';

export const SCRUB_ATTRS = [
  'oncontextmenu',
  'onselectstart',
  'ondragstart',
  'oncopy',
  'oncut',
  'onbeforecopy',
];

const SELECTION_ATTRS = SCRUB_ATTRS.filter((attr) => attr !== 'oncontextmenu');

export const SCRUB_SELECTOR = [
  ...SCRUB_ATTRS.map((attr) => `[${attr}]`),
  '[style*="user-select"]',
  '[style*="UserSelect"]',
].join(',');

function hasScrubbableAttribute(node: Element, settings: Settings): boolean {
  if (settings.restoreRightClick && safeHasAttribute(node, 'oncontextmenu')) {
    return true;
  }
  if (settings.restoreSelection) {
    return SELECTION_ATTRS.some((attr) => safeHasAttribute(node, attr));
  }
  return false;
}

function hasUserSelectNone(node: Element): boolean {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) {
    return false;
  }
  try {
    const style = safeGetStyle(node);
    if (!style) return false;
    return (
      style.userSelect === 'none' ||
      ('webkitUserSelect' in style && style.webkitUserSelect === 'none')
    );
  } catch (_e) {
    return false;
  }
}

/**
 * Fast O(1) attribute and style check to determine if an element actually needs cleaning
 * before executing expensive ancestor DOM hierarchy traversals against interactive selectors.
 */
function hasScrubbableProperties(node: Element, settings: Settings): boolean {
  if (hasScrubbableAttribute(node, settings)) return true;
  if (settings.restoreSelection && hasUserSelectNone(node)) return true;
  return Boolean(safeGetShadowRoot(node));
}

function cleanSelectionStyles(node: Element): void {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) {
    return;
  }
  try {
    const style = safeGetStyle(node);
    if (!style) return;
    if (style.userSelect === 'none') style.userSelect = 'auto';
    if ('webkitUserSelect' in style && style.webkitUserSelect === 'none') {
      style.webkitUserSelect = 'auto';
    }
  } catch (_e) {}
}

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  // Early return if both restoration settings are disabled to avoid unnecessary DOM traversals & selector checks
  if (!settings.restoreRightClick && !settings.restoreSelection) {
    return;
  }

  // Performance Optimization: Short-circuit early if the element has no scrubbable
  // event attributes, user-select inline styles, or open shadow roots.
  // This avoids calling safeClosest(node, ALL_INTERACTIVE_SELECTORS) - which performs
  // expensive DOM tree ancestor traversal against 18 selectors - on 99%+ of DOM elements.
  if (!hasScrubbableProperties(node, settings)) {
    return;
  }

  try {
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
    for (const attr of SELECTION_ATTRS) {
      safeRemoveAttribute(node, attr);
    }
    cleanSelectionStyles(node);
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
    for (const child of safeQuerySelectorAll(node, SCRUB_SELECTOR)) {
      cleanNode(child, settings);
    }
  } catch (_e) {}
}

export function cleanDOMTree(
  root: ParentNode = document,
  settings: Settings = DEFAULT_SETTINGS,
) {
  // Early return if both restoration features are turned off to avoid scanning the entire DOM tree with querySelectorAll
  if (!settings.restoreRightClick && !settings.restoreSelection) {
    return;
  }

  if (typeof Element !== 'undefined' && root instanceof Element) {
    cleanNode(root, settings);
  }
  try {
    for (const node of safeQuerySelectorAll(root, SCRUB_SELECTOR)) {
      cleanNode(node, settings);
    }
  } catch (_e) {}
}
