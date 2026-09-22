import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import {
  getUnshadowedGetter,
  getUnshadowedMethod,
  isInteractiveElement,
  safeClosest,
  safeGetElementById,
  safeGetShadowRoot,
  safeGetStyle,
  safeHasAttribute,
  safeMatches,
  safeQuerySelectorAll,
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

  describe('isInteractiveElement', () => {
    test('returns false for standard non-interactive elements without attributes or special classes', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');
      span.className = 'container card-body';
      const p = document.createElement('p');

      expect(isInteractiveElement(div)).toBe(false);
      expect(isInteractiveElement(span)).toBe(false);
      expect(isInteractiveElement(p)).toBe(false);
    });

    test('returns true for interactive HTML tags directly', () => {
      const input = document.createElement('input');
      const button = document.createElement('button');
      const select = document.createElement('select');
      const canvas = document.createElement('canvas');
      const ytdApp = document.createElement('ytd-app');

      expect(isInteractiveElement(input)).toBe(true);
      expect(isInteractiveElement(button)).toBe(true);
      expect(isInteractiveElement(select)).toBe(true);
      expect(isInteractiveElement(canvas)).toBe(true);
      expect(isInteractiveElement(ytdApp)).toBe(true);
    });

    test('returns true for elements with interactive roles', () => {
      const divBtn = document.createElement('div');
      divBtn.setAttribute('role', 'button');

      const divBox = document.createElement('div');
      divBox.setAttribute('role', 'textbox');

      expect(isInteractiveElement(divBtn)).toBe(true);
      expect(isInteractiveElement(divBox)).toBe(true);
    });

    test('returns true for elements with contenteditable', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');

      expect(isInteractiveElement(div)).toBe(true);
    });

    test('returns true for elements with interactive class names', () => {
      const monaco = document.createElement('div');
      monaco.className = 'monaco-editor my-custom-class';

      const ytPlayer = document.createElement('div');
      ytPlayer.className = 'ytp-chrome-bottom';

      expect(isInteractiveElement(monaco)).toBe(true);
      expect(isInteractiveElement(ytPlayer)).toBe(true);
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

  describe('safeGetElementById', () => {
    test('retrieves element by ID', () => {
      const div = document.createElement('div');
      div.id = 'my-target';
      document.body.appendChild(div);

      expect(safeGetElementById(document, 'my-target')).toBe(div);
      expect(safeGetElementById(document, 'nonexistent')).toBeNull();
    });

    test('resists DOM clobbering when getElementById property is overridden', () => {
      const div = document.createElement('div');
      div.id = 'my-target';
      document.body.appendChild(div);

      const form = document.createElement('form');
      form.id = 'getElementById';
      document.body.appendChild(form);

      // Clobber getElementById on document
      Object.defineProperty(document, 'getElementById', {
        value: form,
        configurable: true,
      });

      expect(safeGetElementById(document, 'my-target')).toBe(div);
    });
  });

  describe('safeQuerySelectorAll', () => {
    test('returns array of matching elements', () => {
      const container = document.createElement('div');
      const item1 = document.createElement('span');
      item1.className = 'item';
      const item2 = document.createElement('span');
      item2.className = 'item';
      container.appendChild(item1);
      container.appendChild(item2);

      const items = safeQuerySelectorAll(container, '.item');
      expect(items.length).toBe(2);
      expect(items[0]).toBe(item1);
      expect(items[1]).toBe(item2);
    });

    test('resists DOM clobbering when querySelectorAll is overridden', () => {
      const container = document.createElement('form');
      const input = document.createElement('input');
      input.setAttribute('name', 'querySelectorAll');
      container.appendChild(input);

      const target = document.createElement('div');
      target.className = 'target';
      container.appendChild(target);

      // Clobber querySelectorAll property on container
      Object.defineProperty(container, 'querySelectorAll', {
        value: input,
        configurable: true,
      });

      const results = safeQuerySelectorAll(container, '.target');
      expect(results.length).toBe(1);
      expect(results[0]).toBe(target);
    });
  });
});
