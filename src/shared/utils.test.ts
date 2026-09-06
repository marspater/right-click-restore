import { describe, expect, test } from 'bun:test';
import { generateSecureToken } from './utils';

describe('generateSecureToken', () => {
  test('generates non-empty unique tokens using crypto.randomUUID when available', () => {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();

    expect(typeof token1).toBe('string');
    expect(token1.length).toBeGreaterThan(0);
    expect(token1).not.toBe(token2);
  });

  test('falls back to crypto.getRandomValues when crypto.randomUUID is not a function', () => {
    const originalUUID = crypto.randomUUID;
    // Explicitly override randomUUID to undefined
    Object.defineProperty(crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      const token = generateSecureToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
      expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
    } finally {
      // Restore
      Object.defineProperty(crypto, 'randomUUID', {
        value: originalUUID,
        configurable: true,
        writable: true,
      });
    }
  });

  test('handles missing crypto object gracefully', () => {
    const originalCrypto = globalThis.crypto;
    // @ts-expect-error mutating globalThis for test
    globalThis.crypto = undefined;

    try {
      const token = generateSecureToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    } finally {
      globalThis.crypto = originalCrypto;
    }
  });
});
