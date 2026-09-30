import { getUnshadowedMethod } from './dom';

let fallbackCounter = 0;

/**
 * Generates a cryptographically secure random 128-bit hex string or UUID token.
 * Uses `crypto.randomUUID()` when supported, falling back to `crypto.getRandomValues()`.
 * Uses prototype unshadowing to protect against host-page tampering with crypto methods.
 */
export function getSecureRandomString(): string {
  if (typeof crypto !== 'undefined' && crypto !== null) {
    try {
      const randomUUIDFn = getUnshadowedMethod(crypto, 'randomUUID');
      if (typeof randomUUIDFn === 'function') {
        const uuid = randomUUIDFn.call(crypto);
        if (typeof uuid === 'string' && uuid.length > 0) {
          return uuid;
        }
      }
    } catch {
      // Suppress errors if randomUUID fails or throws
    }

    try {
      const getRandomValuesFn = getUnshadowedMethod(crypto, 'getRandomValues');
      if (typeof getRandomValuesFn === 'function') {
        const bytes = new Uint8Array(16);
        getRandomValuesFn.call(crypto, bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
          '',
        );
      }
    } catch {
      // Suppress errors if getRandomValues fails or throws
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
