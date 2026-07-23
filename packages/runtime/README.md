# @kehto/runtime

Browser-agnostic protocol engine for the napplet protocol.

> **Alpha status:** Kehto is an early runtime implementation for a draft NIP-5D
> protocol. NAP contracts and runtime APIs are not final; treat this package as
> current implementation guidance, not as a stable protocol guarantee.

## Install

```bash
pnpm add @kehto/runtime
```

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
- **storage** — `storage.get/set/remove/keys` with quota enforcement
- **theme** — `theme.get`, `theme.changed` fan-out

Signing is shell-mediated inside `relay.publish` / `relay.publishEncrypted` (NIP-44 default, NIP-04 opt-in). The legacy signer domain is dissolved — napplets never see a host-injected nostr object and cannot call signer-sign RPCs directly.

## NAP-INC Draft Contract

The active INC boundary follows [NAP-INC PR #89 at
`4593ce9e301ce098fd3dad64206fcd6f144fa7af`](https://github.com/napplet/naps/pull/89),
the [web projection PR #90 at
`896c32c92deee68dc4d10fc1132b62df20cccb6f`](https://github.com/napplet/naps/pull/90),
and the stacked [symmetric-channel clarification PR #92 at
`c5cd06f7be6d4690b303949abb26e87ff62f4729`](https://github.com/napplet/naps/pull/92).
These are unmerged draft references; this package documents their implemented
boundary rather than becoming another protocol authority.

The projection-owned binding converts a convention query to a text payload map
before sending `inc.emit`. Runtime `inc-handler` routing then uses an exact
queryless topic identity, with no query-bearing normalized wire/discovery
identity, prefix/wildcard/query-aware matching, generic or service-over-INC
prefix dispatch, or runtime payload-kind inference. The runtime derives the
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
binding/resolution/delivery change; **Phase 105** owns released package adoption.
Do not claim package conformance before Phase 105. Historical changelogs and
archived planning are preserved records, not targets for active-surface edits.

Everything plugs into a single factory, `createRuntime()`, via a `RuntimeAdapter` hook bag — persistence, relay pool, auth, services, and so on. No DOM, no postMessage, no localStorage: those live in `@kehto/shell`.

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
- Service-only NAP domains, including `dm`, route through handlers registered with `runtime.registerService('<domain>', handler)`.

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
