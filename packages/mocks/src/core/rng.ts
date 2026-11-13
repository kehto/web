/**
 * core/rng.ts — Seeded pseudo-random source and deterministic identifiers.
 *
 * Mocks never read `Math.random`; every id, pick, and shuffle derives from a
 * seed so fixtures are stable across runs and snapshots.
 */

/**
 * Seeded random number generator (mulberry32).
 *
 * @example
 * ```ts
 * const rng = createSeededRng(42);
 * rng.int(10); // same value every run
 * ```
 */
export interface SeededRng {
  /** Next float in `[0, 1)`. */
  next(): number;
  /** Integer in `[0, max)`. */
  int(max: number): number;
  /** One element of `items`, or `undefined` when empty. */
  pick<T>(items: readonly T[]): T | undefined;
  /** Lowercase hex string of `length` characters. */
  hex(length: number): string;
  /** RFC 4122-shaped v4 UUID string. */
  uuid(): string;
}

/**
 * Create a mulberry32 generator from an integer seed.
 *
 * @param seed - Any integer; non-integers are truncated.
 * @returns A deterministic generator.
 * @example
 * ```ts
 * const rng = createSeededRng(1);
 * const first = rng.hex(64);
 * ```
 */
export function createSeededRng(seed: number): SeededRng {
  let state = Math.trunc(seed) >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hex = (length: number): string => {
    let out = '';
    while (out.length < length) out += Math.floor(next() * 16).toString(16);
    return out;
  };
  return {
    next,
    int: (max) => Math.floor(next() * Math.max(1, max)),
    pick: (items) => (items.length === 0 ? undefined : items[Math.floor(next() * items.length)]),
    hex,
    uuid: () => `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(next() * 4)).toString(16)}${hex(3)}-${hex(12)}`,
  };
}

/**
 * FNV-1a 32-bit hash of a string, for label-derived seeds.
 *
 * @param label - Any string.
 * @returns Unsigned 32-bit hash.
 * @example
 * ```ts
 * hashLabel('alice') === hashLabel('alice'); // true
 * ```
 */
export function hashLabel(label: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic lowercase hex derived from a label. Same label → same hex.
 *
 * @param label - Stable name such as `pubkey:alice` or `event:note-1`.
 * @param length - Character count. Default 64.
 * @returns Hex string.
 * @example
 * ```ts
 * const pubkey = mockHex('pubkey:alice'); // 64 hex chars
 * ```
 */
export function mockHex(label: string, length = 64): string {
  return createSeededRng(hashLabel(label)).hex(length);
}

/**
 * Deterministic 64-hex pubkey for a named mock account.
 *
 * @param name - Account name, e.g. `alice`.
 * @returns 64-character hex pubkey.
 * @example
 * ```ts
 * mockPubkey('alice').length === 64;
 * ```
 */
export function mockPubkey(name: string): string {
  return mockHex(`pubkey:${name}`);
}

/**
 * Deterministic 64-hex event id for a label.
 *
 * @param label - Stable label such as `note:alice:1`.
 * @returns 64-character hex id.
 * @example
 * ```ts
 * mockEventId('note:alice:1');
 * ```
 */
export function mockEventId(label: string): string {
  return mockHex(`event:${label}`);
}

/**
 * Deterministic 128-hex signature placeholder. Not cryptographically valid;
 * mocks never claim to verify signatures.
 *
 * @param label - Stable label.
 * @returns 128-character hex string.
 * @example
 * ```ts
 * mockSignature('note:alice:1').length === 128;
 * ```
 */
export function mockSignature(label: string): string {
  return mockHex(`sig:${label}`, 128);
}
