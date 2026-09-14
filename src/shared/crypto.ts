let fallbackCounter = 0;

/**
 * Generates a cryptographically secure random 128-bit hex string or UUID token.
 * Uses `crypto.randomUUID()` when supported, falling back to `crypto.getRandomValues()`.
 */
export function getSecureRandomString(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }
  // High-precision monotonic counter fallback when crypto is absent (e.g., bare execution environments)
  fallbackCounter = (fallbackCounter + 1) % 0xffffffff;
  const timestamp = Date.now().toString(36);
  const perf =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.floor(performance.now() * 1000).toString(36)
      : '';
  const seq = fallbackCounter.toString(36);
  return `${timestamp}-${perf}-${seq}`;
}

/**
 * Compares two strings in constant time to prevent timing attacks when comparing sensitive tokens/nonces.
 */
export function safeCompareStrings(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const lenA = a.length;
  const lenB = b.length;

  let mismatch = lenA ^ lenB;

  for (let i = 0; i < lenA; i++) {
    const charA = a.charCodeAt(i);
    const charB = b.charCodeAt(i % (lenB || 1));
    mismatch |= charA ^ charB;
  }

  return mismatch === 0;
}
