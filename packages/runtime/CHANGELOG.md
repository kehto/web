# @kehto/runtime

## 0.3.1

### Patch Changes

- Align published package peers and source imports with `@napplet/nub@0.5.0`, the June 12 NAP helper release that carries the NAP-MEDIA and NAP-IDENTITY changes.
- Updated dependencies
  - @kehto/acl@0.3.1

## 0.3.0

### Minor Changes

- **Fix #14** — `handleStorageNub` now returns storage errors as the canonical `storage.<action>.result` envelope with an `error` field, instead of a non-canonical `storage.<action>.error` type. The `@napplet/nub/storage` protocol defines no `*.error` message, so conformant shims silently dropped the old envelope and napplets hung until their request timeout. Clean break: the `storage.*.error` envelope is removed entirely (no backwards-compat).

  **Fix #15** — NIP-5D source-identity napplets are now registered into `runtime.sessionRegistry` during the `shell.ready` handshake. Previously `originRegistry` identity was never bridged into the runtime registry, so `getEntryByWindowId` always returned `undefined` and every storage (and other `sessionRegistry`-keyed) operation failed with `not registered`. The `shell.ready` handler resolves identity from the `onNip5dIframeCreate` hook (preferred) or `originRegistry.getIdentity` (fallback) and registers a source-identity `SessionEntry` (`provenance: 'nip-5d'`, `pubkey: ''`); it skips registration cleanly when neither source yields identity.

- 93224cd: Consolidate NUB peer dependencies from 8 split `@napplet/nub-{identity,ifc,keys,media,notify,relay,storage,theme}@^0.2.1` packages onto the single `@napplet/nub@^0.2.1` package. All in-repo imports now read from the `@napplet/nub/<domain>/types` subpath (type-only consumers) or the root `@napplet/nub/<domain>` subpath.

  Addresses kehto#4 (hyprgate v2.0 Kehto Migration gap analysis). Eliminates the dual-instance pitfall where downstream shells consuming both the split-package and consolidated NUB shapes ended up with two copies of every NUB module on disk.

  Downstream consumers note: `@napplet/nub@0.2.1` was published with an unresolved `workspace:*` specifier for its `@napplet/core` dependency. Until upstream re-publishes, workspace consumers should add the following `pnpm.overrides` entry at their workspace root to pin the transitive resolution:

  ```json
  "pnpm": {
    "overrides": {
      "@napplet/nub>@napplet/core": "^0.2.1"
    }
  }
  ```

  Public peer-dep surface changed — minor bump (not patch).

  REQ-IDs: DEP-01, DEP-02, DEP-03, DEP-04, DEP-05.

- 8890904: Phase 45 (DECRYPT-01/06 / v1.8): route `identity.decrypt` through the NUB enforcement gate and return typed decrypt errors for ACL denial. Class-forbidden decrypt attempts now emit `identity.decrypt.error` with `error: 'class-forbidden'` before any identity service handler runs.
- b7032ab: Phase 44 (DEP-01..02 / v1.8): bump `@napplet/core` and `@napplet/nub` peer deps `^0.2.1` → `^0.3.0`. No source code change in `@kehto/runtime` itself; consumers should resolve `@napplet/{core,nub}` at `^0.3.0` alongside.
- 597dbdb: **RENAME-01 (v1.8 Phase 42)** — `SessionEntry.identitySource: 'auth' | 'source'` is renamed to `SessionEntry.provenance: 'nip-5d' | 'legacy-auth'` across both `@kehto/shell` and `@kehto/runtime`. The new field name and variant values name the actual provenance (canonical NIP-5D origin registration vs legacy AUTH handshake) instead of the obsolete `'auth'`/`'source'` shorthand.

  **Migration:** Downstream consumers reading `entry.identitySource === 'source'` must rewrite to `entry.provenance === 'nip-5d'`. Consumers reading `entry.identitySource === 'auth'` must rewrite to `entry.provenance === 'legacy-auth'`. The old field is hard-removed; no compatibility shim ships.

  RENAME-02 (the `'auth:identity-changed'` topic rename in this same milestone) ships as a soft-rename with dual-emit — see its changeset for that migration window.

  Pre-1.0 minor bump is breaking per kehto's convention. The v1.6 carryover note flagged this rename as low-risk because the field is internal-leaning and the test surface is the primary live producer in this repo. Additional consumers updated in the same pass: `apps/playground/src/shell-host.ts` and `tests/e2e/harness/harness.ts`.

### Patch Changes

- 239fa70: Add NUB-RESOURCE reference service (10th NUB domain, v1.7 Phase 40).

  - `@kehto/services`: `createResourceService({ fetch, isOriginGranted, getConnectGrants, resolveIdentity })` factory. All four options required from day one — factory throws on construction if any is missing (H-03 prevention). Implements canonical 4-message protocol: `resource.bytes`, `resource.cancel` inbound; `resource.bytes.result`, `resource.bytes.error` outbound. Cancel correlates to in-flight requests via requestId.
  - `@kehto/acl`: new `'resource:fetch'` capability; `resolveCapabilitiesNub` extended with `resource.*` mapping (asymmetric: napplet requests get sender gate; shell pushes get recipient gate). `acl-state.ts` CAP_MAP extended with bit 15 for `resource:fetch`.
  - `@kehto/runtime`: `handleResourceMessage` dispatch + `nubDispatch.registerNub('resource', ...)` wiring (Phase 39 Dev 1 lesson: missing registerNub silently drops all envelopes).
  - `@kehto/shell`: `CANONICAL_NUB_DOMAINS` extended with `config` and `resource`; provisional-resource wire types re-exported via barrel.

  No breaking changes. See docs/policies/SHELL-RESOURCE-POLICY.md (Phase 40 Plan 40-03) for host-fetch policy surface (redirects, MIME sniffing, private-IP blocking — host-app concerns).

- d885328: v1.16 structural cleanup and anti-slop pass.

  This release removes the remaining local `aislop` structural warnings through behavior-preserving refactors and comment/import cleanup. The affected public packages keep their existing runtime contracts; the bump is patch-level because the changes are internal decomposition, code-quality cleanup, and packaging hygiene rather than new public API.

  Highlights:

  - Runtime relay, identity, IFC, and fallback domain handling were split into focused helpers.
  - Shell and playground-facing helpers were decomposed without changing public package exports.
  - Service factories and adapter builders were split into smaller private helpers.
  - Public package source now passes the local `aislop` gate with the existing scanner thresholds.

- Updated dependencies [d4e733e]
- Updated dependencies [239fa70]
- Updated dependencies [d885328]
- Updated dependencies [93224cd]
- Updated dependencies [8890904]
- Updated dependencies [b7032ab]
  - @kehto/acl@0.3.0

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
