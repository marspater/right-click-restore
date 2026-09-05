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

function hasScrubAttribute(node: Element, settings: Settings): boolean {
  if (!node.hasAttributes()) return false;

  if (settings.restoreRightClick && node.hasAttribute('oncontextmenu')) {
    return true;
  }

  if (settings.restoreSelection) {
    for (let i = 0; i < SCRUB_ATTRS.length; i++) {
      const attr = SCRUB_ATTRS[i];
      if (attr !== 'oncontextmenu' && node.hasAttribute(attr)) {
        return true;
      }
    }
  }

  return false;
}

function checkNeedsUserSelectReset(node: Element, settings: Settings): boolean {
  if (
    !settings.restoreSelection ||
    typeof HTMLElement === 'undefined' ||
    !(node instanceof HTMLElement)
  ) {
    return false;
  }
  const style = node.style;
  if (!style) return false;

  return (
    style.userSelect === 'none' ||
    ('webkitUserSelect' in style && style.webkitUserSelect === 'none')
  );
}

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  // Performance Optimization:
  // Fast-path exit check. Over 95% of DOM elements processed during page loads, mutation batches,
  // and tree traversals do NOT possess scrubbable event attributes ('oncontextmenu', 'oncopy', etc.),
  // inline 'userSelect: none' styles, or accessible Shadow DOM roots.
  // By checking for target attributes/styles BEFORE evaluating node.matches() or node.closest(),
  // we avoid walking up the entire DOM tree to document root matching complex CSS container selectors
  // (.ProseMirror, .monaco-editor, .html5-video-player, ytd-app, etc.) for non-target elements.
  if (
    !hasScrubAttribute(node, settings) &&
    !checkNeedsUserSelectReset(node, settings) &&
    !node.shadowRoot
  ) {
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
    // Ignore invalid selector or cross-origin node access exceptions
  }

  if (settings.restoreRightClick && node.hasAttribute('oncontextmenu')) {
    node.removeAttribute('oncontextmenu');
  }

  if (settings.restoreSelection) {
    for (let i = 0; i < SCRUB_ATTRS.length; i++) {
      const attr = SCRUB_ATTRS[i];
      if (attr !== 'oncontextmenu' && node.hasAttribute(attr)) {
        node.removeAttribute(attr);
      }
    }
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
      const style = node.style;
      if (style) {
        if (style.userSelect === 'none') style.userSelect = 'auto';
        if ('webkitUserSelect' in style && style.webkitUserSelect === 'none') {
          style.webkitUserSelect = 'auto';
        }
      }
    }
  }

  // Traverse open shadow root if accessible
  if (node.shadowRoot) {
    cleanDOMTree(node.shadowRoot, settings);
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
  } catch (_e) {
    // Ignore DOM query failures on restricted nodes
  }
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
  } catch (_e) {
    // Ignore DOM query failures on restricted nodes
  }
}
