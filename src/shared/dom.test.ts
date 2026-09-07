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

describe('shared DOM utilities', () => {
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

  describe('getUnshadowedMethod', () => {
    test('retrieves method from prototype when shadowed on instance', () => {
      class Base {
        matches(sel: string) {
          return sel === 'div';
        }
      }
      const instance = new Base();
      (instance as unknown as Record<string, unknown>).matches = 'clobbered';

      const method = getUnshadowedMethod(instance, 'matches');
      expect(typeof method).toBe('function');
      expect(method?.call(instance, 'div')).toBe(true);
    });

    test('falls back to own property on mock object', () => {
      const mockObj = {
        closest: (sel: string) => sel,
      };
      const method = getUnshadowedMethod(mockObj, 'closest');
      expect(typeof method).toBe('function');
      expect(method?.call(mockObj, 'p')).toBe('p');
    });

    test('returns null if method not found', () => {
      expect(getUnshadowedMethod({}, 'nonexistent')).toBeNull();
    });
  });

  describe('getUnshadowedGetter', () => {
    test('retrieves getter from prototype when property is shadowed on instance', () => {
      class Base {
        get shadowRoot() {
          return 'realShadowRoot';
        }
      }
      const instance = new Base();
      Object.defineProperty(instance, 'shadowRoot', {
        value: 'fakeShadowRoot',
        configurable: true,
      });

      const getter = getUnshadowedGetter(instance, 'shadowRoot');
      expect(typeof getter).toBe('function');
      expect(getter?.call(instance)).toBe('realShadowRoot');
    });

    test('returns null if property does not exist', () => {
      expect(getUnshadowedGetter({}, 'nonexistent')).toBeNull();
    });
  });

  describe('safeMatches', () => {
    test('returns true when element matches selector', () => {
      const div = document.createElement('div');
      div.className = 'test-class';
      expect(safeMatches(div, '.test-class')).toBe(true);
      expect(safeMatches(div, 'span')).toBe(false);
    });

    test('resists DOM clobbering when matches property is overridden by input', () => {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.setAttribute('name', 'matches');
      form.appendChild(input);

      Object.defineProperty(form, 'matches', {
        value: input,
        configurable: true,
      });

      expect(safeMatches(form, 'form')).toBe(true);
    });

    test('returns false when matching throws an error', () => {
      const faulty = {
        matches: () => {
          throw new Error('fail');
        },
      } as unknown as Element;
      expect(safeMatches(faulty, 'div')).toBe(false);
    });
  });

  describe('safeClosest', () => {
    test('returns matching ancestor element', () => {
      const parent = document.createElement('div');
      parent.className = 'parent';
      const child = document.createElement('span');
      parent.appendChild(child);

      expect(safeClosest(child, '.parent')).toBe(parent);
      expect(safeClosest(child, '.missing')).toBeNull();
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

      expect(safeClosest(form, 'form')).toBe(form);
    });

    test('returns null when closest throws', () => {
      const faulty = {
        closest: () => {
          throw new Error('fail');
        },
      } as unknown as Element;
      expect(safeClosest(faulty, 'div')).toBeNull();
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

  describe('safeGetShadowRoot & safeGetStyle', () => {
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
