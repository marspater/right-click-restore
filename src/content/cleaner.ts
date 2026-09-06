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

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  // Performance Optimization (Bolt ⚡): Fast-path check.
  // Check if the node has attributes, inline userSelect styles, or shadowRoot.
  // If an element has no attributes or shadowRoot and userSelect isn't none,
  // we can exit early without performing expensive matches() or closest() CSS selector lookups.
  const isHtmlEl =
    typeof HTMLElement !== 'undefined' && node instanceof HTMLElement;
  const hasAttributes = node.hasAttributes();
  const hasShadow = Boolean(node.shadowRoot);
  const style = isHtmlEl ? node.style : null;
  const hasUserSelectNone =
    style !== null &&
    (style.userSelect === 'none' ||
      ('webkitUserSelect' in style && style.webkitUserSelect === 'none'));

  if (!hasAttributes && !hasShadow && !hasUserSelectNone) {
    return;
  }

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

  // Guard removeAttribute calls with hasAttribute checks to eliminate DOM mutation/binding overhead
  if (settings.restoreRightClick && node.hasAttribute('oncontextmenu')) {
    try {
      node.removeAttribute('oncontextmenu');
    } catch (_e) {}
  }

  if (settings.restoreSelection && hasAttributes) {
    for (let i = 0; i < SCRUB_ATTRS.length; i++) {
      const attr = SCRUB_ATTRS[i];
      if (attr !== 'oncontextmenu' && node.hasAttribute(attr)) {
        try {
          node.removeAttribute(attr);
        } catch (_e) {}
      }
    }
  }

  if (settings.restoreSelection && isHtmlEl && hasUserSelectNone) {
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

  // Traverse open shadow root if accessible
  if (hasShadow) {
    try {
      if (node.shadowRoot) {
        cleanDOMTree(node.shadowRoot, settings);
      }
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
