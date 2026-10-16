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
`>=0.32.0 <0.33.0`. The exact installed convention contracts are core 0.32.0 /
nap 0.32.0 from NAP-INTENT authority `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`,
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

### NAP-RELAY subscription revocation

Revoking `relay:read` or blocking a principal immediately retires ordinary relay
subscriptions in every window with that exact `dTag` and aggregate hash. The
runtime closes registered relay/cache backends and direct adapter subscriptions,
sends `relay.closed` with reason `denied: relay:read`, and suppresses queued events
and EOSE callbacks. Regranting access requires a new subscription; old callbacks
remain invalid even if the same `subId` is reused. Other principals, other artifact
versions, and revocation of unrelated capabilities leave subscriptions active.

This host policy conforms to [NAP-RELAY draft PR #2 at
`9f30b3505335a52c574ff570576687d6467021ff`](https://github.com/napplet/naps/blob/9f30b3505335a52c574ff570576687d6467021ff/naps/NAP-RELAY.md),
which permits ACL enforcement and policy-driven subscription termination.

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

The released `@napplet/nap@0.32.0` SDK accepts `EventTemplate`, while its
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

Kehto follows [NAP-INTENT PR #106](https://github.com/napplet/naps/blob/fc121fc264615482143eda86125863d2e1f741a2/naps/NAP-INTENT.md) at `fc121fc264615482143eda86125863d2e1f741a2`. The runtime admits source-side `intent.invoke`,
`intent.available`, and `intent.handlers` through the authenticated session and
ACL/firewall boundary. Services validate the normalized queryless convention and
resolve the sender's opaque catalog ID from the trusted source window.

Registered services receive a frozen `ServiceRuntimeContext` with live-window
facts and recipient-policy-aware sends. Success acknowledges retained delivery
responsibility with `ok`, `archetype`, `action`, `convention`, and `handler`.
After current target readiness, the controller sends one `intent.deliver` with
parent-attested sender and opaque payload. Completion belongs to host observation,
not another source result. No INC carrier is required.

## NAP-OUTBOX denial boundary

Kehto follows draft [NAP-OUTBOX PR #32 at
`4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`](https://github.com/napplet/naps/pull/32).
ACL and firewall policy may reject an outbox query, but the rejection stays on
the protocol-defined correlated result wire: `outbox.query.result` with
`events: []` and `error`. The runtime does not synthesize an
`outbox.query.error` message.

The installed `@napplet/nap@0.32.0` contract trails PR #106. The bounded local
`@kehto/services` intent types and their removal condition are documented in
[conformance policy](https://github.com/kehto/web/blob/main/docs/policies/NIP-5D-CONFORMANCE.md).

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

`unregister(windowId)` retires the window's registration, lookup state, and pending
update, including NIP-5D sessions whose pubkey is empty. Repeated calls are safe.
If a newer window owns the same pubkey lookup, that newer entry is preserved;
use `getEntryByWindowId` to distinguish live windows sharing an empty pubkey.

`runtime.sessionRegistry.register(windowId, entry)` establishes a fresh trusted
source lifecycle and retires that window's previous initialization burst budget,
including when the host reuses the window ID, timestamp, or entry object. Ordinary
messages and `destroyWindow()` alone do not renew the budget. The shell registers
only on the first `shell.ready` for each host-attested source registration, so
duplicate readiness signals cannot bypass the startup limit. Per-napplet rate
limits remain shared across registrations and versions.

Standalone registries accept an optional second `onRegister(windowId)` callback.
The runtime uses it to call `firewallState.resetInitBudget(windowId)`, which removes
only the selected startup counter and preserves policy and token buckets. Custom
implementations of `FirewallStateContainer` must provide this method.

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
- `routeServiceMessage` — policy-free domain selection primitive; never a fallback for untrusted ingress
- `notifyServiceWindowDestroyed` — lifecycle fan-out to every service handler
- Service-only NAP domains, including `dm` and `fs`, route through handlers registered with `runtime.registerService('<domain>', handler)`.

For domains outside the built-in dispatcher, handlers opt in with an exact
`messageCapabilities` map (existing ACL capability or explicit `null` per inbound
type). `Runtime.handleMessage` requires a live unblocked source, an explicit
`isDomainAllowed` grant, the declared ACL grant, and firewall admission. Unknown
types and extension policy denials stay silent on the wire. Registration alone
attaches a service; it does not expose or grant a domain. Fixed NAP routes retain
their own authorization. Pending replies are invalidated by service/source
replacement or teardown and recheck current domain/ACL policy.

Browser hosts must provide the owning extension contract and inject its granted
namespace binding before scripts run. Stock Paja/playground bindings do not inject
arbitrary extensions. See [Register a service](../../docs/how-tos/register-service.md#domains-outside-the-built-in-dispatcher)
for the complete host contract and spec bounds.

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

## GAMEPAD integration

This non-normative guidance defers to the living [NAP-GAMEPAD](https://github.com/napplet/naps/pull/108). Services export `createGamepadService` and `browserGamepadOptions`; shell exports `denyNappletControllerAccess`. Paja and the playground register one host reader and deny native gamepad/HID/USB paths before frame execution. Source-bound subscriptions receive immediate full snapshots; only the visible host's input owner gets live controls. Focus loss supplies neutral controls and timestamp zero; unsubscribe, window destruction, and service removal release polling. Non-browser or denied native readers report the proposal's unavailable reasons. See [Controller input](https://github.com/kehto/web/blob/main/docs/gamepad.md).
