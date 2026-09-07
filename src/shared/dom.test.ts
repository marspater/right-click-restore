import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { getUnshadowedMethod, safeClosest, safeMatches } from './dom';

describe('DOM helpers in shared/dom', () => {
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

  test('getUnshadowedMethod retrieves prototype method on unclobbered element', () => {
    const div = document.createElement('div');
    const fn = getUnshadowedMethod(div, 'getAttribute');
    expect(typeof fn).toBe('function');
  });

  test('getUnshadowedMethod resists DOM clobbering on element own property', () => {
    const form = document.createElement('form');
    const inputMatches = document.createElement('input');
    inputMatches.setAttribute('name', 'matches');
    form.appendChild(inputMatches);

    Object.defineProperty(form, 'matches', {
      value: inputMatches,
      configurable: true,
    });

    const fn = getUnshadowedMethod(form, 'matches');
    expect(typeof fn).toBe('function');
    expect(fn).not.toBe(inputMatches);
  });

  test('safeMatches tests selector correctly', () => {
    const div = document.createElement('div');
    div.className = 'test-class';
    expect(safeMatches(div, '.test-class')).toBe(true);
    expect(safeMatches(div, '.other-class')).toBe(false);
  });

  test('safeClosest finds closest matching ancestor', () => {
    const parent = document.createElement('div');
    parent.className = 'parent-container';
    const child = document.createElement('span');
    parent.appendChild(child);

    expect(safeClosest(child, '.parent-container')).toBe(parent);
    expect(safeClosest(child, '.non-existent')).toBeNull();
  });
});
