/**
 * ACL Store — composite-keyed capability registry for napplet identity.
 *
 * ACL entries are keyed by dTag:aggregateHash — a 2-segment composite key
 * that ties permissions to a specific napplet build (NIP-5D format).
 * Old 3-segment keys (pubkey:dTag:hash) are automatically migrated via migrateAclState().
 *
 * Default policy is PERMISSIVE: unknown identities have all capabilities granted.
 */

import type { Capability } from '@napplet/core';
import { ALL_CAPABILITIES, DESTRUCTIVE_KINDS } from '@napplet/core';
import { migrateAclState } from '@kehto/acl';
import type { AclState } from '@kehto/acl';
import type { AclEntry } from './types.js';

const STORAGE_KEY = 'napplet:acl';

/** Default state quota in bytes (512 KB) per napplet identity. */
export const DEFAULT_STATE_QUOTA = 512 * 1024;

interface InternalAclEntry {
  key: string;
  pubkey: string;
  dTag: string;
  aggregateHash: string;
  capabilities: Set<Capability>;
  blocked: boolean;
  stateQuota: number;
}

function aclKey(pubkey: string, dTag: string, aggregateHash: string): string {
  return `${pubkey}:${dTag}:${aggregateHash}`;
}

const store = new Map<string, InternalAclEntry>();

// Capability name to bit position mapping for bitfield conversion (matches @kehto/acl/types.ts)
const CAP_BITS: Record<string, number> = {
  'relay:read': 1, 'relay:write': 2, 'cache:read': 4, 'cache:write': 8,
  'hotkey:forward': 16, 'sign:event': 32, 'sign:nip04': 64, 'sign:nip44': 128,
  'state:read': 256, 'state:write': 512,
};

function capArrayToBitfield(caps: Capability[]): number {
  let bits = 0;
  for (const cap of caps) bits |= (CAP_BITS[cap] ?? 0);
  return bits;
}

function bitfieldToCapArray(bits: number): Capability[] {
  return (Object.entries(CAP_BITS)
    .filter(([, bit]) => (bits & bit) !== 0)
    .map(([name]) => name)) as Capability[];
}

function getOrCreate(pubkey: string, dTag: string, aggregateHash: string): InternalAclEntry {
  const key = aclKey(pubkey, dTag, aggregateHash);
  let entry = store.get(key);
  if (!entry) {
    entry = {
      key,
      pubkey,
      dTag,
      aggregateHash,
      capabilities: new Set(ALL_CAPABILITIES),
      blocked: false,
      stateQuota: DEFAULT_STATE_QUOTA,
    };
    store.set(key, entry);
  }
  return entry;
}

/**
 * ACL store — manages capability grants, revocations, and blocks for napp identities.
 * Persists to localStorage and uses a permissive default policy (all capabilities granted).
 *
 * @example
 * ```ts
 * import { aclStore } from '@kehto/shell';
 *
 * aclStore.grant(pubkey, dTag, hash, 'relay:read');
 * const allowed = aclStore.check(pubkey, dTag, hash, 'relay:read'); // true
 * ```
 */
export const aclStore = {
  /**
   * Check if a napp identity has a specific capability.
   * Returns true for unknown identities (permissive default).
   *
   * @param pubkey - The napp's pubkey
   * @param dTag - The napp's dTag
   * @param aggregateHash - The napp's build hash
   * @param capability - The capability to check
   * @returns True if the capability is granted and the napp is not blocked
   */
  check(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): boolean {
    const key = aclKey(pubkey, dTag, aggregateHash);
    const entry = store.get(key);
    if (!entry) return true;
    if (entry.blocked) return false;
    return entry.capabilities.has(capability);
  },

  /**
   * Grant a capability to a napp identity.
   *
   * @param pubkey - The napp's pubkey
   * @param dTag - The napp's dTag
   * @param aggregateHash - The napp's build hash
   * @param capability - The capability to grant
   */
  grant(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): void {
    getOrCreate(pubkey, dTag, aggregateHash).capabilities.add(capability);
  },

  /**
   * Revoke a capability from a napp identity.
   *
   * @param pubkey - The napp's pubkey
   * @param dTag - The napp's dTag
   * @param aggregateHash - The napp's build hash
   * @param capability - The capability to revoke
   */
  revoke(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): void {
    getOrCreate(pubkey, dTag, aggregateHash).capabilities.delete(capability);
  },

  /**
   * Block a napp identity entirely (all capabilities denied).
   *
   * @param pubkey - The napp's pubkey
   * @param dTag - The napp's dTag
   * @param aggregateHash - The napp's build hash
   */
  block(pubkey: string, dTag: string, aggregateHash: string): void {
    getOrCreate(pubkey, dTag, aggregateHash).blocked = true;
  },

  /**
   * Unblock a napp identity.
   *
   * @param pubkey - The napp's pubkey
   * @param dTag - The napp's dTag
   * @param aggregateHash - The napp's build hash
   */
  unblock(pubkey: string, dTag: string, aggregateHash: string): void {
    getOrCreate(pubkey, dTag, aggregateHash).blocked = false;
  },

  /**
   * Check if a napp identity is blocked.
   *
   * @param pubkey - The napp's pubkey
   * @param dTag - The napp's dTag
   * @param aggregateHash - The napp's build hash
   * @returns True if the identity is blocked
   */
  isBlocked(pubkey: string, dTag: string, aggregateHash: string): boolean {
    const key = aclKey(pubkey, dTag, aggregateHash);
    return store.get(key)?.blocked ?? false;
  },

  /**
   * Check if a signing kind requires user consent prompt.
   *
   * @param kind - The event kind to check
   * @returns True if the kind is destructive and requires consent
   */
  requiresPrompt(kind: number): boolean {
    return DESTRUCTIVE_KINDS.has(kind);
  },

  /**
   * Get the external ACL entry for a napp identity.
   *
   * @param pubkey - The napp's pubkey
   * @param dTag - The napp's dTag
   * @param aggregateHash - The napp's build hash
   * @returns The ACL entry, or undefined if no explicit entry exists
   */
  getEntry(pubkey: string, dTag: string, aggregateHash: string): AclEntry | undefined {
    const key = aclKey(pubkey, dTag, aggregateHash);
    const internal = store.get(key);
    if (!internal) return undefined;
    return {
      pubkey: internal.pubkey,
      capabilities: Array.from(internal.capabilities),
      blocked: internal.blocked,
      stateQuota: internal.stateQuota,
    };
  },

  /**
   * Get all ACL entries.
   *
   * @returns Array of all ACL entries
   */
  getAllEntries(): AclEntry[] {
    return Array.from(store.values()).map(e => ({
      pubkey: e.pubkey,
      capabilities: Array.from(e.capabilities),
      blocked: e.blocked,
      stateQuota: e.stateQuota,
    }));
  },

  /** Persist the ACL store to localStorage. */
  persist(): void {
    try {
      const entries = Array.from(store.entries()).map(([key, val]) => [
        key,
        {
          pubkey: val.pubkey,
          dTag: val.dTag,
          aggregateHash: val.aggregateHash,
          capabilities: Array.from(val.capabilities),
          blocked: val.blocked,
          stateQuota: val.stateQuota,
        },
      ]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // localStorage unavailable
    }
  },

  /** Load the ACL store from localStorage. Migrates old 3-segment keys to 2-segment format. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      let entries = JSON.parse(raw) as Array<
        [string, {
          pubkey: string;
          dTag?: string;
          aggregateHash?: string;
          capabilities: Capability[];
          blocked: boolean;
          stateQuota?: number;
        }]
      >;

      // Check for old 3-segment keys and migrate if needed
      const hasOldKeys = entries.some(([key]) => key.split(':').length === 3);
      if (hasOldKeys) {
        // Build temporary AclState for migration
        const tempState: AclState = {
          defaultPolicy: 'permissive',
          entries: Object.fromEntries(
            entries.map(([key, val]) => [key, {
              caps: capArrayToBitfield(val.capabilities),
              blocked: val.blocked,
              quota: val.stateQuota ?? DEFAULT_STATE_QUOTA,
            }])
          ),
        };
        const migrated = migrateAclState(tempState);
        if (migrated !== tempState) {
          // Rebuild entries from migrated state
          entries = Object.entries(migrated.entries).map(([key, entry]) => {
            const parts = key.split(':');
            return [key, {
              pubkey: '',
              dTag: parts[0] ?? '',
              aggregateHash: parts[1] ?? '',
              capabilities: bitfieldToCapArray(entry.caps),
              blocked: entry.blocked,
              stateQuota: entry.quota,
            }] as [string, typeof entries[0][1]];
          });
          // Re-persist migrated data immediately
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        }
      }

      store.clear();
      for (const [key, val] of entries) {
        if (val.dTag === undefined || val.aggregateHash === undefined) continue;
        store.set(key, {
          key,
          pubkey: val.pubkey,
          dTag: val.dTag,
          aggregateHash: val.aggregateHash,
          capabilities: new Set(val.capabilities),
          blocked: val.blocked,
          stateQuota: val.stateQuota ?? DEFAULT_STATE_QUOTA,
        });
      }
    } catch {
      /* Corrupted ACL data in localStorage — clear and use defaults */
      store.clear();
    }
  },

  /**
   * Get the state quota for a napp identity.
   *
   * @param pubkey - The napp's pubkey
   * @param dTag - The napp's dTag
   * @param aggregateHash - The napp's build hash
   * @returns The quota in bytes (defaults to DEFAULT_STATE_QUOTA)
   */
  getStateQuota(pubkey: string, dTag: string, aggregateHash: string): number {
    const key = aclKey(pubkey, dTag, aggregateHash);
    return store.get(key)?.stateQuota ?? DEFAULT_STATE_QUOTA;
  },

  /** Clear all ACL entries and remove from localStorage. */
  clear(): void {
    store.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage unavailable — ACL clear is best-effort */
    }
  },
};
