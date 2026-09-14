import { describe, expect, test } from 'bun:test';
import { getSecureRandomString, safeCompareStrings } from './crypto';

describe('safeCompareStrings', () => {
  test('returns true for matching strings', () => {
    expect(safeCompareStrings('abc123nonce', 'abc123nonce')).toBe(true);
    expect(safeCompareStrings('', '')).toBe(true);
  });

  test('returns false for mismatched strings of same length', () => {
    expect(safeCompareStrings('abc123nonce', 'abc123noncX')).toBe(false);
    expect(safeCompareStrings('Xbc123nonce', 'abc123nonce')).toBe(false);
  });

  test('returns false for mismatched strings of different lengths', () => {
    expect(safeCompareStrings('abc123nonce', 'abc123nonce123')).toBe(false);
    expect(safeCompareStrings('abc123nonce123', 'abc123nonce')).toBe(false);
    expect(safeCompareStrings('', 'a')).toBe(false);
  });

  test('returns false for non-string inputs safely', () => {
    expect(safeCompareStrings(null, 'abc')).toBe(false);
    expect(safeCompareStrings('abc', undefined)).toBe(false);
    expect(safeCompareStrings(123, 123)).toBe(false);
    expect(safeCompareStrings({}, {})).toBe(false);
  });
});

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
