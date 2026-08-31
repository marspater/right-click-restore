import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';
import {
  INTERACTIVE_CONTAINERS,
  INTERACTIVE_ELEMENTS,
  SCRUB_ATTRS,
  cleanAddedNode,
  cleanDOMTree,
  cleanNode,
} from './cleaner';

describe('cleaner DOM scrubbing', () => {
  beforeEach(() => {
    const win = new Window();
    globalThis.document = win.document as unknown as Document;
    globalThis.Element = win.Element as unknown as typeof Element;
    globalThis.HTMLElement = win.HTMLElement as unknown as typeof HTMLElement;
    globalThis.Node = win.Node as unknown as typeof Node;
  });

  describe('cleanNode', () => {
    test('removes oncontextmenu when restoreRightClick is enabled', () => {
      const div = document.createElement('div');
      div.setAttribute('oncontextmenu', 'return false');

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreRightClick: true,
        restoreSelection: false,
      };

      cleanNode(div, settings);
      expect(div.hasAttribute('oncontextmenu')).toBe(false);
    });

    test('preserves oncontextmenu when restoreRightClick is disabled', () => {
      const div = document.createElement('div');
      div.setAttribute('oncontextmenu', 'return false');

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreRightClick: false,
      };

      cleanNode(div, settings);
      expect(div.getAttribute('oncontextmenu')).toBe('return false');
    });

    test('removes selection attributes when restoreSelection is enabled', () => {
      const div = document.createElement('div');
      const selectionAttrs = [
        'onselectstart',
        'ondragstart',
        'oncopy',
        'oncut',
        'onbeforecopy',
      ];

      for (const attr of selectionAttrs) {
        div.setAttribute(attr, 'return false');
      }

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreRightClick: false,
        restoreSelection: true,
      };

      cleanNode(div, settings);

      for (const attr of selectionAttrs) {
        expect(div.hasAttribute(attr)).toBe(false);
      }
    });

    test('preserves selection attributes when restoreSelection is disabled', () => {
      const div = document.createElement('div');
      div.setAttribute('onselectstart', 'return false');

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreSelection: false,
      };

      cleanNode(div, settings);
      expect(div.getAttribute('onselectstart')).toBe('return false');
    });

    test('resets userSelect and webkitUserSelect from none to auto when restoreSelection is enabled', () => {
      const div = document.createElement('div');
      div.style.userSelect = 'none';
      div.style.webkitUserSelect = 'none';

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreSelection: true,
      };

      cleanNode(div, settings);
      expect(div.style.userSelect).toBe('auto');
      expect(div.style.webkitUserSelect).toBe('auto');
    });

    test('does not alter non-none userSelect styles', () => {
      const div = document.createElement('div');
      div.style.userSelect = 'text';

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreSelection: true,
      };

      cleanNode(div, settings);
      expect(div.style.userSelect).toBe('text');
    });

    test('preserves userSelect: none when restoreSelection is disabled', () => {
      const div = document.createElement('div');
      div.style.userSelect = 'none';

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreSelection: false,
      };

      cleanNode(div, settings);
      expect(div.style.userSelect).toBe('none');
    });

    test('bypasses interactive elements like input, textarea, select, button, and contenteditable', () => {
      const tags = ['input', 'textarea', 'select', 'button'];
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreRightClick: true,
        restoreSelection: true,
      };

      for (const tag of tags) {
        const el = document.createElement(tag);
        el.setAttribute('oncontextmenu', 'return false');
        el.setAttribute('onselectstart', 'return false');
        cleanNode(el, settings);
        expect(el.hasAttribute('oncontextmenu')).toBe(true);
        expect(el.hasAttribute('onselectstart')).toBe(true);
      }

      const editableDiv = document.createElement('div');
      editableDiv.setAttribute('contenteditable', 'true');
      editableDiv.setAttribute('oncontextmenu', 'return false');
      cleanNode(editableDiv, settings);
      expect(editableDiv.hasAttribute('oncontextmenu')).toBe(true);
    });

    test('bypasses elements nested inside interactive containers', () => {
      const testCases = [
        { tagName: 'div', className: 'ProseMirror' },
        { tagName: 'div', className: 'monaco-editor' },
        { tagName: 'div', className: 'html5-video-player' },
        { tagName: 'div', className: 'ytp-custom-player' },
        { tagName: 'div', className: 'player-controls' },
        { tagName: 'ytd-app', className: '' },
      ];

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        restoreRightClick: true,
        restoreSelection: true,
      };

      for (const { tagName, className } of testCases) {
        const container = document.createElement(tagName);
        if (className) container.className = className;
        const child = document.createElement('span');
        child.setAttribute('oncontextmenu', 'return false');
        container.appendChild(child);
        document.body.appendChild(container);

        cleanNode(child, settings);
        expect(child.hasAttribute('oncontextmenu')).toBe(true);

        container.remove();
      }

      const contentEditableParent = document.createElement('div');
      contentEditableParent.setAttribute('contenteditable', 'true');
      const editableChild = document.createElement('p');
      editableChild.setAttribute('oncontextmenu', 'return false');
      contentEditableParent.appendChild(editableChild);
      document.body.appendChild(contentEditableParent);

      cleanNode(editableChild, settings);
      expect(editableChild.hasAttribute('oncontextmenu')).toBe(true);
      contentEditableParent.remove();
    });

    test('safely handles non-Element inputs', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS };

      expect(() => cleanNode(null, settings)).not.toThrow();
      expect(() => cleanNode(undefined, settings)).not.toThrow();
      expect(() => cleanNode('not an element', settings)).not.toThrow();
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
