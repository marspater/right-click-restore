export const INTERACTIVE_CONTAINERS =
  '.ProseMirror, .monaco-editor, .html5-video-player, [class*="ytp-"], [class*="player-"], ytd-app, [contenteditable="true"]';

export const INTERACTIVE_ELEMENTS =
  'input, textarea, select, button, [contenteditable], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="button"], [role="menuitem"], [role="dialog"], canvas';

export const ALL_INTERACTIVE_SELECTORS = `${INTERACTIVE_ELEMENTS}, ${INTERACTIVE_CONTAINERS}`;

/**
 * Fast O(1) Set lookup for standard HTML interactive tags.
 * Used to skip expensive prototype walks and browser CSS selector evaluation on native interactive elements.
 */
export const FAST_INTERACTIVE_TAGS: ReadonlySet<string> = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'CANVAS',
]);
