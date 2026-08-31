import { beforeEach, describe, expect, mock, test } from 'bun:test';

describe('background script', () => {
  let onInstalledListener: (() => void) | null = null;
  let onStartupListener: (() => void) | null = null;
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
    onInstalledListener = null;
    onStartupListener = null;
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
          addListener: mock((fn: () => void) => {
            onInstalledListener = fn;
          }),
        },
        onStartup: {
          addListener: mock((fn: () => void) => {
            onStartupListener = fn;
          }),
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

  test('onInstalled initializes shieldEnabled when undefined and sets badge ON', async () => {
    // Import module dynamically to execute event registration
    await import(`./index?t=${Date.now()}`);

    expect(onInstalledListener).not.toBeNull();
    if (onInstalledListener) {
      onInstalledListener();
    }

    expect(storageGetMock).toHaveBeenCalled();
    expect(storageSetMock).toHaveBeenCalledWith({ shieldEnabled: true });
    expect(setBadgeTextMock).toHaveBeenCalledWith({ text: 'ON' });
    expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({
      color: '#007AFF',
    });
  });

  test('onInstalled keeps shieldEnabled as false if already set to false', async () => {
    storageStore = { shieldEnabled: false };
    await import(`./index?t=${Date.now()}`);

    if (onInstalledListener) {
      onInstalledListener();
    }

    expect(storageSetMock).toHaveBeenCalledWith({ shieldEnabled: false });
    expect(setBadgeTextMock).toHaveBeenCalledWith({ text: 'OFF' });
    expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({
      color: '#8E8E93',
    });
  });

  test('onStartup updates badge based on existing storage', async () => {
    storageStore = { shieldEnabled: true };
    await import(`./index?t=${Date.now()}`);

    expect(onStartupListener).not.toBeNull();
    if (onStartupListener) {
      onStartupListener();
    }

    expect(setBadgeTextMock).toHaveBeenCalledWith({ text: 'ON' });
    expect(setBadgeBackgroundColorMock).toHaveBeenCalledWith({
      color: '#007AFF',
    });
  });

  test('syncBadge handles chrome.action errors gracefully', async () => {
    setBadgeTextMock.mockImplementation(() => {
      throw new Error('chrome.action error');
    });

    await import(`./index?t=${Date.now()}`);

    expect(() => {
      if (onInstalledListener) {
        onInstalledListener();
      }
    }).not.toThrow();
  });
});
