import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { Settings } from '../shared/settings';
import {
  handlePageScriptMessage,
  isInteractiveEvent,
  isInteractiveNode,
  isModifierPressed,
} from './index';

describe('page-script helpers', () => {
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
    });
  });

  describe('isInteractiveNode', () => {
    test('returns false for null or undefined', () => {
      expect(isInteractiveNode(null)).toBe(false);
      expect(isInteractiveNode(undefined as unknown as Node | null)).toBe(
        false,
      );
    });

    test('returns false for non-interactive standard elements', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');
      const p = document.createElement('p');
      const section = document.createElement('section');

      expect(isInteractiveNode(div)).toBe(false);
      expect(isInteractiveNode(span)).toBe(false);
      expect(isInteractiveNode(p)).toBe(false);
      expect(isInteractiveNode(section)).toBe(false);
    });

    test('returns true for interactive HTML form & canvas elements', () => {
      const input = document.createElement('input');
      const textarea = document.createElement('textarea');
      const select = document.createElement('select');
      const button = document.createElement('button');
      const canvas = document.createElement('canvas');

      expect(isInteractiveNode(input)).toBe(true);
      expect(isInteractiveNode(textarea)).toBe(true);
      expect(isInteractiveNode(select)).toBe(true);
      expect(isInteractiveNode(button)).toBe(true);
      expect(isInteractiveNode(canvas)).toBe(true);
    });

    test('returns true for child elements nested inside buttons or interactive elements', () => {
      const button = document.createElement('button');
      const span = document.createElement('span');
      span.textContent = 'Click me';
      button.appendChild(span);
      expect(isInteractiveNode(span)).toBe(true);

      const customBtn = document.createElement('div');
      customBtn.setAttribute('role', 'button');
      const icon = document.createElement('i');
      customBtn.appendChild(icon);
      expect(isInteractiveNode(icon)).toBe(true);
    });

    test('returns true for elements with contenteditable attribute', () => {
      const divEditable = document.createElement('div');
      divEditable.setAttribute('contenteditable', 'true');
      expect(isInteractiveNode(divEditable)).toBe(true);

      const divContentEditableAttr = document.createElement('div');
      divContentEditableAttr.setAttribute('contenteditable', '');
      expect(isInteractiveNode(divContentEditableAttr)).toBe(true);
    });

    test('returns true for elements with interactive roles', () => {
      const roles = ['textbox', 'combobox', 'button', 'menuitem', 'dialog'];

      for (const role of roles) {
        const el = document.createElement('div');
        el.setAttribute('role', role);
        expect(isInteractiveNode(el)).toBe(true);
      }
    });

    test('returns true for elements inside interactive containers', () => {
      const proseMirror = document.createElement('div');
      proseMirror.className = 'ProseMirror';
      const childOfProseMirror = document.createElement('span');
      proseMirror.appendChild(childOfProseMirror);

      const monacoEditor = document.createElement('div');
      monacoEditor.className = 'monaco-editor';
      const childOfMonaco = document.createElement('div');
      monacoEditor.appendChild(childOfMonaco);

      const ytPlayer = document.createElement('div');
      ytPlayer.className = 'ytp-chrome-bottom';
      const ytChild = document.createElement('span');
      ytPlayer.appendChild(ytChild);

      const customPlayer = document.createElement('div');
      customPlayer.className = 'player-controls';
      const playerChild = document.createElement('span');
      customPlayer.appendChild(playerChild);

      const ytdApp = document.createElement('ytd-app');
      const ytdChild = document.createElement('div');
      ytdApp.appendChild(ytdChild);

      const editableContainer = document.createElement('div');
      editableContainer.setAttribute('contenteditable', 'true');
      const editableChild = document.createElement('span');
      editableContainer.appendChild(editableChild);

      expect(isInteractiveNode(childOfProseMirror)).toBe(true);
      expect(isInteractiveNode(childOfMonaco)).toBe(true);
      expect(isInteractiveNode(ytChild)).toBe(true);
      expect(isInteractiveNode(playerChild)).toBe(true);
      expect(isInteractiveNode(ytdChild)).toBe(true);
      expect(isInteractiveNode(editableChild)).toBe(true);
    });

    test('handles Text nodes by checking their parent element', () => {
      const button = document.createElement('button');
      const buttonText = document.createTextNode('Click me');
      button.appendChild(buttonText);

      const div = document.createElement('div');
      const divText = document.createTextNode('Hello world');
      div.appendChild(divText);

      const container = document.createElement('div');
      container.className = 'html5-video-player';
      const containerText = document.createTextNode('Video label');
      container.appendChild(containerText);

      expect(isInteractiveNode(buttonText)).toBe(true);
      expect(isInteractiveNode(divText)).toBe(false);
      expect(isInteractiveNode(containerText)).toBe(true);
    });

    test('returns false when matching logic throws an error', () => {
      const faultyNode = {
        nodeType: 1,
        matches: () => {
          throw new Error('DOM error');
        },
        closest: () => {
          throw new Error('DOM error');
        },
      };

      expect(isInteractiveNode(faultyNode as unknown as Node)).toBe(false);
    });
  });

  describe('isInteractiveEvent', () => {
    test('returns true when composedPath includes interactive element', () => {
      const input = document.createElement('input');
      const event = {
        composedPath: () => [input],
        target: null,
      } as unknown as Event;

      expect(isInteractiveEvent(event)).toBe(true);
    });

    test('returns true when event target is interactive', () => {
      const button = document.createElement('button');
      const event = {
        target: button,
      } as unknown as Event;

      expect(isInteractiveEvent(event)).toBe(true);
    });
  });

  describe('isModifierPressed', () => {
    test('returns true when Shift or Alt key is pressed', () => {
      expect(
        isModifierPressed({ shiftKey: true, altKey: false } as MouseEvent),
      ).toBe(true);
      expect(
        isModifierPressed({ shiftKey: false, altKey: true } as MouseEvent),
      ).toBe(true);
      expect(
        isModifierPressed({ shiftKey: false, altKey: false } as MouseEvent),
      ).toBe(false);
    });
  });

  describe('isInteractiveNode DOM clobbering resistance', () => {
    test('resists DOM clobbering when child inputs shadow matches or closest', () => {
      const form = document.createElement('form');
      const inputMatches = document.createElement('input');
      inputMatches.setAttribute('name', 'matches');
      form.appendChild(inputMatches);

      Object.defineProperty(form, 'matches', {
        value: inputMatches,
        configurable: true,
      });

      expect(() => isInteractiveNode(form)).not.toThrow();
      expect(isInteractiveNode(form)).toBe(false);
    });
  });

  describe('handlePageScriptMessage', () => {
    test('rejects messages with missing or invalid nonce', () => {
      let updated = false;
      const accepted = handlePageScriptMessage(
        { nonce: 'wrong-nonce', type: 'UPDATE', config: { enabled: false } },
        'secret-nonce',
        () => {
          updated = true;
        },
      );

      expect(accepted).toBe(false);
      expect(updated).toBe(false);

      const nonStringAccepted = handlePageScriptMessage(
        { nonce: 12345, type: 'UPDATE', config: { enabled: false } },
        'secret-nonce',
        () => {
          updated = true;
        },
      );
      expect(nonStringAccepted).toBe(false);
    });

    test('accepts valid UPDATE message with matching nonce', () => {
      let newConfig: Settings | null = null;
      const accepted = handlePageScriptMessage(
        {
          nonce: 'valid-nonce-123',
          type: 'UPDATE',
          config: { enabled: false, restoreRightClick: false },
        },
        'valid-nonce-123',
        (config) => {
          newConfig = config;
        },
      );

      expect(accepted).toBe(true);
      expect(newConfig).not.toBeNull();
      expect(newConfig.enabled).toBe(false);
      expect(newConfig.restoreRightClick).toBe(false);
    });

    test('accepts valid UNLOCK message with matching nonce', () => {
      let unlocked = false;
      const accepted = handlePageScriptMessage(
        { nonce: 'valid-nonce-123', type: 'UNLOCK' },
        'valid-nonce-123',
        undefined,
        () => {
          unlocked = true;
        },
      );

      expect(accepted).toBe(true);
      expect(unlocked).toBe(true);
    });
  });
});
