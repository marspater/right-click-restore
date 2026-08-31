import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { isInteractiveEvent, isInteractiveNode } from './index';

describe('page-script / isInteractiveNode & isInteractiveEvent', () => {
  let window: Window;
  let document: Window['document'];

  beforeEach(() => {
    window = new Window();
    document = window.document;
  });

  describe('isInteractiveNode', () => {
    test('returns false for null/undefined nodes', () => {
      expect(isInteractiveNode(null)).toBe(false);
    });

    test('identifies interactive elements directly', () => {
      const input = document.createElement('input');
      const textarea = document.createElement('textarea');
      const select = document.createElement('select');
      const button = document.createElement('button');
      const canvas = document.createElement('canvas');

      expect(isInteractiveNode(input as unknown as Node)).toBe(true);
      expect(isInteractiveNode(textarea as unknown as Node)).toBe(true);
      expect(isInteractiveNode(select as unknown as Node)).toBe(true);
      expect(isInteractiveNode(button as unknown as Node)).toBe(true);
      expect(isInteractiveNode(canvas as unknown as Node)).toBe(true);
    });

    test('identifies elements with interactive ARIA roles or contenteditable attribute', () => {
      const editableDiv = document.createElement('div');
      editableDiv.setAttribute('contenteditable', 'true');

      const textboxDiv = document.createElement('div');
      textboxDiv.setAttribute('role', 'textbox');

      const buttonDiv = document.createElement('div');
      buttonDiv.setAttribute('role', 'button');

      const menuitemDiv = document.createElement('div');
      menuitemDiv.setAttribute('role', 'menuitem');

      const dialogDiv = document.createElement('div');
      dialogDiv.setAttribute('role', 'dialog');

      const comboboxDiv = document.createElement('div');
      comboboxDiv.setAttribute('role', 'combobox');

      expect(isInteractiveNode(editableDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(textboxDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(buttonDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(menuitemDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(dialogDiv as unknown as Node)).toBe(true);
      expect(isInteractiveNode(comboboxDiv as unknown as Node)).toBe(true);
    });

    test('identifies elements nested inside interactive containers', () => {
      const container = document.createElement('div');
      container.className = 'monaco-editor';
      const child = document.createElement('span');
      container.appendChild(child);

      expect(isInteractiveNode(child as unknown as Node)).toBe(true);

      const proseMirror = document.createElement('div');
      proseMirror.className = 'ProseMirror';
      const pmChild = document.createElement('p');
      proseMirror.appendChild(pmChild);

      expect(isInteractiveNode(pmChild as unknown as Node)).toBe(true);
    });

    test('handles text nodes correctly', () => {
      const button = document.createElement('button');
      const textNode = document.createTextNode('Click me');
      button.appendChild(textNode);

      expect(isInteractiveNode(textNode as unknown as Node)).toBe(true);

      const div = document.createElement('div');
      const plainText = document.createTextNode('Static text');
      div.appendChild(plainText);

      expect(isInteractiveNode(plainText as unknown as Node)).toBe(false);
    });

    test('returns false for plain non-interactive elements', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');
      const p = document.createElement('p');

      expect(isInteractiveNode(div as unknown as Node)).toBe(false);
      expect(isInteractiveNode(span as unknown as Node)).toBe(false);
      expect(isInteractiveNode(p as unknown as Node)).toBe(false);
    });
  });

  describe('isInteractiveEvent', () => {
    test('returns true when composedPath contains an interactive element', () => {
      const div = document.createElement('div');
      const button = document.createElement('button');
      div.appendChild(button);

      const fakeEvent = {
        composedPath: () => [
          button as unknown as Element,
          div as unknown as Element,
          document as unknown as Element,
        ],
        target: button,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(true);
    });

    test('returns true when composedPath contains an interactive container', () => {
      const player = document.createElement('div');
      player.className = 'html5-video-player';
      const inner = document.createElement('div');
      player.appendChild(inner);

      const fakeEvent = {
        composedPath: () => [
          inner as unknown as Element,
          player as unknown as Element,
          document as unknown as Element,
        ],
        target: inner,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(true);
    });

    test('returns false when composedPath contains no interactive elements or containers', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');
      div.appendChild(span);

      const fakeEvent = {
        composedPath: () => [
          span as unknown as Element,
          div as unknown as Element,
          document as unknown as Element,
        ],
        target: span,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(false);
    });

    test('handles non-Element items inside composedPath safely', () => {
      const span = document.createElement('span');

      const fakeEvent = {
        composedPath: () => [
          null,
          undefined,
          'not-a-node',
          span as unknown as Element,
          document as unknown as Element,
        ],
        target: span,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(false);
    });

    test('falls back to isInteractiveNode when composedPath is missing or not a function', () => {
      const input = document.createElement('input');
      const fakeEvent = {
        composedPath: null,
        target: input,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeEvent)).toBe(true);

      const div = document.createElement('div');
      const fakeNonInteractiveEvent = {
        target: div,
      } as unknown as Event;

      expect(isInteractiveEvent(fakeNonInteractiveEvent)).toBe(false);
    });

    test('falls back to isInteractiveNode when composedPath throws an error', () => {
      const button = document.createElement('button');

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
