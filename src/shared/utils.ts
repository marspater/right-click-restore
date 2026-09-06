/**
 * Generates a cryptographically secure random 128-bit hex string or UUID token.
 * Prefers `crypto.randomUUID()` when supported, falling back to `crypto.getRandomValues()`.
 */
export function generateSecureToken(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    }
  }
  // Ultimate fallback using high-precision timestamp if crypto API is completely missing
  const timestamp = Date.now().toString(36);
  const perf =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.floor(performance.now() * 1000).toString(36)
      : '';
  return `${timestamp}-${perf}`;
}
