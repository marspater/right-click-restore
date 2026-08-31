import { describe, expect, test } from 'bun:test';
import {
  INTERACTIVE_CONTAINERS,
  INTERACTIVE_ELEMENTS,
  isInteractiveEvent,
  isInteractiveNode,
} from './index';

interface MockElement {
  nodeType: number;
  tagName: string;
  className: string;
  attributes: Record<string, string>;
  parentElement: MockElement | null;
  matches(selectorList: string): boolean;
  closest(selectorList: string): MockElement | null;
}

function createMockElement(
  tagName: string,
  options: {
    className?: string;
    attributes?: Record<string, string>;
    parentElement?: MockElement | null;
    nodeType?: number;
  } = {},
): MockElement {
  const nodeType = options.nodeType ?? 1;
  const className = options.className ?? '';
  const attributes = options.attributes ?? {};
  let parentElement = options.parentElement ?? null;
  const tagLower = tagName.toLowerCase();

  const el: MockElement = {
    nodeType,
    tagName: tagName.toUpperCase(),
    className,
    attributes,
    get parentElement() {
      return parentElement;
    },
    set parentElement(val: MockElement | null) {
      parentElement = val;
    },
    matches(selectorList: string): boolean {
      const selectors = selectorList.split(',').map((s) => s.trim());
      for (const selector of selectors) {
        if (selector === tagLower) return true;
        if (selector.startsWith('.')) {
          const cls = selector.slice(1);
          if (className.split(' ').includes(cls)) return true;
        }
        if (selector.startsWith('[class*="')) {
          const match = selector.match(/\[class\*="([^"]+)"\]/);
          if (match && className.includes(match[1])) return true;
        }
        if (
          selector === '[contenteditable]' ||
          selector === '[contenteditable="true"]'
        ) {
          if (
            attributes.contenteditable === 'true' ||
            attributes.contenteditable === ''
          ) {
            return true;
          }
        }
        if (selector.startsWith('[role="')) {
          const match = selector.match(/\[role="([^"]+)"\]/);
          if (match && attributes.role === match[1]) return true;
        }
        if (selector === 'ytd-app' && tagLower === 'ytd-app') return true;
      }
      return false;
    },
    closest(selectorList: string): MockElement | null {
      if (this.matches(selectorList)) return this;
      if (parentElement && typeof parentElement.closest === 'function') {
        return parentElement.closest(selectorList);
      }
      return null;
    },
  };
  return el;
}

describe('page-script / isInteractiveNode & isInteractiveEvent', () => {
  describe('isInteractiveNode', () => {
    test('returns false for null/undefined nodes', () => {
      expect(isInteractiveNode(null)).toBe(false);
    });

    test('identifies interactive elements directly', () => {
      const input = createMockElement('input');
      const textarea = createMockElement('textarea');
      const select = createMockElement('select');
      const button = createMockElement('button');
      const canvas = createMockElement('canvas');

      expect(isInteractiveNode(input as unknown as Node)).toBe(true);
      expect(isInteractiveNode(textarea as unknown as Node)).toBe(true);
      expect(isInteractiveNode(select as unknown as Node)).toBe(true);
      expect(isInteractiveNode(button as unknown as Node)).toBe(true);
      expect(isInteractiveNode(canvas as unknown as Node)).toBe(true);
    });

    test('identifies elements with interactive ARIA roles or contenteditable attribute', () => {
      const editableDiv = createMockElement('div', {
        attributes: { contenteditable: 'true' },
      });
      const textboxDiv = createMockElement('div', {
        attributes: { role: 'textbox' },
      });
      const buttonDiv = createMockElement('div', {
        attributes: { role: 'button' },
      });
      const menuitemDiv = createMockElement('div', {
        attributes: { role: 'menuitem' },
      });
      const dialogDiv = createMockElement('div', {
        attributes: { role: 'dialog' },
      });
      const comboboxDiv = createMockElement('div', {
        attributes: { role: 'combobox' },
      });

      expect(isInteractiveNode(editableDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(textboxDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(buttonDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(menuitemDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(dialogDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(comboboxDiv as unknown as Node)).toBe(true);
    });

    test('identifies elements nested inside interactive containers', () => {
      const monacoContainer = createMockElement('div', {
        className: 'monaco-editor',
      });
      const monacoChild = createMockElement('span', {
        parentElement: monacoContainer,
      });

      expect(isInteractiveNode(monacoChild as unknown as Node)).toBe(true);

      const pmContainer = createMockElement('div', {
        className: 'ProseMirror',
      });
      const pmChild = createMockElement('p', {
        parentElement: pmContainer,
      });

      expect(isInteractiveNode(pmChild as unknown as Node)).toBe(true);

      const ytdApp = createMockElement('ytd-app');
      const ytdChild = createMockElement('div', { parentElement: ytdApp });

      expect(isInteractiveNode(ytdChild as unknown as Node)).toBe(true);
    });

    test('handles text nodes correctly', () => {
      const button = createMockElement('button');
      const textNodeInButton = {
        nodeType: 3,
        parentElement: button,
      };

      expect(isInteractiveNode(textNodeInButton as unknown as Node)).toBe(true);

      const plainDiv = createMockElement('div');
      const plainTextNode = {
        nodeType: 3,
        parentElement: plainDiv,
      };

      expect(isInteractiveNode(plainTextNode as unknown as Node)).toBe(false);
    });

    test('returns false for plain non-interactive elements', () => {
      const div = createMockElement('div');
      const span = createMockElement('span');
      const p = createMockElement('p');

      expect(isInteractiveNode(div as unknown as Node)).toBe(false);
      expect(isInteractiveNode(span as unknown as Node)).toBe(false);
      expect(isInteractiveNode(p as unknown as Node)).toBe(false);
    });
  });

  describe('isInteractiveEvent', () => {
    test('returns true when composedPath contains an interactive element', () => {
      const button = createMockElement('button');
      const div = createMockElement('div');

      const fakeEvent = {
        composedPath: () => [button, div],
        target: button,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(true);
    });

    test('returns true when composedPath contains an interactive container', () => {
      const player = createMockElement('div', {
        className: 'html5-video-player',
      });
      const inner = createMockElement('div');

      const fakeEvent = {
        composedPath: () => [inner, player],
        target: inner,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(true);
    });

    test('returns false when composedPath contains no interactive elements or containers', () => {
      const span = createMockElement('span');
      const div = createMockElement('div');

      const fakeEvent = {
        composedPath: () => [span, div],
        target: span,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(false);
    });

    test('handles non-Element items inside composedPath safely', () => {
      const span = createMockElement('span');

      const fakeEvent = {
        composedPath: () => [null, undefined, 'not-an-element', span],
        target: span,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(false);
    });

    test('falls back to isInteractiveNode when composedPath is missing or not a function', () => {
      const input = createMockElement('input');
      const fakeEvent = {
        composedPath: null,
        target: input,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(true);

      const div = createMockElement('div');
      const fakeNonInteractiveEvent = {
        target: div,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeNonInteractiveEvent)).toBe(false);
    });

    test('falls back to isInteractiveNode when composedPath throws an error', () => {
      const button = createMockElement('button');

      const fakeEvent = {
        composedPath: () => {
          throw new Error('Shadow DOM access restricted');
        },
        target: button,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(true);
    });

    test('handles event target gracefully when target is not a Node or null', () => {
      const fakeEvent1 = {
        target: null,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent1)).toBe(false);

      const fakeEvent2 = {
        target: { notANode: true },
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent2)).toBe(false);
    });
  });
});
