import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { cleanAddedNode, cleanDOMTree, cleanNode } from './cleaner';

describe('cleaner module', () => {
  let window: Window;
  let document: Document;

  beforeEach(() => {
    window = new Window();
    document = window.document as unknown as Document;
    Object.assign(globalThis, {
      window,
      document,
      Node: window.Node,
      Element: window.Element,
      HTMLElement: window.HTMLElement,
    });
  });

  describe('cleanNode', () => {
    test('removes oncontextmenu when restoreRightClick is enabled', () => {
      const el = document.createElement('div');
      el.setAttribute('oncontextmenu', 'return false');

      cleanNode(el, { ...DEFAULT_SETTINGS, restoreRightClick: true });
      expect(el.hasAttribute('oncontextmenu')).toBe(false);
    });

    test('retains oncontextmenu when restoreRightClick is disabled', () => {
      const el = document.createElement('div');
      el.setAttribute('oncontextmenu', 'return false');

      cleanNode(el, { ...DEFAULT_SETTINGS, restoreRightClick: false });
      expect(el.hasAttribute('oncontextmenu')).toBe(true);
    });

    test('removes selection attributes when restoreSelection is enabled', () => {
      const el = document.createElement('div');
      el.setAttribute('onselectstart', 'return false');
      el.setAttribute('ondragstart', 'return false');
      el.setAttribute('oncopy', 'return false');
      el.setAttribute('oncut', 'return false');
      el.setAttribute('onbeforecopy', 'return false');

      cleanNode(el, { ...DEFAULT_SETTINGS, restoreSelection: true });

      expect(el.hasAttribute('onselectstart')).toBe(false);
      expect(el.hasAttribute('ondragstart')).toBe(false);
      expect(el.hasAttribute('oncopy')).toBe(false);
      expect(el.hasAttribute('oncut')).toBe(false);
      expect(el.hasAttribute('onbeforecopy')).toBe(false);
    });

    test('retains selection attributes when restoreSelection is disabled', () => {
      const el = document.createElement('div');
      el.setAttribute('onselectstart', 'return false');

      cleanNode(el, { ...DEFAULT_SETTINGS, restoreSelection: false });
      expect(el.hasAttribute('onselectstart')).toBe(true);
    });

    test('resets userSelect styles to auto when set to none', () => {
      const el = document.createElement('div');
      el.style.userSelect = 'none';

      cleanNode(el, { ...DEFAULT_SETTINGS, restoreSelection: true });

      expect(el.style.userSelect).toBe('auto');
      if (el.style.webkitUserSelect !== undefined) {
        expect(el.style.webkitUserSelect).toBe('auto');
      }
    });

    test('bypasses interactive form elements and contenteditable', () => {
      const input = document.createElement('input');
      input.setAttribute('oncontextmenu', 'return false');
      cleanNode(input, DEFAULT_SETTINGS);
      expect(input.hasAttribute('oncontextmenu')).toBe(true);

      const textarea = document.createElement('textarea');
      textarea.setAttribute('oncopy', 'return false');
      cleanNode(textarea, DEFAULT_SETTINGS);
      expect(textarea.hasAttribute('oncopy')).toBe(true);

      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      editable.setAttribute('oncontextmenu', 'return false');
      cleanNode(editable, DEFAULT_SETTINGS);
      expect(editable.hasAttribute('oncontextmenu')).toBe(true);
    });

    test('bypasses elements inside interactive containers', () => {
      const container = document.createElement('div');
      container.className = 'ProseMirror';

      const child = document.createElement('p');
      child.setAttribute('oncontextmenu', 'return false');
      container.appendChild(child);

      cleanNode(child, DEFAULT_SETTINGS);
      expect(child.hasAttribute('oncontextmenu')).toBe(true);
    });

    test('safely handles non-Element input', () => {
      const settings = DEFAULT_SETTINGS;
      expect(() => cleanNode(null, settings)).not.toThrow();
      expect(() => cleanNode(undefined, settings)).not.toThrow();
      expect(() => cleanNode(123, settings)).not.toThrow();
      expect(() =>
        cleanNode(document.createTextNode('hello'), settings),
      ).not.toThrow();
    });

    test('safely handles elements where matches or closest throws', () => {
      const div = document.createElement('div');
      div.matches = () => {
        throw new Error('matches error');
      };

      expect(() => cleanNode(div, DEFAULT_SETTINGS)).not.toThrow();
    });

    test('cleans inside open shadowRoot when attached', () => {
      const host = document.createElement('div');
      if (typeof host.attachShadow === 'function') {
        const shadow = host.attachShadow({ mode: 'open' });
        const inner = document.createElement('div');
        inner.setAttribute('oncontextmenu', 'return false');
        shadow.appendChild(inner);

        cleanNode(host, DEFAULT_SETTINGS);
        expect(inner.hasAttribute('oncontextmenu')).toBe(false);
      }
    });
  });

  describe('cleanAddedNode', () => {
    test('cleans the root element and descendant nodes with scrubbable attributes', () => {
      const root = document.createElement('div');
      root.setAttribute('oncontextmenu', 'return false');

      const child1 = document.createElement('span');
      child1.setAttribute('onselectstart', 'return false');

      const child2 = document.createElement('p');
      child2.setAttribute('oncopy', 'return false');

      root.appendChild(child1);
      root.appendChild(child2);

      cleanAddedNode(root, DEFAULT_SETTINGS);

      expect(root.hasAttribute('oncontextmenu')).toBe(false);
      expect(child1.hasAttribute('onselectstart')).toBe(false);
      expect(child2.hasAttribute('oncopy')).toBe(false);
    });

    test('ignores non-Element added nodes gracefully', () => {
      const textNode = document.createTextNode('sample');
      expect(() => cleanAddedNode(textNode, DEFAULT_SETTINGS)).not.toThrow();
    });
  });

  describe('cleanDOMTree', () => {
    test('cleans entire document tree including matching nodes', () => {
      const parent = document.createElement('div');
      parent.setAttribute('oncontextmenu', 'return false');

      const child = document.createElement('div');
      child.setAttribute('ondragstart', 'return false');
      child.style.userSelect = 'none';

      parent.appendChild(child);
      document.body.appendChild(parent);

      cleanDOMTree(document, DEFAULT_SETTINGS);

      expect(parent.hasAttribute('oncontextmenu')).toBe(false);
      expect(child.hasAttribute('ondragstart')).toBe(false);
      expect(child.style.userSelect).toBe('auto');

      parent.remove();
    });

    test('cleans a specific parent node subtree when passed an element root', () => {
      const container = document.createElement('div');
      container.setAttribute('oncontextmenu', 'return false');

      const child = document.createElement('div');
      child.setAttribute('oncut', 'return false');
      container.appendChild(child);

      cleanDOMTree(container, DEFAULT_SETTINGS);

      expect(container.hasAttribute('oncontextmenu')).toBe(false);
      expect(child.hasAttribute('oncut')).toBe(false);
    });
  });
});
