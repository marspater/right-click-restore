import { describe, expect, test } from 'bun:test';
import {
  ALL_INTERACTIVE_SELECTORS,
  INTERACTIVE_CONTAINERS,
  INTERACTIVE_ELEMENTS,
} from './constants';

describe('interactive element selectors', () => {
  test('ALL_INTERACTIVE_SELECTORS combines containers and elements', () => {
    expect(ALL_INTERACTIVE_SELECTORS).toContain(INTERACTIVE_ELEMENTS);
    expect(ALL_INTERACTIVE_SELECTORS).toContain(INTERACTIVE_CONTAINERS);
  });
  test('INTERACTIVE_CONTAINERS contains expected selectors', () => {
    expect(INTERACTIVE_CONTAINERS).toContain('.ProseMirror');
    expect(INTERACTIVE_CONTAINERS).toContain('.monaco-editor');
    expect(INTERACTIVE_CONTAINERS).toContain('.html5-video-player');
    expect(INTERACTIVE_CONTAINERS).toContain('[contenteditable="true"]');
  });

  test('INTERACTIVE_ELEMENTS contains expected selectors', () => {
    expect(INTERACTIVE_ELEMENTS).toContain('input');
    expect(INTERACTIVE_ELEMENTS).toContain('textarea');
    expect(INTERACTIVE_ELEMENTS).toContain('select');
    expect(INTERACTIVE_ELEMENTS).toContain('button');
    expect(INTERACTIVE_ELEMENTS).toContain('[contenteditable]');
    expect(INTERACTIVE_ELEMENTS).toContain('[role="textbox"]');
    expect(INTERACTIVE_ELEMENTS).toContain('canvas');
  });
});
