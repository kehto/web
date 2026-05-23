# @kehto/acl

Pure, WASM-ready ACL module for the napplet protocol — zero dependencies, zero side effects.

## Install

```bash
pnpm add @kehto/acl
```

## Overview

`@kehto/acl` is the authoritative access-control core for kehto. It owns an immutable `AclState` keyed on the NIP-5D 2-segment identity `(dTag, hash)` — the v1.2 canonical shape (the pre-v1.2 `(pubkey, dTag, hash)` triple is dropped; `migrateAclState` ships for legacy persistence readers).

Every function is pure: state in, state out. No I/O, no timers, no globals — the module is trivially compilable to WASM and is the single source of truth for capability decisions.

The module exposes two parallel capability surfaces:

- **Bitfield constants** (`CAP_RELAY_READ`, `CAP_RELAY_WRITE`, `CAP_STATE_READ`, `CAP_STATE_WRITE`, …) — the compact per-entry representation used inside `AclState.entries[*].caps`.
- **Canonical v1.2 NIP-5D 8-domain capability strings** (`CAP_IDENTITY_READ`, `CAP_KEYS_BIND`, `CAP_KEYS_FORWARD`, `CAP_MEDIA_CONTROL`, `CAP_NOTIFY_SEND`, `CAP_NOTIFY_CHANNEL`, `CAP_THEME_READ`) — plus the retained `relay:*`, `cache:*`, `hotkey:forward`, and `state:*` literals. These strings are what `resolveCapabilitiesNub()` returns and what `@kehto/runtime`'s enforce gate grants/revokes against. The v1.1 `sign:event`/`sign:nip04`/`sign:nip44` entries were intentionally removed — canonical NIP-5D does not expose napplet-visible signing.

## Quick Start

```ts
import {
  createState,
  grant,
  check,
  block,
  unblock,
  CAP_RELAY_WRITE,
  CAP_NOTIFY_SEND,
} from '@kehto/acl';

// 1. Start with a restrictive state — unknown identities are denied everything.
let state = createState('restrictive');

const id = { dTag: 'chat', hash: 'ff00aa11' };

// 2. Grant the two canonical v1.2 capabilities this napplet needs.
state = grant(state, id, CAP_RELAY_WRITE);
state = grant(state, id, CAP_NOTIFY_SEND);

check(state, id, CAP_RELAY_WRITE); // true
check(state, id, CAP_NOTIFY_SEND); // true

// 3. Block the identity — all checks fail until unblocked, caps are preserved.
state = block(state, id);
check(state, id, CAP_RELAY_WRITE); // false (blocked)

state = unblock(state, id);
check(state, id, CAP_RELAY_WRITE); // true (restored)
```

## Public API

### Types
- `AclState` — immutable ACL state container
- `AclEntry` — per-identity entry (`caps`, `blocked`, `quota`)
- `Identity` — `{ dTag, hash }` pair (NIP-5D 2-segment identity)
- `Capability` — union of every canonical capability string
- `CapabilityResolution` — `{ senderCap, recipientCap }` returned by `resolveCapabilitiesNub`
- `NubMessage` — minimal shape consumed by `resolveCapabilitiesNub` (`{ type: string }`)

### Constants — bit flags
- `CAP_RELAY_READ`, `CAP_RELAY_WRITE`, `CAP_CACHE_READ`, `CAP_CACHE_WRITE`
- `CAP_HOTKEY_FORWARD`, `CAP_SIGN_EVENT`, `CAP_SIGN_NIP04`, `CAP_SIGN_NIP44`
- `CAP_STATE_READ`, `CAP_STATE_WRITE`, `CAP_ALL`, `CAP_NONE`
- `DEFAULT_QUOTA`

### Constants — canonical NIP-5D capability strings (v1.2)
- `ALL_CAPABILITIES` — readonly tuple of every recognized capability string
- `CAP_IDENTITY_READ`, `CAP_KEYS_BIND`, `CAP_KEYS_FORWARD`
- `CAP_MEDIA_CONTROL`, `CAP_NOTIFY_SEND`, `CAP_NOTIFY_CHANNEL`, `CAP_THEME_READ`

### State mutations
- [`createState`](../../docs/api/functions/_kehto_acl..createState.html) — create an empty AclState
- [`grant`](../../docs/api/functions/_kehto_acl..grant.html), [`revoke`](../../docs/api/functions/_kehto_acl..revoke.html) — add/remove capability bits
- [`block`](../../docs/api/functions/_kehto_acl..block.html), [`unblock`](../../docs/api/functions/_kehto_acl..unblock.html) — toggle the block flag
- [`setQuota`](../../docs/api/functions/_kehto_acl..setQuota.html), [`getQuota`](../../docs/api/functions/_kehto_acl..getQuota.html) — per-identity state storage quota
- [`serialize`](../../docs/api/functions/_kehto_acl..serialize.html), [`deserialize`](../../docs/api/functions/_kehto_acl..deserialize.html) — JSON round-trip for persistence

### Capability resolution
- [`check`](../../docs/api/functions/_kehto_acl..check.html) — evaluate identity + capability against state
- [`toKey`](../../docs/api/functions/_kehto_acl..toKey.html) — compute the `dTag:hash` composite key
- [`resolveCapabilitiesNub`](../../docs/api/functions/_kehto_acl..resolveCapabilitiesNub.html) — map a NIP-5D NUB envelope type to the required sender/recipient capabilities across the 8 canonical domains

### Migration
- [`migrateAclState`](../../docs/api/functions/_kehto_acl..migrateAclState.html) — one-shot migration from the legacy 3-segment `pubkey:dTag:hash` keys to the v1.2 2-segment `dTag:hash` keys; idempotent (returns the same reference when nothing to migrate)

## API Reference

Full API reference: [docs/api/@kehto/acl/](../../docs/api/modules/_kehto_acl.html) (generated via `pnpm docs:api`).

## License

MIT
