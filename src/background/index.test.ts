import { beforeEach, describe, expect, test } from 'bun:test';
import { handleInstalled, handleStartup, syncBadge } from './index';

describe('background script', () => {
  let storageState: Record<string, unknown> = {};
  let badgeText = '';
  let badgeColor = '';

  beforeEach(() => {
    storageState = {};
    badgeText = '';
    badgeColor = '';

    (globalThis as unknown as Record<string, unknown>).chrome = {
      action: {
        setBadgeText: (details: { text: string }, cb?: () => void) => {
          badgeText = details.text;
          cb?.();
        },
        setBadgeBackgroundColor: (
          details: { color: string },
          cb?: () => void,
        ) => {
          badgeColor = details.color;
          cb?.();
        },
      },
      storage: {
        local: {
          get: (
            _keys: string[],
            cb: (res: Record<string, unknown>) => void,
          ) => {
            cb(storageState);
          },
          set: (data: Record<string, unknown>, cb?: () => void) => {
            Object.assign(storageState, data);
            cb?.();
          },
        },
      },
      runtime: {
        lastError: null,
      },
    };
  });

  test('handleInstalled initializes shieldEnabled when undefined and sets badge ON', () => {
    handleInstalled();
    expect(storageState.shieldEnabled).toBe(true);
    expect(badgeText).toBe('ON');
    expect(badgeColor).toBe('#007AFF');
  });

  test('handleInstalled keeps shieldEnabled as false if already set to false', () => {
    storageState.shieldEnabled = false;
    handleInstalled();
    expect(storageState.shieldEnabled).toBe(false);
    expect(badgeText).toBe('OFF');
    expect(badgeColor).toBe('#8E8E93');
  });

  test('handleStartup updates badge based on existing storage', () => {
    storageState.shieldEnabled = true;
    handleStartup();
    expect(badgeText).toBe('ON');

    storageState.shieldEnabled = false;
    handleStartup();
    expect(badgeText).toBe('OFF');
  });

  test('syncBadge handles chrome.action errors gracefully', () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      action: {
        setBadgeText: () => {
          throw new Error('API unavailable');
        },
        setBadgeBackgroundColor: () => {
          throw new Error('API unavailable');
        },
      },
      runtime: {},
    };

    expect(() => syncBadge(true)).not.toThrow();
  });

  test('handleInstalled and handleStartup handle chrome.runtime.lastError gracefully', () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      action: {
        setBadgeText: (details: { text: string }) => {
          badgeText = details.text;
        },
        setBadgeBackgroundColor: (details: { color: string }) => {
          badgeColor = details.color;
        },
      },
      storage: {
        local: {
          get: (_keys: string[], cb: (res?: unknown) => void) => {
            (
              globalThis as unknown as {
                chrome: { runtime: { lastError: Error } };
              }
            ).chrome.runtime.lastError = new Error('Storage access denied');
            cb(undefined);
          },
          set: () => {},
        },
      },
      runtime: {
        lastError: null,
      },
    };

    expect(() => handleInstalled()).not.toThrow();
    expect(badgeText).toBe('ON');

    expect(() => handleStartup()).not.toThrow();
    expect(badgeText).toBe('ON');
  });
});
