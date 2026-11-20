/**
 * Generate a UUID v4 for a host identifier that must be unguessable.
 *
 * Uses native `crypto.randomUUID()` (called on its `Crypto` receiver) when the
 * browser exposes it. Browsers omit it outside secure contexts, including
 * non-localhost plain HTTP, so the fallback builds a UUID v4 from 16
 * `crypto.getRandomValues()` bytes. There is no weak-randomness fallback.
 *
 * @returns A lowercase RFC 9562 UUID v4 string.
 * @throws If neither `crypto.randomUUID` nor `crypto.getRandomValues` exists.
 * @example
 * ```ts
 * import { randomUUID } from '@kehto/shell';
 *
 * const windowId = `host:${randomUUID()}`;
 * ```
 */
export function randomUUID(): string {
  const provider = globalThis.crypto;
  if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
  if (typeof provider?.getRandomValues !== 'function') {
    throw new Error('@kehto/shell requires crypto.randomUUID or crypto.getRandomValues for UUID generation');
  }
  const bytes = provider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
