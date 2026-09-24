import {
  ALL_INTERACTIVE_SELECTORS,
  isNativeInteractiveTag,
} from '../shared/constants';
import {
  safeClosest,
  safeGetShadowRoot,
  safeGetStyle,
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

export const SELECTION_ATTRS = [
  'onselectstart',
  'ondragstart',
  'oncopy',
  'oncut',
  'onbeforecopy',
];

export const SCRUB_ATTRS = ['oncontextmenu', ...SELECTION_ATTRS];

export const SCRUB_SELECTOR = [
  ...SCRUB_ATTRS.map((attr) => `[${attr}]`),
  '[style*="user-select"]',
  '[style*="UserSelect"]',
].join(',');

function resetUserSelectStyle(element: HTMLElement): void {
  try {
    const style = safeGetStyle(element);
    if (!style) return;
    if (style.userSelect === 'none') {
      style.userSelect = 'auto';
    }
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

  try {
    // Fast-path: short-circuit safeClosest and CSS selector evaluation for standard interactive form & canvas elements
    if (isNativeInteractiveTag((node as Element).localName)) {
      return;
    }
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
    for (let i = 0; i < SELECTION_ATTRS.length; i++) {
      safeRemoveAttribute(node, SELECTION_ATTRS[i]);
    }
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
      resetUserSelectStyle(node);
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
