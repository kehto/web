# @kehto/runtime

Browser-agnostic protocol engine for the napplet protocol.

> **Alpha status:** Kehto is an early runtime toolkit for a draft NIP-5D
> protocol. NAP contracts and runtime APIs are not final; treat this package as
> current implementation guidance, not as a stable protocol guarantee.

## Install

```bash
pnpm add @kehto/runtime
```

## Published Napplet Compatibility

`@kehto/runtime` publishes against `@napplet/core` and `@napplet/nap`
`>=0.31.0 <0.32.0`. The exact installed convention contracts are core 0.31.1 /
nap 0.31.2 from NAP-INTENT authority `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`,
napplet/web#199 source `3037200c932488f14f7f369b8583c39c9c16510a` / merge
`b3f0007867eac109fa4917fac9c285d3b7cc6155`, and Version Packages #198 release
source `dc1d24153c759152b6ba31a6ec9bea967798f2df`.

## Overview

`@kehto/runtime` is Kehto's NIP-5D protocol engine. It owns every incoming napplet message, gates it through the ACL enforcement layer, routes it to the correct NAP handler, and emits the corresponding reply envelope.

The runtime is built around the current draft dispatch contract from `@napplet/core` — `createDispatch()` + `registerNap()` — so routing is declarative, not a hand-rolled switch. It covers the NIP-5D domains currently supported by Kehto:

- **identity** — `identity.getProfile`, `identity.getFollows`, `identity.getPublicKey`, …
- **inc** — `inc.channel.*`, `inc.emit`, cross-napplet pub/sub
- **keys** — `keys.forward`, `keys.action`, `keys.bind`
- **media** — `media.*` playback & transport control
- **notify** — `notify.send`, `notify.channel.register`, badge/permission flows
- **relay** — `relay.publish`, `relay.publishEncrypted`, `relay.subscribe`
- **dm** — `dm.status`, `dm.conversations`, `dm.messages`, `dm.send`, runtime service dispatch
- **fs** — `fs.info`, pickers, metadata, byte I/O, mutations, watches, runtime service dispatch
- **storage** — `storage.get/set/remove/keys` with quota enforcement
- **theme** — `theme.get` and automatic recipient-authorized `theme.changed`

Signing is shell-mediated inside `relay.publish` / `relay.publishEncrypted` (NIP-44 default, NIP-04 opt-in). The legacy signer domain is dissolved — napplets never see a host-injected nostr object and cannot call signer-sign RPCs directly.

### NAP-RELAY publish boundary

The publish path follows draft [NAP-RELAY PR #2 at
`0be8abce18beb46ca37bd4ddd042f58d30b4eedc`](https://github.com/napplet/naps/pull/2).
A napplet submits an `EventTemplate`; the runtime obtains the active
shell-owned signer, signs once, and gives only the resulting `NostrEvent` to
the relay backend. Success returns exactly one correlated
`relay.publish.result` with `ok: true`, the full signed `event`, and `eventId`.
Signing, replay, relay, and service failures return `ok: false` plus `error`
and are never buffered as successful local publications.

`AuthAdapter.getSigner(windowId?)` receives the originating runtime window when
one exists. Kehto forwards that context as a policy mechanism; it does not
decide whether a host prompts once, remembers a narrowly scoped approval, or
refuses the request. Hosts that do not need caller-aware signer policy can
ignore the optional argument.

The released `@napplet/nap@0.31.2` SDK accepts `EventTemplate`, while its
`RelayPublishMessage.event` declaration still says `NostrEvent`; Kehto records
that mismatch as upstream package drift and follows the NAP wire direction.

## Identity and theme result policy

This runtime follows NAP-IDENTITY and NAP-THEME at `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.

- `identity.getPublicKey` always yields exactly one correlated
  `identity.getPublicKey.result`; no signer or a signer failure is
  `pubkey: ""`. Other supported readonly identity operations yield their
  matching result shapes with safe defaults, while unsupported identity actions
  are silently ignored.
- `theme.get` uses a complete three-color result. For denied or unavailable
  reads, Kehto's explicit policy is one fixed non-sensitive normal result with
  no `error` field. This reconciles the draft's error-only example without
  emitting `theme.*.error` or inventing a mixed theme/error payload.
- The runtime neither accepts nor creates identity/theme subscription messages.
  Change delivery is host-owned and recipient-gated by the shell bridge; it is
  not routed through NAP-INC or NAP-INTENT.

Phase 105 adopts the published `@napplet/*` convention package line; archived
phase records remain history rather than active compatibility guidance.

## NAP-INTENT runtime boundary

Kehto implements merged [NAP-INTENT at
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`](https://github.com/napplet/naps/blob/5ac0490461ca6fec2f0d2e45b4835cf9bc08de24/naps/NAP-INTENT.md).
The runtime accepts only source-side `intent.invoke`, `intent.available`, and
`intent.handlers` requests. It validates the exact queryless
`napplet:<archetype>/<action>` identity, derives the sender dTag from the live
authenticated session, and shapes policy denials as sanctioned result
envelopes without exposing ACL or firewall details.

Registered services receive a frozen `ServiceRuntimeContext`: current dTag
resolution, a frozen live-window snapshot, and recipient-policy-aware sends.
An `intent.invoke.result` with `ok: true` means a host controller selected and
readied the verified target and dispatched its convention. The final result
includes `handled`, `handler`, `windowId`, and `convention`. The target receives
one runtime-attested `inc.event` carrying that queryless convention and opaque
payload; `intent.deliver` is not part of the merged contract.

The canonical public `Intent*` contracts are the released `@napplet/core` /
`@napplet/nap` declarations; Kehto retains no local type mirror.

Phase 105 completed released package adoption and persistent installed-manifest
controllers for the live Paja and playground hosts.

## NAP-INC Contract

The active INC boundary follows merged
[`naps/NAP-INC.md`](https://github.com/napplet/naps/blob/5ac0490461ca6fec2f0d2e45b4835cf9bc08de24/naps/NAP-INC.md)
on `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. The document remains marked
draft, but the merged path is the protocol authority.

The released projection binding converts a convention query to a text payload
map before sending `inc.emit`. Runtime `inc-handler` routing then uses an exact
stable convention topic identity, with no query-bearing normalized
wire/discovery identity, prefix/wildcard/query-aware matching, generic or
service-over-INC prefix dispatch, or runtime payload-kind inference. Arbitrary
opaque topic strings, including `?` and `#`, are routed by their complete exact
text. The runtime derives the
**runtime-attested dTag** from the registered source; callers never supply a
sender, topic delivery excludes its source, and IDs/payloads are opaque.

Channels apply **open-time authorization** only: ACL and target liveness are
checked at `inc.channel.open`, never per later message. The target receives
`inc.channel.opened` before the opener result and both sides get symmetric
handles with `onOpened`, `on`, and `onClosed`; early events and terminal closure
are retained in order, bounded overflow closes the channel, and close or endpoint
destruction tears it down deterministically. `channel.list` is informational
only. Track draft follow-up through
[`kehto/web#203`](https://github.com/kehto/web/issues/203) and [its upstream
resolution reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495),
not the obsolete opener-only model.

This is INC documentation only. **Phase 104** owns every public #91 NAP-INTENT
binding/resolution/delivery change; **Phase 105** records the completed released
package adoption. Historical changelogs and archived planning are preserved
records, not targets for active-surface edits.

Everything plugs into a single factory, `createRuntime()`, via a `RuntimeAdapter` hook bag — persistence, relay pool, auth, services, and so on. No DOM, no postMessage, no localStorage: those live in `@kehto/shell`.

`RelayPoolAdapter.publish()` may return a promise. The runtime waits for that
promise before reporting publish success, buffers only successful publishes,
and releases failed replay reservations so a deterministic signed event can be
retried without allowing concurrent duplicate publication.
`publishToScopedRelay()` may similarly return `Promise<boolean>` when a host
needs transport settlement before reporting the scoped publication outcome.

## Quick Start

```ts
import { createRuntime } from '@kehto/runtime';

const runtime = createRuntime({
  aclPersistence: aclStore,
  manifestPersistence: manifestStore,
  relayPool: myRelayPoolAdapter,
  auth: myAuthAdapter,
  // ... further adapter hooks
});

// Incoming NIP-5D draft envelope from a napplet:
runtime.handleMessage('window-1', {
  type: 'relay.publish',
  id: 'evt-42',
  event: { kind: 1, content: 'hello', /* ... */ },
});
```

## Public API

### Runtime factory
- `createRuntime` — primary entry point; `Runtime` interface type

### Enforcement gate
- `createEnforceGate` — legacy pubkey-keyed ACL gate
- `createNapEnforceGate` — NIP-5D windowId-keyed ACL gate
- `resolveCapabilitiesNap` — map a NIP-5D envelope to required capabilities (re-exported from `@kehto/acl`)
- `formatDenialReason` — `denied: <capability>` canonical string

### Session registry
- `createSessionRegistry` — bidirectional windowId ↔ `SessionEntry` store
- `createNappKeyRegistry` — deprecated alias retained for v1.1 migration consumers

### ACL state container
- `createAclState` — persistence-backed wrapper around `@kehto/acl` state

### Manifest cache
- `createManifestCache` — NIP-5A aggregate-hash cache with persistence hooks

### Replay detection
- `createReplayDetector` — duplicate-event + timestamp-window guard

### Event buffer
- `createEventBuffer` — ring buffer with subscription delivery
- `matchesFilter`, `matchesAnyFilter` — pure NIP-01 filter helpers
- `RING_BUFFER_SIZE` — default ring buffer capacity constant

### State handler
- `handleStorageNap` — canonical `storage.*` NIP-5D handler
- `cleanupNappState` — remove persisted state when a napplet window closes

### Service dispatch
- `routeServiceMessage` — domain-prefix router into the service registry
- `notifyServiceWindowDestroyed` — lifecycle fan-out to every service handler
- Service-only NAP domains, including `dm` and `fs`, route through handlers registered with `runtime.registerService('<domain>', handler)`.

### Types
40+ interfaces — including `Runtime`, `RuntimeAdapter`, `SendToNapplet`, `RelayPoolAdapter`, `ServiceHandler`, `ServiceRegistry`, `NappletMessage`, `SessionEntry`, `AclEntryExternal`, `AclCheckEvent`, and the per-adapter hook types — are exported from `./types.js` for host-app integration.

### Compat re-exports (DRIFT-CORE-06)

Retained for migration consumers; new integrations should use current NIP-5D envelope types from `@napplet/core`. Slated for removal once upstream restores those exports.

Re-exported constants cover the v1.1 bus-kind enum, auth event kind, shell bridge URI, protocol version string, the full capability list, destructive-kind set, and the replay window seconds. Re-exported types cover the v1.1 capability union, bus-kind numeric union, and service descriptor shape. See the typedoc API reference below for the exact identifier list and current numeric values.

## API Reference

Full package docs: [`docs/packages/runtime.md`](../../docs/packages/runtime.md).
Generated API module: `docs/api/modules/_kehto_runtime.html` (run `pnpm docs:api`).

## License

MIT
