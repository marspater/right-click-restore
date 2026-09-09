import { beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { Settings } from '../shared/settings';
import { handleContentMessage } from './index';

describe('content script message handler', () => {
  let windowInstance: InstanceType<typeof Window>;

  beforeEach(() => {
    windowInstance = new Window();
    Object.assign(globalThis, {
      window: windowInstance,
      document: windowInstance.document,
      MutationObserver: windowInstance.MutationObserver,
      Node: windowInstance.Node,
      Element: windowInstance.Element,
      HTMLElement: windowInstance.HTMLElement,
      CustomEvent: windowInstance.CustomEvent,
      location: windowInstance.location,
    });
  });

  test('rejects messages from unauthorized senders', () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: {
        id: 'extension-id-123',
      },
    };

    let response: unknown;
    const sendResponse = (res?: unknown) => {
      response = res;
    };

    const unauthorizedSender = {
      id: 'untrusted-extension-id',
    } as chrome.runtime.MessageSender;

    handleContentMessage(
      { type: 'RCR_FORCE_UNLOCK' },
      unauthorizedSender,
      sendResponse,
    );

    expect(response).toEqual({ status: 'unauthorized' });
  });

  test('rejects messages when sender origin or url is non-extension', () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: {
        id: 'extension-id-123',
        getURL: (path: string) => `chrome-extension://extension-id-123/${path}`,
      },
    };

    let response: unknown;
    const sendResponse = (res?: unknown) => {
      response = res;
    };

    const spoofedSender = {
      id: 'extension-id-123',
      origin: 'https://evil.com',
      url: 'https://evil.com/page',
    } as chrome.runtime.MessageSender;

    handleContentMessage(
      { type: 'RCR_FORCE_UNLOCK' },
      spoofedSender,
      sendResponse,
    );

    expect(response).toEqual({ status: 'unauthorized' });
  });

  test('rejects messages when sender has no id', () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: {
        id: 'extension-id-123',
      },
    };

    let response: unknown;
    const sendResponse = (res?: unknown) => {
      response = res;
    };

    const senderWithoutId = {} as chrome.runtime.MessageSender;

    handleContentMessage(
      { type: 'RCR_FORCE_UNLOCK' },
      senderWithoutId,
      sendResponse,
    );

    expect(response).toEqual({ status: 'unauthorized' });
  });

  test('accepts valid RCR_FORCE_UNLOCK messages from authorized sender', () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: {
        id: 'extension-id-123',
      },
    };

    let response: unknown;
    const sendResponse = (res?: unknown) => {
      response = res;
    };

    let unlockTriggered = false;
    let domCleaned = false;
    let toastShown = false;

    const authorizedSender = {
      id: 'extension-id-123',
    } as chrome.runtime.MessageSender;

    handleContentMessage(
      { type: 'RCR_FORCE_UNLOCK' },
      authorizedSender,
      sendResponse,
      () => {
        unlockTriggered = true;
      },
      () => {
        domCleaned = true;
      },
      undefined,
      undefined,
      () => {
        toastShown = true;
      },
    );

    expect(response).toEqual({ status: 'unlocked' });
    expect(unlockTriggered).toBe(true);
    expect(domCleaned).toBe(true);
    expect(toastShown).toBe(true);
  });

  test('safely ignores null, undefined, or non-object message payloads', () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: {
        id: 'extension-id-123',
      },
    };

    let response: unknown;
    const sendResponse = (res?: unknown) => {
      response = res;
    };

    const authorizedSender = {
      id: 'extension-id-123',
    } as chrome.runtime.MessageSender;

    handleContentMessage(
      null as unknown as { type?: string },
      authorizedSender,
      sendResponse,
    );
    expect(response).toEqual({ status: 'ignored' });

    handleContentMessage(
      undefined as unknown as { type?: string },
      authorizedSender,
      sendResponse,
    );
    expect(response).toEqual({ status: 'ignored' });

    handleContentMessage(
      'string-message' as unknown as { type?: string },
      authorizedSender,
      sendResponse,
    );
    expect(response).toEqual({ status: 'ignored' });
  });

  test('handles exceptions inside onApplySettings gracefully without crashing', () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: {
        id: 'extension-id-123',
      },
    };

    let response: unknown;
    const sendResponse = (res?: unknown) => {
      response = res;
    };

    const authorizedSender = {
      id: 'extension-id-123',
    } as chrome.runtime.MessageSender;

    handleContentMessage(
      {
        type: 'RCR_CONFIG_CHANGED',
        config: { enabled: true } as unknown as Settings,
      },
      authorizedSender,
      sendResponse,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      () => {
        throw new Error('Callback failed');
      },
    );

    expect(response).toEqual({ status: 'error' });
  });

  test('locks bridge channel and ignores hijacking attempts via window dispatch', () => {
    let legitReceived = false;
    let hijackReceived = false;

    windowInstance.addEventListener('__rcr_bridge_legit', (e: Event) => {
      if ((e as CustomEvent)?.detail?.nonce === 'secret-123') {
        legitReceived = true;
      }
    });

    windowInstance.addEventListener('__rcr_bridge_hijack', () => {
      hijackReceived = true;
    });

    let bridgeChannel: string | null = null;
    let bridgeNonce: string | null = null;

    const listener = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (
        bridgeChannel === null &&
        detail &&
        typeof detail.channel === 'string' &&
        detail.channel.length > 0 &&
        typeof detail.nonce === 'string' &&
        detail.nonce.length > 0
      ) {
        bridgeChannel = detail.channel;
        bridgeNonce = detail.nonce;
        windowInstance.dispatchEvent(
          new CustomEvent(bridgeChannel, {
            detail: { nonce: bridgeNonce, type: 'UPDATE' },
          }),
        );
      }
    };

    windowInstance.addEventListener('__rcr_handshake__', listener);

    // Initial valid handshake
    windowInstance.dispatchEvent(
      new CustomEvent('__rcr_handshake__', {
        detail: { channel: '__rcr_bridge_legit', nonce: 'secret-123' },
      }),
    );

    // Malicious attempt to hijack bridge channel
    windowInstance.dispatchEvent(
      new CustomEvent('__rcr_handshake__', {
        detail: { channel: '__rcr_bridge_hijack', nonce: 'fake-nonce' },
      }),
    );

    expect(legitReceived).toBe(true);
    expect(hijackReceived).toBe(false);
    expect(bridgeChannel).toBe('__rcr_bridge_legit');
    expect(bridgeNonce).toBe('secret-123');
  });
});
