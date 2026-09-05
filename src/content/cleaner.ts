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

  // Performance Optimization:
  // Fast-path exit check. Over 95% of DOM elements processed during page loads, mutation batches,
  // and tree traversals do NOT possess scrubbable event attributes ('oncontextmenu', 'oncopy', etc.),
  // inline 'userSelect: none' styles, or accessible Shadow DOM roots.
  // By checking for target attributes/styles BEFORE evaluating node.matches() or node.closest(),
  // we avoid walking up the entire DOM tree to document root matching complex CSS container selectors
  // (.ProseMirror, .monaco-editor, .html5-video-player, ytd-app, etc.) for non-target elements.
  const isHtml =
    typeof HTMLElement !== 'undefined' && node instanceof HTMLElement;

  let needsUserSelectReset = false;
  if (settings.restoreSelection && isHtml) {
    try {
      const style = node.style;
      needsUserSelectReset =
        style.userSelect === 'none' ||
        ('webkitUserSelect' in style && style.webkitUserSelect === 'none');
    } catch (_e) {}
  }

  let hasScrubAttr = false;
  if (node.hasAttributes()) {
    if (settings.restoreRightClick) {
      try {
        if (node.hasAttribute('oncontextmenu')) {
          hasScrubAttr = true;
        }
      } catch (_e) {}
    }

    if (!hasScrubAttr && settings.restoreSelection) {
      for (let i = 0; i < SCRUB_ATTRS.length; i++) {
        const attr = SCRUB_ATTRS[i];
        if (attr !== 'oncontextmenu') {
          try {
            if (node.hasAttribute(attr)) {
              hasScrubAttr = true;
              break;
            }
          } catch (_e) {}
        }
      }
    }
  }

  // Fast-path early return: If there are no scrub attributes, no userSelect overrides, and no shadowRoot,
  // there is nothing to clean on this element.
  if (!hasScrubAttr && !needsUserSelectReset && !node.shadowRoot) {
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

  if (settings.restoreRightClick) {
    try {
      if (node.hasAttribute('oncontextmenu')) {
        node.removeAttribute('oncontextmenu');
      }
    } catch (_e) {}
  }

  if (settings.restoreSelection) {
    for (let i = 0; i < SCRUB_ATTRS.length; i++) {
      const attr = SCRUB_ATTRS[i];
      if (attr !== 'oncontextmenu') {
        try {
          if (node.hasAttribute(attr)) {
            node.removeAttribute(attr);
          }
        } catch (_e) {}
      }
    }
    if (isHtml) {
      try {
        const style = node.style;
        if (style.userSelect === 'none') style.userSelect = 'auto';
        if ('webkitUserSelect' in style && style.webkitUserSelect === 'none') {
          style.webkitUserSelect = 'auto';
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
