import { describe, expect, test } from 'bun:test';
import { getSecureRandomString } from './crypto';

describe('getSecureRandomString', () => {
  test('generates non-empty unique tokens using crypto.randomUUID when available', () => {
    const token1 = getSecureRandomString();
    const token2 = getSecureRandomString();

    expect(typeof token1).toBe('string');
    expect(token1.length).toBeGreaterThan(0);
    expect(token1).not.toBe(token2);
  });

  test('falls back to crypto.getRandomValues when crypto.randomUUID is not a function', () => {
    const originalUUID = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      const token = getSecureRandomString();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
      expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', {
        value: originalUUID,
        configurable: true,
        writable: true,
      });
    }
  });

  test('handles missing crypto object gracefully and generates distinct values', () => {
    const originalCrypto = globalThis.crypto;
    // @ts-expect-error test simulation of environment without crypto
    globalThis.crypto = undefined;

    try {
      const token1 = getSecureRandomString();
      const token2 = getSecureRandomString();
      expect(typeof token1).toBe('string');
      expect(token1.length).toBeGreaterThan(0);
      expect(token1).not.toBe(token2);
    } finally {
      globalThis.crypto = originalCrypto;
    }
  });
});
