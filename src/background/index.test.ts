import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { handleInstalled, handleStartup, syncBadge } from './index';

describe('background script', () => {
  let storageStore: Record<string, unknown> = {};

  const setBadgeTextMock = mock(() => {});
  const setBadgeBackgroundColorMock = mock(() => {});
  const storageGetMock = mock(
    (keys: string[], callback: (res: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in storageStore) {
          result[key] = storageStore[key];
        }
      }
      callback(result);
    },
  );
  const storageSetMock = mock(
    (items: Record<string, unknown>, callback?: () => void) => {
      Object.assign(storageStore, items);
      if (callback) callback();
    },
  );

  beforeEach(() => {
    storageStore = {};
    setBadgeTextMock.mockClear();
    setBadgeBackgroundColorMock.mockClear();
    storageGetMock.mockClear();
    storageSetMock.mockClear();

    // Setup global chrome object mock
    (globalThis as unknown as { chrome: unknown }).chrome = {
      action: {
        setBadgeText: setBadgeTextMock,
        setBadgeBackgroundColor: setBadgeBackgroundColorMock,
      },
      runtime: {
        onInstalled: {
          addListener: mock(() => {}),
        },
        onStartup: {
          addListener: mock(() => {}),
        },
      },
      storage: {
        local: {
          get: storageGetMock,
          set: storageSetMock,
        },
      },
    };
  });

  test('handleInstalled initializes shieldEnabled when undefined and sets badge ON', () => {
    handleInstalled();

    expect(storageGetMock).toHaveBeenCalled();
    expect(storageSetMock).toHaveBeenCalledWith({ shieldEnabled: true });
    expect(setBadgeTextMock).toHaveBeenCalledWith({ text: 'ON' });
    expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({
      color: '#007AFF',
    });
  });

  test('handleInstalled keeps shieldEnabled as false if already set to false', () => {
    storageStore = { shieldEnabled: false };
    handleInstalled();

    expect(storageSetMock).toHaveBeenCalledWith({ shieldEnabled: false });
    expect(setBadgeTextMock).toHaveBeenCalledWith({ text: 'OFF' });
    expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({
      color: '#8E8E93',
    });
  });

  test('handleStartup updates badge based on existing storage', () => {
    storageStore = { shieldEnabled: true };
    handleStartup();

    expect(setBadgeTextMock).toHaveBeenCalledWith({ text: 'ON' });
    expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({
      color: '#007AFF',
    });
  });

  test('syncBadge handles chrome.action errors gracefully', () => {
    setBadgeTextMock.mockImplementation(() => {
      throw new Error('chrome.action error');
    });

    expect(() => {
      syncBadge(true);
    }).not.toThrow();
  });
});
