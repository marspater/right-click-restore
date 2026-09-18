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

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  // Early return if both restoration settings are disabled to avoid unnecessary DOM traversals & selector checks
  if (!settings.restoreRightClick && !settings.restoreSelection) {
    return;
  }

  // Fast-path: Skip expensive safeClosest ancestor hierarchy traversal if the node has
  // no scrubbable event attributes, no inline user-select:none style, and no open shadow root.
  const hasRightClickAttr =
    settings.restoreRightClick && safeHasAttribute(node, 'oncontextmenu');

  let hasSelectionAttr = false;
  let hasUserSelectStyle = false;

  if (settings.restoreSelection) {
    for (let i = 0; i < SCRUB_ATTRS.length; i++) {
      const attr = SCRUB_ATTRS[i];
      if (attr !== 'oncontextmenu' && safeHasAttribute(node, attr)) {
        hasSelectionAttr = true;
        break;
      }
    }
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
      try {
        const style = safeGetStyle(node);
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
  }

  let shadow: ShadowRoot | null = null;
  try {
    shadow = safeGetShadowRoot(node);
  } catch (_e) {}

  // If node has nothing to scrub or traverse, short-circuit immediately without safeClosest DOM traversal
  if (
    !hasRightClickAttr &&
    !hasSelectionAttr &&
    !hasUserSelectStyle &&
    !shadow
  ) {
    return;
  }

  try {
    if (safeClosest(node, ALL_INTERACTIVE_SELECTORS)) {
      return;
    }
  } catch (_e) {
    return;
  }

  if (hasRightClickAttr) {
    safeRemoveAttribute(node, 'oncontextmenu');
  }

  if (settings.restoreSelection) {
    if (hasSelectionAttr) {
      for (let i = 0; i < SCRUB_ATTRS.length; i++) {
        const attr = SCRUB_ATTRS[i];
        if (attr !== 'oncontextmenu') {
          safeRemoveAttribute(node, attr);
        }
      }
    }
    if (
      hasUserSelectStyle &&
      typeof HTMLElement !== 'undefined' &&
      node instanceof HTMLElement
    ) {
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
