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

const FAST_INTERACTIVE_TAGS = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'CANVAS',
]);

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

function hasUserSelectNone(node: Element): boolean {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) {
    return false;
  }
  const style = safeGetStyle(node);
  if (!style) return false;
  return (
    style.userSelect === 'none' ||
    style.getPropertyValue('-webkit-user-select') === 'none'
  );
}

function restoreUserSelect(node: Element): void {
  if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement)) {
    return;
  }
  try {
    const style = safeGetStyle(node);
    if (style) {
      if (style.userSelect === 'none') {
        style.userSelect = 'auto';
      }
      if (style.getPropertyValue('-webkit-user-select') === 'none') {
        style.setProperty('-webkit-user-select', 'auto');
      }
    }
  } catch {
    // Suppress style modification errors on restricted or read-only elements
  }
}

function hasScrubbableSelection(node: Element): boolean {
  for (const attr of SCRUB_ATTRS) {
    if (attr !== 'oncontextmenu' && safeHasAttribute(node, attr)) {
      return true;
    }
  }
  return hasUserSelectNone(node);
}

function hasScrubbableTarget(node: Element, settings: Settings): boolean {
  try {
    if (settings.restoreRightClick && safeHasAttribute(node, 'oncontextmenu')) {
      return true;
    }
    if (settings.restoreSelection && hasScrubbableSelection(node)) {
      return true;
    }
    if (safeGetShadowRoot(node)) {
      return true;
    }
  } catch {
    // Suppress errors inspecting attributes or shadow roots on detached elements
  }
  return false;
}

function isInteractiveOrDescendant(node: Element): boolean {
  if (
    typeof node.tagName === 'string' &&
    FAST_INTERACTIVE_TAGS.has(node.tagName)
  ) {
    return true;
  }
  try {
    return Boolean(safeClosest(node, ALL_INTERACTIVE_SELECTORS));
  } catch {
    // Return true on error to avoid modifying detached or protected elements
    return true;
  }
}

function stripScrubbableAttributes(node: Element, settings: Settings): void {
  if (settings.restoreRightClick) {
    safeRemoveAttribute(node, 'oncontextmenu');
  }

  if (settings.restoreSelection) {
    for (const attr of SCRUB_ATTRS) {
      if (attr !== 'oncontextmenu') {
        safeRemoveAttribute(node, attr);
      }
    }
    restoreUserSelect(node);
  }
}

export function cleanNode(
  node: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (typeof Element === 'undefined' || !(node instanceof Element)) return;

  // Early return if both restoration settings are disabled
  if (!settings.restoreRightClick && !settings.restoreSelection) {
    return;
  }

  // Fast-path: Skip expensive tree traversal if element has no scrubbable attributes/styles
  if (!hasScrubbableTarget(node, settings)) {
    return;
  }

  if (isInteractiveOrDescendant(node)) {
    return;
  }

  stripScrubbableAttributes(node, settings);

  // Traverse open shadow root if accessible
  try {
    const shadow = safeGetShadowRoot(node);
    if (shadow) {
      cleanDOMTree(shadow, settings);
    }
  } catch {
    // Suppress errors traversing shadow roots on restricted elements
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
  } catch {
    // Suppress querySelectorAll errors on detached elements
  }
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
  } catch {
    // Suppress querySelectorAll errors during DOM tree traversal
  }
}
