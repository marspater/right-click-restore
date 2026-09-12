export const INTERACTIVE_CONTAINERS =
  '.ProseMirror, .monaco-editor, .html5-video-player, [class*="ytp-"], [class*="player-"], ytd-app, [contenteditable="true"]';

export const INTERACTIVE_ELEMENTS =
  'input, textarea, select, button, [contenteditable], [contenteditable="true"], [role="textbox"], [role="combobox"], [role="button"], [role="menuitem"], [role="dialog"], canvas';

export const ALL_INTERACTIVE_SELECTORS = `${INTERACTIVE_ELEMENTS}, ${INTERACTIVE_CONTAINERS}`;
