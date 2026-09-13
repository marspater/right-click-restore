/**
 * Generates a cryptographically secure random 128-bit hex string or UUID token.
 * Uses `crypto.randomUUID()` when supported, falling back to `crypto.getRandomValues()`.
 * Throws an error if cryptographic RNG is unavailable to prevent insecure predictable nonces.
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
  throw new Error(
    'Cryptographically secure random number generator is unavailable',
  );
}
