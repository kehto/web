/**
 * connect-store.ts — NUB-CONNECT grant registry keyed on (dTag, aggregateHash).
 *
 * Mirrors acl-store.ts pattern: module-level singleton, localStorage persistence,
 * composite-key Map. Grants are per-napplet-build: changing the aggregateHash
 * (a rebuild) invalidates prior grants (CONNECT-06) — the composite key makes
 * this structural, not policy-driven.
 *
 * Default policy is RESTRICTIVE (opposite of aclStore): unknown (dTag, hash, origin)
 * combinations return `false` from check() — napplets must be explicitly granted
 * origins via grant(). This is the NUB-CONNECT security invariant.
 *
 * @see packages/shell/src/types/internal-connect.ts for the wire types.
 * @see docs/policies/SHELL-CONNECT-POLICY.md (Plan 39-05) for the full policy.
 */

const STORAGE_KEY = 'napplet:connect';

interface InternalConnectEntry {
  key: string;
  dTag: string;
  aggregateHash: string;
  origins: string[]; // mutable internal; readonly-exposed externally
  grantedAt: number;
}

function connectKey(dTag: string, aggregateHash: string): string {
  return `${dTag}:${aggregateHash}`;
}

const store = new Map<string, InternalConnectEntry>();

/**
 * Public interface for the NUB-CONNECT grant store singleton.
 *
 * All methods are keyed on (dTag, aggregateHash). A rebuild with a new
 * aggregateHash is a distinct identity — CONNECT-06 hash-upgrade semantics
 * are structurally guaranteed: check(dTag, newHash, origin) returns false
 * because newHash has no entry in the store.
 */
export interface ConnectStore {
  /**
   * Check whether an origin has been granted for a specific (dTag, aggregateHash).
   *
   * Returns false for unknown (dTag, aggregateHash) pairs — RESTRICTIVE default.
   * Returns false for unknown origins even if the (dTag, hash) pair exists.
   *
   * @param dTag - The napplet's dTag identifier
   * @param aggregateHash - The napplet's build aggregate hash
   * @param origin - The origin to check (e.g., 'https://relay.example.com')
   * @returns true if origin is in the grant set; false otherwise
   */
  check(dTag: string, aggregateHash: string, origin: string): boolean;

  /**
   * Get all granted origins for a (dTag, aggregateHash) pair.
   *
   * Returns an empty array for unknown (dTag, aggregateHash) pairs.
   *
   * @param dTag - The napplet's dTag identifier
   * @param aggregateHash - The napplet's build aggregate hash
   * @returns Readonly array of granted origin strings; empty if not granted
   */
  getOrigins(dTag: string, aggregateHash: string): readonly string[];

  /**
   * Grant a set of origins to a (dTag, aggregateHash) pair.
   *
   * Deduplicates and sorts origins for idempotent CSP header output (Plan 39-03).
   * Replaces any existing grant for the same (dTag, aggregateHash) pair.
   * Persists to localStorage automatically.
   *
   * @param dTag - The napplet's dTag identifier
   * @param aggregateHash - The napplet's build aggregate hash
   * @param origins - Origins to grant (e.g., ['https://relay.example.com', 'wss://relay2.example.com'])
   */
  grant(dTag: string, aggregateHash: string, origins: readonly string[]): void;

  /**
   * Revoke all granted origins for a (dTag, aggregateHash) pair.
   *
   * After revocation, check() returns false and getOrigins() returns [].
   * Persists to localStorage automatically.
   *
   * @param dTag - The napplet's dTag identifier
   * @param aggregateHash - The napplet's build aggregate hash
   */
  revoke(dTag: string, aggregateHash: string): void;

  /**
   * Get all current grants across all (dTag, aggregateHash) pairs.
   *
   * Used by the Vite CSP plugin (Plan 39-03) to build the connect-src
   * header for each napplet on dev-server startup.
   *
   * @returns Readonly array of all grants
   */
  getAllGrants(): ReadonlyArray<{ dTag: string; aggregateHash: string; origins: readonly string[] }>;

  /**
   * Persist the current store state to localStorage under 'napplet:connect'.
   *
   * Tolerates unavailable localStorage (e.g., SSR, private browsing with
   * storage disabled). Called automatically by grant() and revoke().
   */
  persist(): void;

  /**
   * Load the store state from localStorage.
   *
   * Validates shape before populating; clears store on corrupt data.
   * Should be called once on shell startup before handling any napplet messages.
   */
  load(): void;

  /**
   * Clear all grants and remove the localStorage entry.
   *
   * Best-effort localStorage removal (tolerates unavailability).
   */
  clear(): void;
}

/**
 * NUB-CONNECT grant store singleton.
 *
 * Module-level instance — import and use directly. Persists under localStorage
 * key 'napplet:connect'. Call `connectStore.load()` on shell startup to restore
 * persisted grants from a previous session.
 *
 * @example
 * ```ts
 * import { connectStore } from '@kehto/shell';
 *
 * // On shell startup:
 * connectStore.load();
 *
 * // On consent approval:
 * connectStore.grant(dTag, aggregateHash, ['https://relay.example.com']);
 *
 * // In Vite CSP plugin (Plan 39-03):
 * const origins = connectStore.getOrigins(dTag, aggregateHash);
 * ```
 */
export const connectStore: ConnectStore = {
  check(dTag, aggregateHash, origin) {
    const entry = store.get(connectKey(dTag, aggregateHash));
    if (!entry) return false;
    return entry.origins.includes(origin);
  },

  getOrigins(dTag, aggregateHash) {
    const entry = store.get(connectKey(dTag, aggregateHash));
    return entry ? [...entry.origins] : [];
  },

  grant(dTag, aggregateHash, origins) {
    const key = connectKey(dTag, aggregateHash);
    // Deduplicate and sort deterministically so CSP header output (Plan 39-03)
    // is idempotent across grant() calls with the same origin set.
    const sorted = [...new Set(origins)].sort();
    store.set(key, { key, dTag, aggregateHash, origins: sorted, grantedAt: Date.now() });
    connectStore.persist();
  },

  revoke(dTag, aggregateHash) {
    store.delete(connectKey(dTag, aggregateHash));
    connectStore.persist();
  },

  getAllGrants() {
    return Array.from(store.values()).map((e) => ({
      dTag: e.dTag,
      aggregateHash: e.aggregateHash,
      origins: [...e.origins],
    }));
  },

  persist() {
    try {
      const entries = Array.from(store.entries()).map(([k, v]) => [k, {
        dTag: v.dTag,
        aggregateHash: v.aggregateHash,
        origins: v.origins,
        grantedAt: v.grantedAt,
      }]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch { /* localStorage unavailable */ }
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const entries = JSON.parse(raw) as Array<[string, { dTag: string; aggregateHash: string; origins: string[]; grantedAt: number }]>;
      store.clear();
      for (const [key, val] of entries) {
        if (!Array.isArray(val.origins)) continue;
        store.set(key, {
          key,
          dTag: val.dTag,
          aggregateHash: val.aggregateHash,
          origins: [...val.origins],
          grantedAt: val.grantedAt ?? 0,
        });
      }
    } catch {
      store.clear();
    }
  },

  clear() {
    store.clear();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
  },
};

/**
 * Compose the canonical `<dTag>:<aggregateHash>` composite key used by the
 * connect-store. Exported for consumers that need to key their own maps by
 * the same identity (e.g., Vite CSP plugin — Plan 39-03).
 *
 * @param dTag - The napplet's dTag identifier
 * @param aggregateHash - The napplet's build aggregate hash
 * @returns Composite key string in `<dTag>:<aggregateHash>` format
 *
 * @example
 * ```ts
 * const key = connectGrantKey('chat', 'abc123'); // 'chat:abc123'
 * ```
 */
export function connectGrantKey(dTag: string, aggregateHash: string): string {
  return `${dTag}:${aggregateHash}`;
}
