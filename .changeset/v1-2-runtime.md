---
"@kehto/runtime": minor
---

NIP-5D 8-nub dispatch and shell-mediated signing. Runtime now uses `createDispatch()` + `registerNub()` from `@napplet/core` instead of a hand-rolled 8-case switch. All eight nub domains (identity, ifc, keys, media, notify, relay, storage, theme) are registered through `registerNub()` adapters at runtime startup. The `signer` domain is deleted; `relay.publishEncrypted` is now the canonical NIP-44 path and synthesizes a `relay.publish` into the registered relay service after shell-side encryption. ifc channel sub-protocol routed via per-runtime registry; `ifc.subscribe` emits the canonical `subscribe.result` envelope. `theme` dispatch added with a fallback default theme envelope so napplets without a registered theme service still get spec-correct replies.

**Breaking changes:**
- Removed `case 'signer'` and all signer.* dispatch paths
- Removed the hand-rolled domain switch in `runtime.ts`; inbound routing delegates to `dispatch()`
- `storage.clear` no longer dispatched (not in `@napplet/nub-storage`); internal cleanup helper retained for lifecycle use only

**Peer deps:**
- @napplet/core bumped from >=0.1.0 to ^0.2.0
- Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)

**Known carry-over:**
- `packages/runtime/src/core-compat.ts` is retained as a v1.2-deviation compat shim (DRIFT-CORE-06) to re-export legacy @napplet/core symbols (Capability, BusKind, ALL_CAPABILITIES, DESTRUCTIVE_KINDS, REPLAY_WINDOW_SECONDS, TOPICS.STATE_*, AUTH_KIND, SHELL_BRIDGE_URI, PROTOCOL_VERSION, ServiceDescriptor) removed in @napplet/core v0.2.0. Slated for deletion once @napplet/core restores those exports or consumers migrate.
