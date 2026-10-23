import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import {
  getUnshadowedGetter,
  getUnshadowedMethod,
  safeAppendChild,
  safeApply,
  safeAttachShadow,
  safeClosest,
  safeCreateElement,
  safeElementsFromPoint,
  safeGetAttribute,
  safeGetElementById,
  safeGetShadowRoot,
  safeGetStyle,
  safeGetTagName,
  safeHasAttribute,
  safeHasAttributes,
  safeMatches,
  safeQuerySelector,
  safeQuerySelectorAll,
  safeRemoveAttribute,
  safeRemoveElement,
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

  describe('safeGetTagName', () => {
    test('retrieves uppercase tag name for standard elements', () => {
      const div = document.createElement('div');
      const span = document.createElement('span');
      expect(safeGetTagName(div)).toBe('DIV');
      expect(safeGetTagName(span)).toBe('SPAN');
    });

    test('resists DOM clobbering when tagName is overridden by named child input', () => {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.setAttribute('name', 'tagName');
      form.appendChild(input);

      Object.defineProperty(form, 'tagName', {
        value: input,
        configurable: true,
      });

      expect(safeGetTagName(form)).toBe('FORM');
    });

    test('handles non-elements or faulty objects safely without throwing', () => {
      expect(safeGetTagName(null as unknown as Element)).toBe('');
      const faulty = {
        tagName: 'invalid',
      } as unknown as Element;
      expect(safeGetTagName(faulty)).toBe('INVALID');
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

  describe('safeHasAttribute, safeGetAttribute, safeHasAttributes, safeRemoveAttribute, and safeRemoveElement', () => {
    test('safely checks, reads, and removes attributes', () => {
      const el = document.createElement('div');
      el.setAttribute('oncontextmenu', 'return false');

      expect(safeHasAttribute(el, 'oncontextmenu')).toBe(true);
      expect(safeGetAttribute(el, 'oncontextmenu')).toBe('return false');
      expect(safeGetAttribute(el, 'style')).toBeNull();
      safeRemoveAttribute(el, 'oncontextmenu');
      expect(safeHasAttribute(el, 'oncontextmenu')).toBe(false);
      expect(safeGetAttribute(el, 'oncontextmenu')).toBeNull();
    });

    test('safeGetAttribute resists DOM clobbering', () => {
      const form = document.createElement('form');
      form.setAttribute('style', 'color: red;');
      const input = document.createElement('input');
      input.setAttribute('name', 'getAttribute');
      form.appendChild(input);

      Object.defineProperty(form, 'getAttribute', {
        value: input,
        configurable: true,
      });

      expect(safeGetAttribute(form, 'style')).toBe('color: red;');
    });

    test('safeRemoveElement removes element and resists DOM clobbering', () => {
      const parent = document.createElement('div');
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.setAttribute('name', 'remove');
      form.appendChild(input);
      parent.appendChild(form);

      // Clobber remove property on form instance
      Object.defineProperty(form, 'remove', {
        value: input,
        configurable: true,
      });

      expect(parent.contains(form)).toBe(true);
      safeRemoveElement(form);
      expect(parent.contains(form)).toBe(false);
    });

    test('safeHasAttributes checks attribute presence accurately and resists DOM clobbering', () => {
      const plain = document.createElement('div');
      expect(safeHasAttributes(plain)).toBe(false);

      plain.setAttribute('data-test', 'true');
      expect(safeHasAttributes(plain)).toBe(true);

      const form = document.createElement('form');
      form.setAttribute('id', 'clobbered-form');
      const input = document.createElement('input');
      input.setAttribute('name', 'hasAttributes');
      form.appendChild(input);

      Object.defineProperty(form, 'hasAttributes', {
        value: input,
        configurable: true,
      });

      expect(safeHasAttributes(form)).toBe(true);
    });

    test('safeHasAttributes returns true (fails safe) when hasAttributes throws', () => {
      const faulty = {
        hasAttributes: () => {
          throw new Error('fail');
        },
      } as unknown as Element;
      expect(safeHasAttributes(faulty)).toBe(true);
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

    test('resists DOM clobbering on style property', () => {
      const form = document.createElement('form') as HTMLElement;
      const input = document.createElement('input');
      input.setAttribute('name', 'style');
      form.appendChild(input);

      Object.defineProperty(form, 'style', {
        value: input,
        configurable: true,
      });

      const style = safeGetStyle(form);
      expect(
        style === null || typeof style?.getPropertyValue === 'function',
      ).toBe(true);
      expect(style).not.toBe(input as unknown as CSSStyleDeclaration);
    });

    test('handles non-HTMLElement or SVGElement safely without throwing', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      expect(() => safeGetStyle(svg as unknown as HTMLElement)).not.toThrow();
    });

    test('rejects plain object interface spoofing for shadowRoot and style', () => {
      const mockElement = {
        shadowRoot: {
          nodeType: 11,
          querySelectorAll: () => [],
        },
        style: {
          getPropertyValue: () => 'none',
          userSelect: 'none',
        },
      } as unknown as HTMLElement;

      expect(safeGetShadowRoot(mockElement)).toBeNull();
      expect(safeGetStyle(mockElement)).toBeNull();
    });

    test('retrieves shadowRoot safely', () => {
      const el = document.createElement('div');
      expect(safeGetShadowRoot(el)).toBeNull();
    });

    test('resists DOM clobbering on shadowRoot property', () => {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.setAttribute('name', 'shadowRoot');
      form.appendChild(input);

      Object.defineProperty(form, 'shadowRoot', {
        value: input,
        configurable: true,
      });

      const shadow = safeGetShadowRoot(form);
      expect(shadow).toBeNull();
    });
  });

  describe('Function prototype shadowing resistance', () => {
    test('safeMatches, safeClosest, and DOM utilities operate even if Function.prototype.apply and call are shadowed', () => {
      const origApply = Function.prototype.apply;
      const origCall = Function.prototype.call;

      try {
        // Shadow apply and call on Function.prototype with malicious/failing implementations
        Function.prototype.apply = () => {
          throw new Error('Host page hijacked Function.prototype.apply');
        };
        Function.prototype.call = () => {
          throw new Error('Host page hijacked Function.prototype.call');
        };

        const div = document.createElement('div');
        div.className = 'test-class';
        expect(safeMatches(div, '.test-class')).toBe(true);

        const parent = document.createElement('div');
        parent.className = 'parent';
        parent.appendChild(div);
        expect(safeClosest(div, '.parent')).toBe(parent);

        div.setAttribute('oncontextmenu', 'return false');
        expect(safeHasAttribute(div, 'oncontextmenu')).toBe(true);
        safeRemoveAttribute(div, 'oncontextmenu');
        expect(safeHasAttribute(div, 'oncontextmenu')).toBe(false);
      } finally {
        Function.prototype.apply = origApply;
        Function.prototype.call = origCall;
      }
    });

    test('safeApply executes native functions accurately', () => {
      const add = function (this: { offset: number }, a: number, b: number) {
        return this.offset + a + b;
      };
      const context = { offset: 10 };
      expect(safeApply(add, context, [5, 3])).toBe(18);
    });
  });

  describe('safeCreateElement', () => {
    test('creates element by tag name', () => {
      const div = safeCreateElement(document, 'div');
      expect(div).toBeInstanceOf(window.HTMLElement);
      expect(div.tagName).toBe('DIV');
    });

    test('resists DOM clobbering when createElement property is overridden on document', () => {
      const form = document.createElement('form');
      form.id = 'createElement';
      document.body.appendChild(form);

      // Clobber createElement on document
      Object.defineProperty(document, 'createElement', {
        value: form,
        configurable: true,
      });

      const span = safeCreateElement(document, 'span');
      expect(span).toBeInstanceOf(window.HTMLElement);
      expect(span.tagName).toBe('SPAN');
    });
  });

  describe('safeElementsFromPoint', () => {
    test('returns array of elements at point when elementsFromPoint is available', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      const proto = Object.getPrototypeOf(document);
      const orig = proto.elementsFromPoint;
      proto.elementsFromPoint = (_x: number, _y: number) => [div];

      try {
        const elements = safeElementsFromPoint(document, 10, 10);
        expect(Array.isArray(elements)).toBe(true);
        expect(elements).toContain(div);
      } finally {
        if (orig) {
          proto.elementsFromPoint = orig;
        } else {
          proto.elementsFromPoint = undefined;
        }
      }
    });

    test('resists DOM clobbering when elementsFromPoint property is overridden on document instance', () => {
      const form = document.createElement('form');
      form.id = 'elementsFromPoint';
      document.body.appendChild(form);

      // Clobber elementsFromPoint on document
      Object.defineProperty(document, 'elementsFromPoint', {
        value: form,
        configurable: true,
      });

      const elements = safeElementsFromPoint(document, 10, 10);
      expect(Array.isArray(elements)).toBe(true);
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

  function createClobberedForm(methodName: string): HTMLFormElement {
    const form = document.createElement('form');
    const input = document.createElement('input');
    input.setAttribute('name', methodName);
    form.appendChild(input);
    Object.defineProperty(form, methodName, {
      value: input,
      configurable: true,
    });
    return form;
  }

  describe('safeAppendChild', () => {
    test('appends child element to parent container', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      safeAppendChild(parent, child);
      expect(parent.contains(child)).toBe(true);
    });

    test('resists DOM clobbering when appendChild is overridden by child input', () => {
      const form = createClobberedForm('appendChild');
      const child = document.createElement('span');
      expect(() => safeAppendChild(form, child)).not.toThrow();
      expect(form.contains(child)).toBe(true);
    });
  });

  describe('safeAttachShadow', () => {
    test('attaches shadow root to host element when supported', () => {
      const host = document.createElement('div');
      if (typeof host.attachShadow === 'function') {
        const shadow = safeAttachShadow(host, { mode: 'closed' });
        expect(shadow).not.toBeNull();
      }
    });

    test('resists DOM clobbering when attachShadow is overridden on element instance', () => {
      const form = createClobberedForm('attachShadow');
      expect(() => safeAttachShadow(form, { mode: 'closed' })).not.toThrow();
    });
  });

  describe('safeQuerySelectorAll & safeQuerySelector', () => {
    test('returns array of matching elements or single first match', () => {
      const container = document.createElement('div');
      const item1 = document.createElement('span');
      item1.className = 'item';
      const item2 = document.createElement('span');
      item2.className = 'item';
      container.appendChild(item1);
      container.appendChild(item2);

      const items = safeQuerySelectorAll(container, '.item');
      expect(items).toHaveLength(2);
      expect(items[0]).toBe(item1);
      expect(items[1]).toBe(item2);

      expect(safeQuerySelector(container, '.item')).toBe(item1);
      expect(safeQuerySelector(container, '.missing')).toBeNull();
    });

    test('resists DOM clobbering when querySelectorAll or querySelector is overridden', () => {
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
      expect(results).toHaveLength(1);
      expect(results[0]).toBe(target);

      // Clobber querySelector property on container
      Object.defineProperty(container, 'querySelector', {
        value: input,
        configurable: true,
      });

      expect(safeQuerySelector(container, '.target')).toBe(target);
    });
  });

  describe('cached native DOM prototype methods and safe fallbacks', () => {
    test('cached native matches invokes correctly and falls back when shadowed or throwing', () => {
      const el = document.createElement('div');
      el.className = 'active-test';

      // 1. Invokes cached native method
      expect(safeMatches(el, '.active-test')).toBe(true);
      expect(safeMatches(el, '.other-class')).toBe(false);

      // 2. Falls back when shadowed on instance
      Object.defineProperty(el, 'matches', {
        value: 'hijacked-matches',
        configurable: true,
      });
      expect(safeMatches(el, '.active-test')).toBe(true);

      // 3. Falls back safely when matching throws
      const throwingEl = {
        matches: () => {
          throw new Error('invalid selector');
        },
      } as unknown as Element;
      expect(safeMatches(throwingEl, ':invalid-pseudo')).toBe(false);
    });

    test('cached native closest invokes correctly and falls back when shadowed or throwing', () => {
      const parent = document.createElement('section');
      parent.className = 'container-section';
      const child = document.createElement('span');
      parent.appendChild(child);

      // 1. Invokes cached native method
      expect(safeClosest(child, '.container-section')).toBe(parent);
      expect(safeClosest(child, '.missing-section')).toBeNull();

      // 2. Falls back when shadowed on instance
      Object.defineProperty(child, 'closest', {
        value: 'hijacked-closest',
        configurable: true,
      });
      expect(safeClosest(child, '.container-section')).toBe(parent);

      // 3. Falls back safely when throws
      const throwingChild = {
        closest: () => {
          throw new Error('traversal error');
        },
      } as unknown as Element;
      expect(safeClosest(throwingChild, 'div')).toBeNull();
    });

    test('cached native hasAttribute and removeAttribute invoke correctly and fall back when shadowed', () => {
      const form = document.createElement('form');
      form.setAttribute('data-target', 'original-val');

      // 1. Invokes cached native methods
      expect(safeHasAttribute(form, 'data-target')).toBe(true);
      expect(safeHasAttribute(form, 'data-missing')).toBe(false);

      // 2. Falls back safely when hasAttribute is shadowed
      const inputHasAttr = document.createElement('input');
      inputHasAttr.setAttribute('name', 'hasAttribute');
      form.appendChild(inputHasAttr);
      Object.defineProperty(form, 'hasAttribute', {
        value: inputHasAttr,
        configurable: true,
      });
      expect(safeHasAttribute(form, 'data-target')).toBe(true);

      // 3. Falls back safely when removeAttribute is shadowed
      const inputRemoveAttr = document.createElement('input');
      inputRemoveAttr.setAttribute('name', 'removeAttribute');
      form.appendChild(inputRemoveAttr);
      Object.defineProperty(form, 'removeAttribute', {
        value: inputRemoveAttr,
        configurable: true,
      });
      safeRemoveAttribute(form, 'data-target');
      expect(safeHasAttribute(form, 'data-target')).toBe(false);

      // 4. Safe removal on plain object/mock falling back to unshadowed method
      let removedMockAttr = '';
      const mockEl = {
        hasAttribute: (name: string) => name === 'data-mock',
        removeAttribute: (name: string) => {
          removedMockAttr = name;
        },
      } as unknown as Element;
      safeRemoveAttribute(mockEl, 'data-mock');
      expect(removedMockAttr).toBe('data-mock');
    });

    test('cached native hasAttributes invokes correctly and falls back when shadowed or throwing', () => {
      const div = document.createElement('div');
      expect(safeHasAttributes(div)).toBe(false);
      div.setAttribute('id', 'test-has-attributes');
      expect(safeHasAttributes(div)).toBe(true);

      // Falls back when shadowed on instance
      Object.defineProperty(div, 'hasAttributes', {
        value: null,
        configurable: true,
      });
      expect(safeHasAttributes(div)).toBe(true);

      // Fails safe (assumes attributes exist) when throws
      const throwingEl = {
        hasAttributes: () => {
          throw new Error('access error');
        },
      } as unknown as Element;
      expect(safeHasAttributes(throwingEl)).toBe(true);
    });

    test('cached native getElementById invokes correctly and falls back when shadowed or on mock document', () => {
      const el = document.createElement('div');
      el.id = 'cached-test-id';
      document.body.appendChild(el);

      // 1. Invokes cached native method
      expect(safeGetElementById(document, 'cached-test-id')).toBe(el);
      expect(safeGetElementById(document, 'non-existent-id')).toBeNull();

      // 2. Falls back when shadowed on document instance
      Object.defineProperty(document, 'getElementById', {
        value: el,
        configurable: true,
      });
      expect(safeGetElementById(document, 'cached-test-id')).toBe(el);

      // 3. Falls back safely when doc is mock plain object
      const mockDoc = {
        getElementById: (id: string) => (id === 'mock-id' ? el : null),
      } as unknown as Document;
      expect(safeGetElementById(mockDoc, 'mock-id')).toBe(el);
      expect(safeGetElementById(mockDoc, 'unknown')).toBeNull();
    });

    test('cached native getAttribute invokes correctly and falls back when shadowed or on mock element', () => {
      const el = document.createElement('div');
      el.setAttribute('data-test', 'cached-value');

      // 1. Invokes cached native method
      expect(safeGetAttribute(el, 'data-test')).toBe('cached-value');
      expect(safeGetAttribute(el, 'missing-attr')).toBeNull();

      // 2. Falls back when shadowed on instance
      Object.defineProperty(el, 'getAttribute', {
        value: 'hijacked-getAttribute',
        configurable: true,
      });
      expect(safeGetAttribute(el, 'data-test')).toBe('cached-value');

      // 3. Falls back safely on mock plain object
      const mockEl = {
        getAttribute: (attr: string) => (attr === 'mock' ? 'mock-val' : null),
      } as unknown as Element;
      expect(safeGetAttribute(mockEl, 'mock')).toBe('mock-val');
      expect(safeGetAttribute(mockEl, 'other')).toBeNull();
    });

    test('cached native querySelectorAll invokes correctly on Element, Document, DocumentFragment, and falls back when shadowed', () => {
      const container = document.createElement('div');
      const child1 = document.createElement('span');
      child1.className = 'qsa-item';
      const child2 = document.createElement('span');
      child2.className = 'qsa-item';
      container.appendChild(child1);
      container.appendChild(child2);

      // 1. Invokes cached native method on Element
      const items = safeQuerySelectorAll(container, '.qsa-item');
      expect(items).toHaveLength(2);
      expect(items).toContain(child1);
      expect(items).toContain(child2);

      // 2. Invokes cached native method on Document
      document.body.appendChild(container);
      expect(safeQuerySelectorAll(document, '.qsa-item')).toHaveLength(2);

      // 3. Invokes cached native method on DocumentFragment
      const fragment = document.createDocumentFragment();
      const fragChild = document.createElement('div');
      fragChild.className = 'frag-item';
      fragment.appendChild(fragChild);
      expect(safeQuerySelectorAll(fragment, '.frag-item')).toHaveLength(1);

      // 4. Falls back when querySelectorAll is shadowed on instance
      Object.defineProperty(container, 'querySelectorAll', {
        value: 'hijacked-qsa',
        configurable: true,
      });
      expect(safeQuerySelectorAll(container, '.qsa-item')).toHaveLength(2);

      // 5. Falls back safely on mock plain object
      const mockRoot = {
        querySelectorAll: (sel: string) => (sel === '.test' ? [child1] : []),
      } as unknown as ParentNode;
      expect(safeQuerySelectorAll(mockRoot, '.test')).toEqual([child1]);
    });

    test('cached native method accessors safely handle unavailable DOM globals and null inputs', () => {
      expect(safeGetAttribute(null as unknown as Element, 'id')).toBeNull();
      expect(
        safeQuerySelectorAll(null as unknown as ParentNode, 'div'),
      ).toEqual([]);

      const origElement = globalThis.Element;
      const origDocument = globalThis.Document;
      const origDocumentFragment = globalThis.DocumentFragment;
      try {
        // @ts-expect-error simulating unavailable globals
        globalThis.Element = undefined;
        // @ts-expect-error simulating unavailable globals
        globalThis.Document = undefined;
        // @ts-expect-error simulating unavailable globals
        globalThis.DocumentFragment = undefined;

        const mockEl = {
          getAttribute: (name: string) => (name === 'id' ? 'safe' : null),
        } as unknown as Element;
        expect(safeGetAttribute(mockEl, 'id')).toBe('safe');
        expect(safeGetAttribute(mockEl, 'missing')).toBeNull();

        const mockDoc = {
          querySelectorAll: (sel: string) => (sel === 'div' ? [mockEl] : []),
        } as unknown as Document;
        expect(safeQuerySelectorAll(mockDoc, 'div')).toEqual([mockEl]);
        expect(safeQuerySelectorAll(mockDoc, 'span')).toEqual([]);
      } finally {
        globalThis.Element = origElement;
        globalThis.Document = origDocument;
        globalThis.DocumentFragment = origDocumentFragment;
      }
    });
  });
});
