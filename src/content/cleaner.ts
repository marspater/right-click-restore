import {
  INTERACTIVE_CONTAINERS,
  INTERACTIVE_ELEMENTS,
} from '../shared/constants';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

export const SCRUB_ATTRS = [
  'oncontextmenu',
  'onselectstart',
  'ondragstart',
  'oncopy',
  'oncut',
  'onbeforecopy',
];

export const SCRUB_SELECTOR = SCRUB_ATTRS.map((attr) => `[${attr}]`).join(',');

/**
 * Fast check to determine if an Element has scrubbable attributes, shadowRoot,
 * or inline user-select: none style. Bypasses expensive DOM ancestor traversals
 * (closest) on clean elements (>99% of DOM nodes).
 */
export function hasScrubbableContent(node: Element): boolean {
  try {
    if (!node.hasAttributes() && !node.shadowRoot) return false;
    if (node.shadowRoot) return true;
    if (node.matches(SCRUB_SELECTOR)) return true;
    if (
      typeof HTMLElement !== 'undefined' &&
      node instanceof HTMLElement &&
      (node.style.userSelect === 'none' ||
        ('webkitUserSelect' in node.style &&
          node.style.webkitUserSelect === 'none'))
    ) {
      return true;
    }
  } catch (_e) {}
  return false;
}

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  // Fast-path: Skip DOM ancestor traversal for clean nodes without scrubbable content
  if (!hasScrubbableContent(node)) return;

  try {
    if (
      node.matches(INTERACTIVE_ELEMENTS) ||
      node.closest(INTERACTIVE_CONTAINERS)
    ) {
      return;
    }
  } catch (_e) {
    return;
  }

  if (settings.restoreRightClick) {
    try {
      node.removeAttribute('oncontextmenu');
    } catch (_e) {}
  }

  if (settings.restoreSelection) {
    for (let i = 0; i < SCRUB_ATTRS.length; i++) {
      const attr = SCRUB_ATTRS[i];
      if (attr !== 'oncontextmenu') {
        try {
          node.removeAttribute(attr);
        } catch (_e) {}
      }
    }
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
      try {
        if (node.style.userSelect === 'none') node.style.userSelect = 'auto';
        if (
          'webkitUserSelect' in node.style &&
          node.style.webkitUserSelect === 'none'
        ) {
          node.style.webkitUserSelect = 'auto';
        }
      } catch (_e) {}
    }
  }

  // Traverse open shadow root if accessible
  try {
    if (node.shadowRoot) {
      cleanDOMTree(node.shadowRoot, settings);
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
