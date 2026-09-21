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

export const SCRUB_SELECTOR = [
  ...SCRUB_ATTRS.map((attr) => `[${attr}]`),
  '[style*="user-select"]',
  '[style*="UserSelect"]',
].join(',');

function hasScrubbableStyle(element: Element): boolean {
  if (typeof HTMLElement === 'undefined' || !(element instanceof HTMLElement)) {
    return false;
  }
  const style = safeGetStyle(element);
  if (!style) return false;

  return (
    style.userSelect === 'none' ||
    ('webkitUserSelect' in style && style.webkitUserSelect === 'none')
  );
}

function cleanSelectionStyle(element: HTMLElement): void {
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

// Fast O(1) pre-check to determine if an element has any scrubbable attributes, inline styles, or shadow root.
// Skipping safeClosest for the 95%+ of DOM nodes that are already clean avoids expensive ancestor traversals.
function hasScrubbableState(element: Element): boolean {
  if (SCRUB_ATTRS.some((attr) => safeHasAttribute(element, attr))) {
    return true;
  }
  if (hasScrubbableStyle(element)) {
    return true;
  }
  return Boolean(safeGetShadowRoot(element));
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

  // Fast-path: skip expensive safeClosest ancestor matching if element has no scrubbable state or shadow root
  if (!hasScrubbableState(node)) {
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
    for (const attr of SCRUB_ATTRS) {
      if (attr !== 'oncontextmenu') {
        safeRemoveAttribute(node, attr);
      }
    }
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
      cleanSelectionStyle(node);
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
