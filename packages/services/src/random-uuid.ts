/**
 * Generate a UUID v4 for a host identifier that must be unguessable.
 *
 * Private twin of the `@kehto/shell` `randomUUID` export: services does not
 * depend on the shell, so the body is kept in sync by
 * `tests/unit/random-uuid-sync.test.ts` instead of a package edge. Prefers
 * native `crypto.randomUUID()`, falls back to 16 `crypto.getRandomValues()`
 * bytes where browsers omit it (non-localhost plain HTTP), and never falls
 * back to weak randomness.
 *
 * @returns A lowercase RFC 9562 UUID v4 string.
 * @throws If neither `crypto.randomUUID` nor `crypto.getRandomValues` exists.
 */
export function randomUUID(): string {
  const provider = globalThis.crypto;
  if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
  if (typeof provider?.getRandomValues !== 'function') {
    throw new Error('@kehto/services requires crypto.randomUUID or crypto.getRandomValues for UUID generation');
  }
  const bytes = provider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
