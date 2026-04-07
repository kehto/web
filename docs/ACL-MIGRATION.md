# ACL Migration: @kehto/acl — RUNTIME-SPEC v2.0.0 to NIP-5D v0.1.0

**Date:** 2026-04-07
**Package:** @kehto/acl
**Scope:** Identity key schema, capability-to-NUB mapping, persisted data migration
**References:** [GAP-ANALYSIS.md section 5.1](./GAP-ANALYSIS.md#51-kehtoacl-boundary-contract)

---

## 1. Identity Key Schema Change

### Background

Under RUNTIME-SPEC v2.0.0, each napplet performed an AUTH handshake after loading. The shell derived an ephemeral HMAC keypair for the napplet during the IDENTITY exchange, producing a `pubkey` that uniquely identified the session. This `pubkey` was the first component of the ACL composite key.

NIP-5D v0.1.0 eliminates the AUTH handshake entirely. There is no IDENTITY message and no ephemeral keypair. Instead, the shell assigns identity directly from the NIP-5A manifest at iframe creation time: the `(dTag, aggregateHash)` pair is known before any message is sent. As a result, the `pubkey` component of the ACL key no longer exists — the canonical composite key under NIP-5D is `dTag:hash`.

### Side-by-Side Schema Comparison

| Aspect | Old (RUNTIME-SPEC v2.0.0) | New (NIP-5D v0.1.0) |
|--------|--------------------------|---------------------|
| Identity source | AUTH handshake keypair (IDENTITY message) | NIP-5A manifest assigned at iframe creation |
| Identity fields | `{ pubkey, dTag, hash }` | `{ dTag, hash }` (`pubkey` deprecated) |
| Composite key format | `pubkey:dTag:hash` | `dTag:hash` |
| `toKey()` template | `` `${pubkey}:${dTag}:${hash}` `` | `` `${dTag}:${hash}` `` |
| `AclState.entries` key | `"abc123:chat:ff00": {...}` | `"chat:ff00": {...}` |
| Example key | `"3a1b...c9:chat:e3b0c4...": {caps: 1, ...}` | `"chat:e3b0c4...": {caps: 1, ...}` |

### Affected Source Files

#### `packages/acl/src/types.ts` — `Identity` interface

Make `pubkey` optional and deprecated. All code paths that construct an `Identity` object will continue to compile, but `toKey()` will no longer read the field.

```typescript
// Before (RUNTIME-SPEC v2.0.0)
export interface Identity {
  readonly pubkey: string;   // AUTH keypair pubkey
  readonly dTag: string;
  readonly hash: string;
}
```

```typescript
// After (NIP-5D v0.1.0)
export interface Identity {
  /** @deprecated NIP-5D: AUTH keypair no longer exists. Pass '' or omit entirely.
   *  Kept as optional for backward compatibility during data migration. */
  readonly pubkey?: string;
  readonly dTag: string;
  readonly hash: string;
}
```

Also update the `AclState.entries` JSDoc comment to reflect the new key format:

```typescript
// Before
// @param entries - Map from composite key ('pubkey:dTag:hash') to AclEntry

// After
// @param entries - Map from composite key ('dTag:hash') to AclEntry
```

#### `packages/acl/src/check.ts` — `toKey()` function

This is the single point of change for all ACL lookups. Every mutation and check function delegates to `toKey()`, so updating it here updates the entire module.

```typescript
// Before (RUNTIME-SPEC v2.0.0)
/**
 * Compute composite key from identity fields.
 * @returns Composite key string 'pubkey:dTag:hash'
 * @example
 * toKey({ pubkey: 'abc', dTag: 'chat', hash: 'ff00' })
 * // => 'abc:chat:ff00'
 */
export function toKey(identity: Identity): string {
  return `${identity.pubkey}:${identity.dTag}:${identity.hash}`;
}
```

```typescript
// After (NIP-5D v0.1.0)
/**
 * Compute composite key from identity fields.
 * @returns Composite key string 'dTag:hash'
 * @example
 * toKey({ dTag: 'chat', hash: 'ff00' })
 * // => 'chat:ff00'
 */
export function toKey(identity: Identity): string {
  return `${identity.dTag}:${identity.hash}`;
}
```

#### `packages/acl/src/mutations.ts` — mutation functions

No direct changes required. All mutation functions (`grant`, `revoke`, `block`, `unblock`, `setQuota`, `getQuota`) delegate to `toKey()` imported from `check.ts`. Once `toKey()` is updated, all mutations automatically use the new key format. The `serialize()` and `deserialize()` functions are also format-agnostic: they serialize the entries record as-is, regardless of key format.

### Migration Logic

The `toKey()` function is the **single point of change** for the entire key schema migration. This is by design: all ACL functions (`check`, `grant`, `revoke`, `block`, `unblock`, `setQuota`, `getQuota`) compute the composite key exactly once, by calling `toKey()`. Updating `toKey()` in `check.ts` propagates the new key format everywhere in `@kehto/acl`.

Key behavioral notes:

- **`check()`** is format-agnostic — it looks up whatever key `toKey()` returns. After migration, it looks up `dTag:hash`, so new ACL entries must be stored under the new format.
- **`serialize()` and `deserialize()`** are format-agnostic. They write/read the entries record without inspecting key strings. However, **deserialized old-format data will have orphaned entries** under old `pubkey:dTag:hash` keys that `check()` will never find. This is addressed in Section 3.
- **`Identity.pubkey` is kept as optional** for backward compatibility. Callers that still pass a `pubkey` value (e.g., legacy runtime paths, audit logging) will not get TypeScript errors. The field is simply ignored by `toKey()` after migration. This allows a phased rollout where the `@kehto/runtime` package can be updated to stop passing `pubkey` in a later step.

---

## 2. Capability Constant to NUB Domain Mapping

### Overview

The capability bit constants defined in `@kehto/acl` are **unchanged** by the NIP-5D migration — their names, integer values, and bitfield semantics are identical before and after. What changes is how the *runtime* maps incoming messages to these capabilities.

Under RUNTIME-SPEC v2.0.0, `packages/runtime/src/enforce.ts` mapped NIP-01 verb strings and BusKind event kinds to capabilities (e.g., verb `REQ` → `relay:read`, event kind `29001` → `sign:event`). Under NIP-5D v0.1.0, the same enforce gate maps NUB `type` strings to capabilities (e.g., `relay.subscribe` → `relay:read`). The `@kehto/acl` module itself is format-agnostic: it never sees the wire message, only the resolved capability string.

### Capability Constant to NUB Domain Mapping Table

| Capability Constant | Bit Value | Capability String | NUB Domain | NUB Operations | Old Trigger (enforce.ts) |
|---------------------|-----------|-------------------|------------|----------------|--------------------------|
| `CAP_RELAY_READ` | 1 | `relay:read` | `relay` | subscribe, query, close | verb=`REQ`, verb=`COUNT` |
| `CAP_RELAY_WRITE` | 2 | `relay:write` | `relay` | publish | verb=`EVENT` (standard kinds) |
| `CAP_CACHE_READ` | 4 | `cache:read` | (no NUB — internal) | N/A — cache is shell-internal | N/A (not triggered by napplet messages) |
| `CAP_CACHE_WRITE` | 8 | `cache:write` | (no NUB — internal) | N/A — cache is shell-internal | N/A |
| `CAP_HOTKEY_FORWARD` | 16 | `hotkey:forward` | `keyboard` (future) | forward | verb=`EVENT` kind=`HOTKEY_FORWARD` |
| `CAP_SIGN_EVENT` | 32 | `sign:event` | `signer` | signEvent, getPublicKey, getRelays | verb=`EVENT` kind=`29001` (SIGNER_REQUEST) |
| `CAP_SIGN_NIP04` | 64 | `sign:nip04` | `signer` | nip04.encrypt, nip04.decrypt | verb=`EVENT` kind=`29001` method=`nip04.*` |
| `CAP_SIGN_NIP44` | 128 | `sign:nip44` | `signer` | nip44.encrypt, nip44.decrypt | verb=`EVENT` kind=`29001` method=`nip44.*` |
| `CAP_STATE_READ` | 256 | `state:read` | `storage` | get, keys | verb=`EVENT` kind=`29003` topic=`shell:state-get/keys` |
| `CAP_STATE_WRITE` | 512 | `state:write` | `storage` | set, remove, clear | verb=`EVENT` kind=`29003` topic=`shell:state-set/remove/clear` |

Notes:
- `CAP_CACHE_READ` and `CAP_CACHE_WRITE` have no NUB equivalent — the NIP-5D spec does not expose a cache NUB. These bits are reserved in the bitfield and can be used for future shell-internal cache access control, but no napplet message type currently triggers them.
- `CAP_ALL` (1023, bits 0–9 set) and `CAP_NONE` (0) are convenience constants, not separate capabilities.

### NUB Domain Resolution (New)

Under NIP-5D, `enforce.ts` resolves capabilities by splitting the NUB message `type` field on `.` to get `[domain, action]`. The following pseudocode illustrates the new resolution logic:

```typescript
function resolveCapabilitiesNub(msg: NappletMessage): CapabilityResolution {
  const [domain, action] = msg.type.split('.');
  switch (domain) {
    case 'relay':
      return action === 'publish'
        ? { senderCap: 'relay:write', recipientCap: 'relay:read' }
        : { senderCap: 'relay:read', recipientCap: null };
    case 'signer':
      if (action?.startsWith('nip04')) return { senderCap: 'sign:nip04', recipientCap: null };
      if (action?.startsWith('nip44')) return { senderCap: 'sign:nip44', recipientCap: null };
      return { senderCap: 'sign:event', recipientCap: null };
    case 'storage':
      return (action === 'get' || action === 'keys')
        ? { senderCap: 'state:read', recipientCap: null }
        : { senderCap: 'state:write', recipientCap: null };
    case 'ifc':
      return action === 'emit'
        ? { senderCap: 'relay:write', recipientCap: 'relay:read' }
        : { senderCap: 'relay:read', recipientCap: null };
    case 'theme':
      return { senderCap: null, recipientCap: null }; // read-only, no user data
    default:
      return { senderCap: null, recipientCap: null }; // unknown domain — silently ignore
  }
}
```

This replaces the old `resolveCapabilities(msg: unknown[])` function in `packages/runtime/src/enforce.ts`, which switched on the NIP-01 verb string (`msg[0]`).

### Unchanged

The following elements of `@kehto/acl` are **not changed** by the NIP-5D migration:

- All 10 capability bit values and constant names (`CAP_RELAY_READ` through `CAP_STATE_WRITE`)
- `CAP_ALL` (1023) and `CAP_NONE` (0) constants
- The `check()` function signature and decision logic
- The `grant()`, `revoke()`, `block()`, `unblock()`, `setQuota()`, `getQuota()` function signatures and logic
- The `AclEntry` interface (`caps` bitfield, `blocked` flag, `quota` bytes)
- The `defaultPolicy` semantics (`'permissive'` grants all caps to unknown identities; `'restrictive'` denies all)
- The `serialize()` and `deserialize()` functions (format-agnostic)

### IFC Capability Note

The `ifc` NUB (inter-napplet communication) reuses `relay:write` for sending and `relay:read` for receiving rather than introducing new capability bits. This is intentional and matches the behavior of the old RUNTIME-SPEC: IPC_PEER messages (kind `29003`) that were not state operations required `relay:write` (sender) and `relay:read` (recipient).

**Rationale:** IFC traffic is inter-napplet relay traffic routed through the shell's internal bus. From an access-control perspective, it is semantically equivalent to relay publish/subscribe: one napplet emits an event that another napplet subscribes to. Granting a napplet `relay:write` implicitly allows it to emit IFC messages; granting `relay:read` allows it to receive them. Introducing separate `ifc:write` / `ifc:read` bits would require changes to every existing ACL entry and would duplicate the semantics of `relay:write`/`relay:read` without adding additional security granularity.

If future requirements demand IFC-specific access control (e.g., allow relay publish but deny IFC), new capability bits should be introduced at that time. For the NIP-5D v0.1.0 migration, the `relay:write`/`relay:read` reuse is the correct approach.

<!-- Section 3: Persisted ACL Data Migration (added by Task 2) -->
