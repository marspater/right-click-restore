import { describe, expect, it } from 'bun:test';
import { getSecureRandomString } from './crypto';

describe('getSecureRandomString', () => {
  it('should use crypto.randomUUID when available', () => {
    const result = getSecureRandomString();
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should fall back to crypto.getRandomValues when crypto.randomUUID is undefined', () => {
    const originalRandomUUID = crypto.randomUUID;
    // @ts-ignore
    crypto.randomUUID = undefined;

    try {
      const result = getSecureRandomString();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // 16 bytes converted to hex string is 32 characters long
      expect(result.length).toBe(32);
      expect(result).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      // @ts-ignore
      crypto.randomUUID = originalRandomUUID;
    }
  });

  it('should fall back to safe fallback when crypto API is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    // @ts-ignore
    globalThis.crypto = undefined;

    try {
      const result = getSecureRandomString();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('_fallback');
    } finally {
      // @ts-ignore
      globalThis.crypto = originalCrypto;
    }
  });
});
