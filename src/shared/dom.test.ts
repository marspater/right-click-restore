import { describe, expect, test } from 'bun:test';
import { getUnshadowedGetter, getUnshadowedMethod } from './dom';

describe('unshadowed DOM helpers', () => {
  describe('getUnshadowedMethod', () => {
    test('retrieves method from prototype when shadowed on instance', () => {
      class Base {
        matches(sel: string) {
          return sel === 'div';
        }
      }
      const instance = new Base();
      // Shadow the method on instance (e.g. DOM clobbering or malicious script)
      (instance as unknown as Record<string, unknown>).matches = 'fake';

      const method = getUnshadowedMethod(instance, 'matches');
      expect(typeof method).toBe('function');
      expect(method?.call(instance, 'div')).toBe(true);
    });

    test('falls back to own property if defined on plain object or mock', () => {
      const mockObj = {
        closest: (sel: string) => sel,
      };

      const method = getUnshadowedMethod(mockObj, 'closest');
      expect(typeof method).toBe('function');
      expect(method?.call(mockObj, 'p')).toBe('p');
    });

    test('returns null if method does not exist or is not a function', () => {
      const obj = { notAFunction: 123 };
      expect(getUnshadowedMethod(obj, 'nonexistent')).toBeNull();
      expect(getUnshadowedMethod(obj, 'notAFunction')).toBeNull();
    });

    test('handles exceptions gracefully', () => {
      const problematicObj = Object.create(null);
      expect(getUnshadowedMethod(problematicObj, 'matches')).toBeNull();
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
      // Clobber/shadow on instance
      Object.defineProperty(instance, 'shadowRoot', {
        value: 'fakeShadowRoot',
        configurable: true,
      });

      const getter = getUnshadowedGetter(instance, 'shadowRoot');
      expect(typeof getter).toBe('function');
      expect(getter?.call(instance)).toBe('realShadowRoot');
    });

    test('falls back to own property getter if defined on mock', () => {
      const mockObj = {};
      Object.defineProperty(mockObj, 'style', {
        get() {
          return { display: 'none' };
        },
        configurable: true,
      });

      const getter = getUnshadowedGetter(mockObj, 'style');
      expect(typeof getter).toBe('function');
      expect(getter?.call(mockObj)).toEqual({ display: 'none' });
    });

    test('returns null if property or getter does not exist', () => {
      const obj = { regularProp: 'hello' };
      expect(getUnshadowedGetter(obj, 'nonexistent')).toBeNull();
      expect(getUnshadowedGetter(obj, 'regularProp')).toBeNull();
    });

    test('handles exceptions gracefully', () => {
      const problematicObj = Object.create(null);
      expect(getUnshadowedGetter(problematicObj, 'shadowRoot')).toBeNull();
    });
  });
});
