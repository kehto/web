/**
 * @kehto/acl — ACL state migration utility.
 *
 * Provides a pure function to migrate persisted ACL state from the old
 * 3-segment composite key format (pubkey:dTag:hash) to the new 2-segment
 * format (dTag:hash) introduced in NIP-5D v0.1.0.
 *
 * No I/O, no side effects. Pure function: takes AclState, returns AclState.
 */

import type { AclState, AclEntry } from './types.js';

/**
 * Migrate ACL state from old 3-segment key format to new 2-segment key format.
 *
 * Converts entries stored under 'pubkey:dTag:hash' keys to 'dTag:hash' keys.
 * If two old entries map to the same dTag:hash, merges them conservatively:
 * - caps: OR of both bitfields (never removes a granted capability)
 * - blocked: OR of both flags (blocks if either source was blocked)
 * - quota: MAX of both values (keeps the higher allocation)
 *
 * Idempotent: if no 3-segment keys are found, returns the original state
 * unchanged (same object reference).
 *
 * @param state - Current ACL state (may contain old-format entries)
 * @returns Migrated AclState with only 2-segment keys, or the original
 *          state unchanged if no migration was needed
 *
 * @example
 * ```ts
 * const oldState = deserialize(localStorage.getItem('napplet:acl') ?? '');
 * const newState = migrateAclState(oldState);
 * if (newState !== oldState) {
 *   // Migration occurred — persist the new format
 *   localStorage.setItem('napplet:acl', serialize(newState));
 * }
 * ```
 */
export function migrateAclState(state: AclState): AclState {
  const newEntries: Record<string, AclEntry> = {};
  let migrated = false;

  for (const [key, entry] of Object.entries(state.entries)) {
    const parts = key.split(':');
    if (parts.length === 3) {
      // Old format: pubkey:dTag:hash -> dTag:hash
      const newKey = `${parts[1]}:${parts[2]}`;
      const existing = newEntries[newKey];
      if (existing) {
        // Merge: union caps, preserve block, max quota
        newEntries[newKey] = {
          caps: existing.caps | entry.caps,
          blocked: existing.blocked || entry.blocked,
          quota: Math.max(existing.quota, entry.quota),
        };
      } else {
        newEntries[newKey] = entry;
      }
      migrated = true;
    } else {
      // Already new format or other key — preserve as-is
      newEntries[key] = entry;
    }
  }

  if (!migrated) return state; // No old entries found — return original unchanged

  return { defaultPolicy: state.defaultPolicy, entries: newEntries };
}
