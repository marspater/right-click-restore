import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import {
  getUnshadowedGetter,
  getUnshadowedMethod,
  safeClosest,
  safeGetShadowRoot,
  safeGetStyle,
  safeHasAttribute,
  safeMatches,
  safeRemoveAttribute,
} from './dom';

describe('shared dom utilities', () => {
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

  describe('safeMatches', () => {
    test('returns true when element matches selector', () => {
      const div = document.createElement('div');
      div.className = 'test-class';
      expect(safeMatches(div, '.test-class')).toBe(true);
      expect(safeMatches(div, 'span')).toBe(false);
    });

    test('resists DOM clobbering when matches property is overridden by input element', () => {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.setAttribute('name', 'matches');
      form.appendChild(input);

      Object.defineProperty(form, 'matches', {
        value: input,
        configurable: true,
      });

      expect(() => safeMatches(form, 'form')).not.toThrow();
      expect(safeMatches(form, 'form')).toBe(true);
    });

    test('returns false when error is thrown', () => {
      const faultyElement = {
        matches: () => {
          throw new Error('error');
        },
      } as unknown as Element;
      expect(safeMatches(faultyElement, 'div')).toBe(false);
    });
  });

  describe('safeClosest', () => {
    test('returns matching ancestor element', () => {
      const parent = document.createElement('div');
      parent.className = 'parent';
      const child = document.createElement('span');
      parent.appendChild(child);

      expect(safeClosest(child, '.parent')).toBe(parent);
      expect(safeClosest(child, '.non-existent')).toBeNull();
    });

    test('resists DOM clobbering when closest property is overridden', () => {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.setAttribute('name', 'closest');
      form.appendChild(input);

      Object.defineProperty(form, 'closest', {
        value: input,
        configurable: true,
      });

      expect(() => safeClosest(form, 'form')).not.toThrow();
      expect(safeClosest(form, 'form')).toBe(form);
    });

    test('returns null when error is thrown', () => {
      const faultyElement = {
        closest: () => {
          throw new Error('error');
        },
      } as unknown as Element;
      expect(safeClosest(faultyElement, 'div')).toBeNull();
    });
  });

  describe('safeHasAttribute and safeRemoveAttribute', () => {
    test('safely checks and removes attributes', () => {
      const el = document.createElement('div');
      el.setAttribute('oncontextmenu', 'return false');

      expect(safeHasAttribute(el, 'oncontextmenu')).toBe(true);
      safeRemoveAttribute(el, 'oncontextmenu');
      expect(safeHasAttribute(el, 'oncontextmenu')).toBe(false);
    });
  });

  describe('getUnshadowedGetter & safeGetStyle & safeGetShadowRoot', () => {
    test('retrieves style safely', () => {
      const el = document.createElement('div') as HTMLElement;
      el.style.userSelect = 'none';
      const style = safeGetStyle(el);
      expect(style).not.toBeNull();
      expect(style?.userSelect).toBe('none');
    });

    test('retrieves shadowRoot safely', () => {
      const el = document.createElement('div');
      expect(safeGetShadowRoot(el)).toBeNull();
    });
  });
});
