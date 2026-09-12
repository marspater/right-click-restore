import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import {
  safeClosest,
  safeGetShadowRoot,
  safeGetStyle,
  safeHasAttribute,
  safeRemoveAttribute,
} from '../shared/dom';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

export {
  getUnshadowedGetter,
  getUnshadowedMethod,
  safeClosest,
  safeGetShadowRoot,
  safeGetStyle,
  safeHasAttribute,
  safeMatches,
  safeRemoveAttribute,
} from '../shared/dom';

export const SCRUB_CONTEXT_ATTR = 'oncontextmenu';
export const SCRUB_SELECTION_ATTRS = [
  'onselectstart',
  'ondragstart',
  'oncopy',
  'oncut',
  'onbeforecopy',
];

export const SCRUB_ATTRS = [SCRUB_CONTEXT_ATTR, ...SCRUB_SELECTION_ATTRS];

export const SCRUB_SELECTOR = [
  ...SCRUB_ATTRS.map((attr) => `[${attr}]`),
  '[style*="user-select"]',
  '[style*="UserSelect"]',
].join(',');

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  if (!settings.restoreRightClick && !settings.restoreSelection) return;

  // Fast O(1) check: determine if node has any attributes or styles to clean, or a shadow root.
  // Skipping safeClosest when node has no target attributes/styles avoids expensive DOM parent hierarchy traversals.
  const hasContextMenu =
    settings.restoreRightClick && safeHasAttribute(node, SCRUB_CONTEXT_ATTR);

  let hasSelectionAttr = false;
  if (settings.restoreSelection) {
    for (let i = 0; i < SCRUB_SELECTION_ATTRS.length; i++) {
      if (safeHasAttribute(node, SCRUB_SELECTION_ATTRS[i])) {
        hasSelectionAttr = true;
        break;
      }
    }
  }

  let style: CSSStyleDeclaration | null = null;
  let hasUserSelectStyle = false;
  if (
    settings.restoreSelection &&
    typeof HTMLElement !== 'undefined' &&
    node instanceof HTMLElement
  ) {
    try {
      style = safeGetStyle(node);
      if (style) {
        if (
          style.userSelect === 'none' ||
          ('webkitUserSelect' in style && style.webkitUserSelect === 'none')
        ) {
          hasUserSelectStyle = true;
        }
      }
    } catch (_e) {}
  }

  let shadow: ShadowRoot | null = null;
  try {
    shadow = safeGetShadowRoot(node);
  } catch (_e) {}

  if (!hasContextMenu && !hasSelectionAttr && !hasUserSelectStyle && !shadow) {
    return;
  }

  try {
    if (safeClosest(node, ALL_INTERACTIVE_SELECTORS)) {
      return;
    }
  } catch (_e) {
    return;
  }

  if (hasContextMenu) {
    safeRemoveAttribute(node, SCRUB_CONTEXT_ATTR);
  }

  if (hasSelectionAttr) {
    for (let i = 0; i < SCRUB_SELECTION_ATTRS.length; i++) {
      safeRemoveAttribute(node, SCRUB_SELECTION_ATTRS[i]);
    }
  }

  if (hasUserSelectStyle && style) {
    try {
      if (style.userSelect === 'none') style.userSelect = 'auto';
      if ('webkitUserSelect' in style && style.webkitUserSelect === 'none') {
        style.webkitUserSelect = 'auto';
      }
    } catch (_e) {}
  }

  if (shadow) {
    try {
      cleanDOMTree(shadow, settings);
    } catch (_e) {}
  }
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
