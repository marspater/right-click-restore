import { describe, expect, test } from 'bun:test';

class DummyNode {}
class DummyElement extends DummyNode {
  matches() {
    return false;
  }
  closest() {
    return null;
  }
}
class DummyEvent {
  type: string;
  target: unknown;
  defaultPrevented = false;
  propagationStopped = false;
  immediatePropagationStopped = false;

  constructor(type: string, target: unknown = null) {
    this.type = type;
    this.target = target;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopPropagation() {
    this.propagationStopped = true;
  }
  stopImmediatePropagation() {
    this.immediatePropagationStopped = true;
  }
}

class DummyMouseEvent extends DummyEvent {}
class DummyKeyboardEvent extends DummyEvent {}

const g = globalThis as unknown as Record<string, unknown>;

if (typeof globalThis.Node === 'undefined') {
  g.Node = DummyNode;
  g.Element = DummyElement;
  g.Event = DummyEvent;
  g.MouseEvent = DummyMouseEvent;
  g.KeyboardEvent = DummyKeyboardEvent;
  g.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.document = {
    currentScript: null,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

describe('page-script event prototype blocking logic', () => {
  test('overrides Event prototype methods correctly and blocks contextmenu', async () => {
    await import('./index');

    const event = new globalThis.Event('contextmenu') as unknown as DummyEvent;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Since shouldBlockEvent returns true, original methods should NOT be called
    expect(event.defaultPrevented).toBe(false);
    expect(event.propagationStopped).toBe(false);
    expect(event.immediatePropagationStopped).toBe(false);
  });

  test('does not block custom or non-matching events', async () => {
    await import('./index');

    const event = new globalThis.Event('custom_event') as unknown as DummyEvent;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Custom events are not blocked, so original methods are called
    expect(event.defaultPrevented).toBe(true);
    expect(event.propagationStopped).toBe(true);
    expect(event.immediatePropagationStopped).toBe(true);
  });
});
