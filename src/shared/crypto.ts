import { getUnshadowedMethod } from './dom';

let fallbackCounter = 0;

// Snapshot native crypto functions at module evaluation time before untrusted page scripts execute
const nativeCrypto =
  typeof crypto !== 'undefined' && crypto !== null ? crypto : null;
const nativeRandomUUID = nativeCrypto
  ? (getUnshadowedMethod(nativeCrypto, 'randomUUID') as (() => string) | null)
  : null;
const nativeGetRandomValues = nativeCrypto
  ? (getUnshadowedMethod(nativeCrypto, 'getRandomValues') as
      | (<T extends ArrayBufferView | null>(array: T) => T)
      | null)
  : null;

/**
 * Generates a cryptographically secure random 128-bit hex string or UUID token.
 * Uses `crypto.randomUUID()` when supported, falling back to `crypto.getRandomValues()`.
 * Uses prototype unshadowing and early snapshots to protect against host-page tampering with crypto methods.
 * Fails closed if crypto is present in the runtime but unusable, rather than falling back to guessable tokens.
 */
export function getSecureRandomString(): string {
  const currentCrypto =
    typeof crypto !== 'undefined' && crypto !== null ? crypto : null;

  if (currentCrypto) {
    // 1. Try randomUUID: first prefer snapshotted native function if crypto hasn't been re-bound;
    // otherwise retrieve unshadowed prototype method.
    const randomUUIDFn =
      currentCrypto === nativeCrypto && nativeRandomUUID
        ? nativeRandomUUID
        : (getUnshadowedMethod(currentCrypto, 'randomUUID') as
            | (() => string)
            | null);

    if (typeof randomUUIDFn === 'function') {
      try {
        const uuid = randomUUIDFn.call(currentCrypto);
        if (typeof uuid === 'string' && uuid.length > 0) {
          return uuid;
        }
      } catch {
        // Fall through to getRandomValues
      }
    }

    // 2. Try getRandomValues: first prefer snapshotted native function if crypto hasn't been re-bound;
    // otherwise retrieve unshadowed prototype method.
    const getRandomValuesFn =
      currentCrypto === nativeCrypto && nativeGetRandomValues
        ? nativeGetRandomValues
        : (getUnshadowedMethod(currentCrypto, 'getRandomValues') as
            | (<T extends ArrayBufferView | null>(array: T) => T)
            | null);

    if (typeof getRandomValuesFn === 'function') {
      try {
        const bytes = new Uint8Array(16);
        getRandomValuesFn.call(currentCrypto, bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
          '',
        );
      } catch {
        // Fall through to fail-closed error
      }
    }

    // Fail closed: In browser environments where crypto is defined, do NOT silently
    // downgrade to a predictable timestamp/counter fallback that host scripts can guess.
    throw new Error('Secure random source unavailable');
  }

  // High-precision monotonic counter fallback ONLY when crypto is completely absent (e.g., bare execution environments)
  fallbackCounter = (fallbackCounter + 1) % 0xffffffff;
  const timestamp = Date.now().toString(36);
  const perf =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? Math.floor(performance.now() * 1000).toString(36)
      : '';
  const seq = fallbackCounter.toString(36);
  return `${timestamp}-${perf}-${seq}`;
}
