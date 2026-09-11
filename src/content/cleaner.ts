import { ALL_INTERACTIVE_SELECTORS } from '../shared/constants';
import {
  safeClosest,
  safeGetShadowRoot,
  safeGetStyle,
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
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
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
  visited?: Set<unknown>,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;
  if (visited) {
    if (visited.has(node)) return;
    visited.add(node);
  }
  cleanNode(node, settings);
  try {
    for (const child of node.querySelectorAll(SCRUB_SELECTOR)) {
      if (visited) {
        if (visited.has(child)) continue;
        visited.add(child);
      }
      cleanNode(child, settings);
    }
  } catch (_e) {}
}

export function cleanDOMTree(
  root: ParentNode = document,
  settings: Settings = DEFAULT_SETTINGS,
  visited?: Set<unknown>,
) {
  if (typeof Element !== 'undefined' && root instanceof Element) {
    if (visited) {
      if (visited.has(root)) return;
      visited.add(root);
    }
    cleanNode(root, settings);
  }
  try {
    for (const node of root.querySelectorAll(SCRUB_SELECTOR)) {
      if (visited) {
        if (visited.has(node)) continue;
        visited.add(node);
      }
      cleanNode(node, settings);
    }
  } catch (_e) {}
}
