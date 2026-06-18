# @kehto/acl

Pure, WASM-ready ACL module for the napplet protocol — zero dependencies, zero side effects.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. NAP contracts and capability names are not final; treat this package
> as current implementation guidance, not as a stable protocol guarantee.

## Install

```bash
pnpm add @kehto/acl
```

## Overview

`@kehto/acl` is Kehto's access-control core. It owns an immutable `AclState` keyed on the current NIP-5D 2-segment identity `(dTag, hash)` shape (the earlier `(pubkey, dTag, hash)` triple is dropped; `migrateAclState` ships for legacy persistence readers).

Every function is pure: state in, state out. No I/O, no timers, no globals — the module is trivially compilable to WASM and is the single source of truth for capability decisions.

The module exposes two parallel capability surfaces:

- **Bitfield constants** (`CAP_RELAY_READ`, `CAP_RELAY_WRITE`, `CAP_STATE_READ`, `CAP_STATE_WRITE`, …) — the compact per-entry representation used inside `AclState.entries[*].caps`.
- **Current draft NIP-5D capability strings** (`CAP_IDENTITY_READ`, `CAP_KEYS_BIND`, `CAP_KEYS_FORWARD`, `CAP_MEDIA_CONTROL`, `CAP_NOTIFY_SEND`, `CAP_NOTIFY_CHANNEL`, `CAP_THEME_READ`) — plus the retained `relay:*`, `cache:*`, `hotkey:forward`, and `state:*` literals. These strings are what `resolveCapabilitiesNap()` returns and what `@kehto/runtime`'s enforce gate grants/revokes against. The earlier `sign:event`/`sign:nip04`/`sign:nip44` entries were intentionally removed — the current NIP-5D draft does not expose napplet-visible signing.

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

// 2. Grant the two current draft capabilities this napplet needs.
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
- `CapabilityResolution` — `{ senderCap, recipientCap }` returned by `resolveCapabilitiesNap`
- `NapMessage` — minimal shape consumed by `resolveCapabilitiesNap` (`{ type: string }`)

### Constants — bit flags
- `CAP_RELAY_READ`, `CAP_RELAY_WRITE`, `CAP_CACHE_READ`, `CAP_CACHE_WRITE`
- `CAP_HOTKEY_FORWARD`, `CAP_SIGN_EVENT`, `CAP_SIGN_NIP04`, `CAP_SIGN_NIP44`
- `CAP_STATE_READ`, `CAP_STATE_WRITE`, `CAP_ALL`, `CAP_NONE`
- `DEFAULT_QUOTA`

### Constants — current draft NIP-5D capability strings
- `ALL_CAPABILITIES` — readonly tuple of every recognized capability string
- `CAP_IDENTITY_READ`, `CAP_KEYS_BIND`, `CAP_KEYS_FORWARD`
- `CAP_MEDIA_CONTROL`, `CAP_NOTIFY_SEND`, `CAP_NOTIFY_CHANNEL`, `CAP_THEME_READ`

### State mutations
- `createState` — create an empty AclState
- `grant`, `revoke` — add/remove capability bits
- `block`, `unblock` — toggle the block flag
- `setQuota`, `getQuota` — per-identity state storage quota
- `serialize`, `deserialize` — JSON round-trip for persistence

### Capability resolution
- `check` — evaluate identity + capability against state
- `toKey` — compute the `dTag:hash` composite key
- `resolveCapabilitiesNap` — map a NIP-5D NAP envelope type to the required sender/recipient capabilities across the current supported domains

### Migration
- `migrateAclState` — one-shot migration from the legacy 3-segment `pubkey:dTag:hash` keys to the v1.2 2-segment `dTag:hash` keys; idempotent (returns the same reference when nothing to migrate)

## API Reference

Full package docs: [`docs/packages/acl.md`](../../docs/packages/acl.md).
Generated API module: `docs/api/modules/_kehto_acl.html` (run `pnpm docs:api`).

## License

MIT
