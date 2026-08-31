import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

export const INTERACTIVE_CONTAINERS =
  '.ProseMirror, .monaco-editor, .html5-video-player, [class*="ytp-"], [class*="player-"], ytd-app, [contenteditable="true"]';

export const INTERACTIVE_ELEMENTS =
  'input, textarea, select, button, [contenteditable], [contenteditable="true"]';

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
  if (!(node instanceof Element)) return;
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
    for (const attr of SCRUB_ATTRS) {
      if (attr !== 'oncontextmenu') {
        try {
          node.removeAttribute(attr);
        } catch (_e) {}
      }
    }
    if (node instanceof HTMLElement) {
      try {
        if (node.style.userSelect === 'none') node.style.userSelect = 'auto';
        if (node.style.webkitUserSelect === 'none') {
          node.style.webkitUserSelect = 'auto';
        }
      } catch (_e) {}
    }
  }
}

export function cleanAddedNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (!(node instanceof Element)) return;
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
  if (root instanceof Element) cleanNode(root, settings);
  try {
    for (const node of root.querySelectorAll(SCRUB_SELECTOR)) {
      cleanNode(node, settings);
    }
  } catch (_e) {}
}
