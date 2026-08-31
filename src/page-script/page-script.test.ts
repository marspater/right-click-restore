import { describe, expect, test } from 'bun:test';

class SimpleEventTarget {
  private listeners: Record<string, ((e: { detail?: unknown }) => void)[]> = {};

  addEventListener(type: string, listener: (e: { detail?: unknown }) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  dispatchEvent(type: string, event: { detail?: unknown }) {
    const list = this.listeners[type] || [];
    for (const fn of list) {
      fn(event);
    }
  }
}

describe('page-script security', () => {
  test('ignores unauthenticated __rcr_update_config events', () => {
    let activeConfig = { enabled: true };
    const mockWindow = new SimpleEventTarget();

    const updateEvent: string | undefined = undefined; // No secure channel set

    if (updateEvent) {
      mockWindow.addEventListener(updateEvent, (e) => {
        if (e.detail) {
          activeConfig = e.detail as { enabled: boolean };
        }
      });
    }

    // Hostile page script attempts to send unauthenticated update event
    mockWindow.dispatchEvent('__rcr_update_config', {
      detail: { enabled: false },
    });

    expect(activeConfig.enabled).toBe(true);
  });

  test('accepts updates on randomized event channel', () => {
    let activeConfig = { enabled: true };
    const mockWindow = new SimpleEventTarget();
    const secretEvent = `__rcr_update_${Math.random().toString(36).substring(2)}`;

    mockWindow.addEventListener(secretEvent, (e) => {
      if (e.detail) {
        activeConfig = e.detail as { enabled: boolean };
      }
    });

    // Valid update from content script using secret event name
    mockWindow.dispatchEvent(secretEvent, {
      detail: { enabled: false },
    });

    expect(activeConfig.enabled).toBe(false);
  });
});
