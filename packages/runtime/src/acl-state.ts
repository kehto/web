/**
 * acl-state.ts — ACL state container with persistence hooks.
 *
 * Wraps @kehto/acl's pure functions with persistence via
 * AclPersistence. No localStorage or DOM references.
 */

import type { Capability } from '@kehto/acl/capabilities';
import type { AclState, Identity } from '@kehto/acl';
import {
  createState, check, grant, revoke, block, unblock,
  serialize, deserialize, getQuota,
  CAP_RELAY_READ, CAP_RELAY_WRITE, CAP_CACHE_READ, CAP_CACHE_WRITE,
  CAP_HOTKEY_FORWARD,
  CAP_STATE_READ, CAP_STATE_WRITE,
  toKey,
} from '@kehto/acl';
import type { AclPersistence, AclEntryExternal } from './types.js';

const CAP_IDENTITY_READ  = 1 << 5;    // 32  (reclaimed from CAP_SIGN_EVENT)
const CAP_KEYS_BIND      = 1 << 6;    // 64  (reclaimed from CAP_SIGN_NIP04)
const CAP_KEYS_FORWARD   = 1 << 7;    // 128 (reclaimed from CAP_SIGN_NIP44)
const CAP_MEDIA_CONTROL  = 1 << 10;   // 1024
const CAP_NOTIFY_SEND    = 1 << 11;   // 2048
const CAP_NOTIFY_CHANNEL = 1 << 12;   // 4096
const CAP_THEME_READ     = 1 << 13;   // 8192
const CAP_CONFIG_READ    = 1 << 14;   // 16384 (v1.7 Phase 39 NUB-CONFIG)
const CAP_RESOURCE_FETCH = 1 << 15;   // 32768 (v1.7 Phase 40 NUB-RESOURCE)
// 1 << 16 (65536) RETIRED — was identity:decrypt (v1.8); removed as a spec
// violation. Left as a permanent gap; do NOT reuse this bit (persisted ACL
// grants are bitfields — reassigning it would silently re-grant old state).
const CAP_CVM_CALL       = 1 << 17;   // 131072 (NAP-CVM ContextVM bridge)
const CAP_OUTBOX_READ    = 1 << 18;   // 262144 (NAP-OUTBOX read-side routing)
const CAP_OUTBOX_WRITE   = 1 << 19;   // 524288 (NAP-OUTBOX shell-signed publish)
const CAP_UPLOAD_WRITE   = 1 << 20;   // 1048576 (NAP-UPLOAD shell-mediated upload)

const CAP_MAP: Record<Capability, number> = {
  'relay:read': CAP_RELAY_READ,
  'relay:write': CAP_RELAY_WRITE,
  'cache:read': CAP_CACHE_READ,
  'cache:write': CAP_CACHE_WRITE,
  'hotkey:forward': CAP_HOTKEY_FORWARD,
  'state:read': CAP_STATE_READ,
  'state:write': CAP_STATE_WRITE,
  'identity:read': CAP_IDENTITY_READ,
  'keys:bind': CAP_KEYS_BIND,
  'keys:forward': CAP_KEYS_FORWARD,
  'media:control': CAP_MEDIA_CONTROL,
  'notify:send': CAP_NOTIFY_SEND,
  'notify:channel': CAP_NOTIFY_CHANNEL,
  'theme:read': CAP_THEME_READ,
  'config:read': CAP_CONFIG_READ,
  'resource:fetch': CAP_RESOURCE_FETCH,
  'cvm:call': CAP_CVM_CALL,
  'outbox:read': CAP_OUTBOX_READ,
  'outbox:write': CAP_OUTBOX_WRITE,
  'upload:write': CAP_UPLOAD_WRITE,
};

const RUNTIME_CAP_ALL = Object.values(CAP_MAP).reduce((bits, bit) => bits | bit, 0);

function capToBit(cap: Capability): number {
  return CAP_MAP[cap] ?? 0;
}

/** Convert a bitfield to an array of capability strings. */
function bitsToCapabilities(bits: number): Capability[] {
  const result: Capability[] = [];
  for (const [cap, bit] of Object.entries(CAP_MAP)) {
    if (bits & bit) result.push(cap as Capability);
  }
  return result;
}

function toIdentity(pubkey: string, dTag: string, hash: string): Identity {
  return { pubkey, dTag, hash };
}

/**
 * ACL state container — wraps @kehto/acl's pure functions with
 * persistence and a convenient imperative API.
 *
 * @example
 * ```ts
 * const aclState = createAclState(persistence);
 * aclState.load();
 * const allowed = aclState.check(pubkey, dTag, hash, 'relay:read');
 * ```
 */
export interface AclStateContainer {
  check(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): boolean;
  grant(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): void;
  revoke(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): void;
  block(pubkey: string, dTag: string, aggregateHash: string): void;
  unblock(pubkey: string, dTag: string, aggregateHash: string): void;
  isBlocked(pubkey: string, dTag: string, aggregateHash: string): boolean;
  getEntry(pubkey: string, dTag: string, aggregateHash: string): AclEntryExternal | undefined;
  getAllEntries(): AclEntryExternal[];
  getStateQuota(pubkey: string, dTag: string, aggregateHash: string): number;
  persist(): void;
  load(): void;
  clear(): void;
}

/**
 * Create an ACL state container backed by @kehto/acl and persisted
 * via the given persistence hooks.
 *
 * @param persistence - Storage backend for ACL state
 * @param defaultPolicy - Default ACL policy for unknown identities
 * @returns An AclStateContainer instance
 *
 * @example
 * ```ts
 * const aclState = createAclState(persistence, 'permissive');
 * aclState.load();
 * ```
 */
export function createAclState(
  persistence: AclPersistence,
  defaultPolicy: 'permissive' | 'restrictive' = 'permissive',
): AclStateContainer {
  let state: AclState = createState(defaultPolicy);

  function ensureRuntimeDefaultEntry(id: Identity): void {
    if (state.defaultPolicy !== 'permissive') return;
    if (state.entries[toKey(id)]) return;
    state = grant(state, id, RUNTIME_CAP_ALL);
  }

  return {
    check(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): boolean {
      const id = toIdentity(pubkey, dTag, aggregateHash);
      return check(state, id, capToBit(capability));
    },

    grant(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): void {
      const id = toIdentity(pubkey, dTag, aggregateHash);
      ensureRuntimeDefaultEntry(id);
      state = grant(state, id, capToBit(capability));
    },

    revoke(pubkey: string, dTag: string, aggregateHash: string, capability: Capability): void {
      const id = toIdentity(pubkey, dTag, aggregateHash);
      ensureRuntimeDefaultEntry(id);
      state = revoke(state, id, capToBit(capability));
    },

    block(pubkey: string, dTag: string, aggregateHash: string): void {
      const id = toIdentity(pubkey, dTag, aggregateHash);
      ensureRuntimeDefaultEntry(id);
      state = block(state, id);
    },

    unblock(pubkey: string, dTag: string, aggregateHash: string): void {
      const id = toIdentity(pubkey, dTag, aggregateHash);
      ensureRuntimeDefaultEntry(id);
      state = unblock(state, id);
    },

    isBlocked(pubkey: string, dTag: string, aggregateHash: string): boolean {
      const id = toIdentity(pubkey, dTag, aggregateHash);
      // A blocked identity fails all checks — check with all runtime caps.
      // If blocked, check returns false even for all caps
      return !check(state, id, RUNTIME_CAP_ALL) && this.getEntry(pubkey, dTag, aggregateHash)?.blocked === true;
    },

    getEntry(pubkey: string, dTag: string, aggregateHash: string): AclEntryExternal | undefined {
      const id = toIdentity(pubkey, dTag, aggregateHash);
      const key = `${id.dTag}:${id.hash}`;
      const entry = state.entries[key];
      if (!entry) return undefined;
      return {
        pubkey: pubkey || '',
        capabilities: bitsToCapabilities(entry.caps),
        blocked: entry.blocked,
        stateQuota: entry.quota,
      };
    },

    getAllEntries(): AclEntryExternal[] {
      return Object.entries(state.entries).map(([, entry]) => {
        return {
          pubkey: '',
          capabilities: bitsToCapabilities(entry.caps),
          blocked: entry.blocked,
          stateQuota: entry.quota,
        };
      });
    },

    getStateQuota(pubkey: string, dTag: string, aggregateHash: string): number {
      const id = toIdentity(pubkey, dTag, aggregateHash);
      return getQuota(state, id);
    },

    persist(): void {
      try {
        persistence.persist(serialize(state));
      } catch { /* persistence is best-effort */ }
    },

    load(): void {
      try {
        const raw = persistence.load();
        if (!raw) return;
        state = deserialize(raw);
      } catch {
        state = createState(defaultPolicy);
      }
    },

    clear(): void {
      state = createState(defaultPolicy);
      try { persistence.persist(''); } catch { /* best-effort */ }
    },
  };
}
