/**
 * domains/storage.ts — Mock NAP-STORAGE persistence adapter.
 *
 * Spec: naps/NAP-STORAGE.md @ napplet/naps PR #3 head 4f4cf0ca (draft)
 * Routes: none owned here — the runtime serves `storage.get`, `storage.set`,
 *   `storage.remove`, and `storage.keys` itself through
 *   `RuntimeAdapter.statePersistence` (`handleStorageNap` in
 *   `packages/runtime/src/state-handler.ts`). This module supplies that
 *   adapter as an in-memory `StatePersistence`.
 * Spec gaps / decisions:
 *   - Identity scoping, `scope: "instance"` namespacing, and the per-napplet
 *     quota are runtime concerns; the adapter only stores pre-scoped keys
 *     (`napplet-state:<dTag>:<hash>:[@i/<windowId>:]<key>`).
 *   - `calculateBytes(prefix, excludeKey)` mirrors the shell's localStorage
 *     adapter: UTF-8 bytes of `key + value`, skipping only an exact full-key
 *     match on `excludeKey`.
 *   - `set` always succeeds (returns `true`); quota rejections come from the
 *     runtime before `set` is reached.
 */
import type { StatePersistence } from '@kehto/runtime';
import type { MockDomainEntry, NapSpecRef } from '../core/types.js';

/** Spec document read when this adapter was written. */
export const STORAGE_SPEC_REF: NapSpecRef = {
  nap: 'NAP-STORAGE',
  status: 'draft',
  source: 'pr',
  pr: 3,
  sha: '4f4cf0ca',
  path: 'naps/NAP-STORAGE.md',
};

/**
 * Options for `createMockStatePersistence`.
 *
 * @example
 * ```ts
 * const options: MockStatePersistenceOptions = {
 *   seed: { 'napplet-state:feed:abc:theme': 'dark' },
 * };
 * ```
 */
export interface MockStatePersistenceOptions {
  /**
   * Initial entries keyed by the runtime's pre-scoped key
   * (`napplet-state:<dTag>:<aggregateHash>:<userKey>`). Restored by `reset()`.
   */
  seed?: Readonly<Record<string, string>>;
}

/**
 * Inspection controls attached to the mock persistence as `mock`.
 *
 * @example
 * ```ts
 * const persistence = createMockStatePersistence();
 * persistence.set('napplet-state:feed:abc:draft', 'hello');
 * persistence.mock.state().get('napplet-state:feed:abc:draft'); // 'hello'
 * persistence.mock.reset();
 * ```
 */
export interface MockStatePersistenceControls {
  /** Live backing map of scoped key → value (treat as read-only). */
  state(): Map<string, string>;
  /** Drop every entry and restore the seed. */
  reset(): void;
}

/**
 * An in-memory `StatePersistence` with `mock` controls.
 *
 * @example
 * ```ts
 * const persistence: MockStatePersistence = createMockStatePersistence();
 * createShellBridge({ ...hooks, statePersistence: persistence });
 * ```
 */
export type MockStatePersistence = StatePersistence & { readonly mock: MockStatePersistenceControls };

/**
 * UTF-8 byte length of a string without `TextEncoder`.
 *
 * @param text - Any string.
 * @returns Byte count.
 * @example
 * ```ts
 * utf8ByteLength('é') === 2;
 * ```
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0xd800 || code >= 0xe000) bytes += 3;
    else { index += 1; bytes += 4; }
  }
  return bytes;
}

/**
 * Create an in-memory NAP-STORAGE persistence adapter.
 *
 * Pass it as `statePersistence` in the shell adapter (or `RuntimeAdapter`);
 * the runtime routes every `storage.*` request to it with identity-scoped
 * keys and enforces the quota itself.
 *
 * @param options - Optional seed entries.
 * @returns A `StatePersistence` with `mock.state()` and `mock.reset()`.
 * @example
 * ```ts
 * const persistence = createMockStatePersistence({
 *   seed: { 'napplet-state:feed:abc:theme': 'dark' },
 * });
 * persistence.keys('napplet-state:feed:abc:'); // ['napplet-state:feed:abc:theme']
 * ```
 */
export function createMockStatePersistence(options: MockStatePersistenceOptions = {}): MockStatePersistence {
  const seed = Object.entries(options.seed ?? {});
  const store = new Map<string, string>(seed);
  return {
    get: (scopedKey) => store.get(scopedKey) ?? null,
    set: (scopedKey, value) => { store.set(scopedKey, value); return true; },
    remove: (scopedKey) => { store.delete(scopedKey); },
    clear: (prefix) => {
      for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
    },
    keys: (prefix) => [...store.keys()].filter((key) => key.startsWith(prefix)),
    calculateBytes: (prefix, excludeKey) => {
      let total = 0;
      for (const [key, value] of store) {
        if (!key.startsWith(prefix) || (excludeKey !== undefined && key === excludeKey)) continue;
        total += utf8ByteLength(key + value);
      }
      return total;
    },
    mock: {
      state: () => store,
      reset: () => {
        store.clear();
        for (const [key, value] of seed) store.set(key, value);
      },
    },
  };
}

/** Registry row: the runtime owns the wire routes; the mock supplies the adapter. */
export const STORAGE_MOCK_ENTRY: MockDomainEntry = {
  domain: 'storage',
  kind: 'adapter',
  spec: STORAGE_SPEC_REF,
  note: 'Runtime-served domain. Pass createMockStatePersistence() as `statePersistence` in the shell adapter; '
    + 'the runtime handles storage.get/set/remove/keys, identity scoping, instance scope, and quota.',
};
