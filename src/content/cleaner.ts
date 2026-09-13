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

  // Fast-path: Skip expensive interactive parent selector traversal (safeClosest)
  // if the node has no scrubbable attributes, no inline style attribute, and no open shadowRoot.
  const hasStyleAttr = safeHasAttribute(node, 'style');
  let hasScrubAttr = false;
  for (let i = 0; i < SCRUB_ATTRS.length; i++) {
    if (safeHasAttribute(node, SCRUB_ATTRS[i])) {
      hasScrubAttr = true;
      break;
    }
  }

  let shadow: ShadowRoot | null = null;
  try {
    shadow = safeGetShadowRoot(node);
  } catch (_e) {}

  if (!hasStyleAttr && !hasScrubAttr && !shadow) {
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
    for (let i = 0; i < SCRUB_ATTRS.length; i++) {
      const attr = SCRUB_ATTRS[i];
      if (attr !== 'oncontextmenu') {
        safeRemoveAttribute(node, attr);
      }
    }
    if (
      hasStyleAttr &&
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
