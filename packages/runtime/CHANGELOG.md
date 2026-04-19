# @kehto/runtime

## 0.2.0

### Minor Changes

- 226cdca: NIP-5D 8-nub dispatch and shell-mediated signing. Runtime now uses `createDispatch()` + `registerNub()` from `@napplet/core` instead of a hand-rolled 8-case switch. All eight nub domains (identity, ifc, keys, media, notify, relay, storage, theme) are registered through `registerNub()` adapters at runtime startup. The `signer` domain is deleted; `relay.publishEncrypted` is now the canonical NIP-44 path and synthesizes a `relay.publish` into the registered relay service after shell-side encryption. ifc channel sub-protocol routed via per-runtime registry; `ifc.subscribe` emits the canonical `subscribe.result` envelope. `theme` dispatch added with a fallback default theme envelope so napplets without a registered theme service still get spec-correct replies.

  **Breaking changes:**

  - Removed `case 'signer'` and all signer.\* dispatch paths
  - Removed the hand-rolled domain switch in `runtime.ts`; inbound routing delegates to `dispatch()`
  - `storage.clear` no longer dispatched (not in `@napplet/nub-storage`); internal cleanup helper retained for lifecycle use only

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)

  **Known carry-over:**

  - `packages/runtime/src/core-compat.ts` is retained as a v1.2-deviation compat shim (DRIFT-CORE-06) to re-export legacy @napplet/core symbols (Capability, BusKind, ALL*CAPABILITIES, DESTRUCTIVE_KINDS, REPLAY_WINDOW_SECONDS, TOPICS.STATE*\*, AUTH_KIND, SHELL_BRIDGE_URI, PROTOCOL_VERSION, ServiceDescriptor) removed in @napplet/core v0.2.0. Slated for deletion once @napplet/core restores those exports or consumers migrate.

### Patch Changes

- 97b7bc8: v1.3 bug-fix rollup — no protocol changes. Fixes landed during the demo-rewire and napplet-migration phases:

  - **Session registry registration on napplet load.** `sessionRegistry.register()` is now invoked inside the loadNapplet path so `storage.*` / `notify.*` NUB handlers resolve napplet identity correctly in the demo shell host (Phase 19 fix).
  - **Identity error-path shim routing.** The napplet-shim central handler now forwards `identity.*.error` envelopes so denial paths propagate to the napplet SDK (Phase 21 fix).
  - **Documentation surface.** 8 runtime source files received `@example` JSDoc blocks on non-type factory exports (`createManifestCache`, `createReplayDetector`, `createEventBuffer`, `matchesFilter`, `matchesAnyFilter`, `handleStateRequest`, `handleStorageNub`, `cleanupNappState`) so the typedoc-generated API reference is complete.

  Behavioral fan-out of these fixes is proved green end-to-end by the Phase 18-21 Layer-A + Layer-B Playwright specs.

  Requirement IDs covered:

  - NAP-01, NAP-02 (bot + chat SDK migration consuming runtime routing)
  - NAP-03..09 (single-domain napplets exercising runtime dispatch)
  - E2E-07 (napplet-auth, ifc-roundtrip, relay-publish, relay-publish-encrypted, relay-subscribe, identity-flow, storage-persist, notify-lifecycle, theme-broadcast specs)
  - E2E-09 (Layer-A nub-\* specs against the harness)
  - DOCS-01, DOCS-02 (typedoc + runtime README)

  No new public API. Compat re-exports under `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) unchanged; removal awaits @napplet/core upstream export restoration.

- Updated dependencies [226cdca]
- Updated dependencies [97b7bc8]
  - @kehto/acl@0.2.0
