# @kehto/acl

## 0.3.1

### Patch Changes

- Align published package peers and source imports with `@napplet/nub@0.5.0`, the June 12 NAP helper release that carries the NAP-MEDIA and NAP-IDENTITY changes.

## 0.3.0

### Minor Changes

- d4e733e: NUB-CONFIG (v1.7 Phase 39): add `config:read` capability and extend `resolveCapabilitiesNub` for the `config.*` domain.

  Sender gate: `config:read` for all napplet-originated config requests (`config.get`, `config.subscribe`, `config.unsubscribe`, `config.registerSchema`, `config.openSettings`).

  Recipient gate: `config:read` for shell-originated config pushes (`config.values`, `config.registerSchema.result`, `config.schemaError`) — napplets without the cap never see the pushes.

  Anti-overlap with NUB-STORAGE: CONFIG is shell-managed per-napplet configuration (napplet reads, shell writes). STORAGE remains the general key-value surface. See `packages/services/src/config-service.ts` (Plan 39-02) for the scope boundary documentation.

  Additive — no breaking changes. Minor bump because the public capability surface expanded.

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

- 8890904: Phase 45 (DECRYPT-06 / v1.8): add the `identity:decrypt` capability and map `identity.decrypt` to it. This keeps decrypt class gating explicit and separate from the read-only `identity:read` surface.
- b7032ab: Phase 44 (RENAME-01-DEP / v1.8): bump `@napplet/core` and `@napplet/nub` peer deps `^0.2.1` → `^0.3.0`. No source code change; consumers using `@kehto/acl@^0.2` may need to also bump their `@napplet/{core,nub}` resolutions.

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

## 0.2.0

### Minor Changes

- 226cdca: ACL full 8-domain coverage. `resolveCapabilitiesNub` now maps capabilities for identity, ifc, keys, media, notify, relay, storage, theme. Signer domain removed (getPublicKey/getRelays moved to identity; signEvent/nip04/nip44 are shell-mediated via relay.publish/publishEncrypted). New capability constants: identity:read, keys:bind, keys:forward, media:control, notify:send, notify:channel, theme:read.

  **Breaking changes:**

  - Removed capability constants: sign:event, sign:nip04, sign:nip44
  - Removed `resolveCapabilitiesNub` case 'signer'

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)

### Patch Changes

- 97b7bc8: v1.3 consume-and-showcase — no protocol changes to `@kehto/acl`. The demo's ACL panel (`apps/demo/src`) now drives grant/revoke/block/unblock through the canonical v1.2 `ShellAdapter.acl` hooks, and ACL-capability-matrix Playwright specs prove the package's enforcement contract end-to-end against the v1.3 demo napplet showcase.

  Documentation:

  - New canonical v1.2 `packages/acl/README.md` with `@example` JSDoc coverage for every non-type public export.
  - typedoc reference generated via `pnpm docs:api` at repo root.

  Requirement IDs covered:

  - DEMO-03 (ACL panel grant/revoke/block/unblock flows)
  - E2E-08 (`acl-grant-revoke`, `acl-block-unblock`, `acl-revoke-relay-write`, `acl-revoke-storage-write` specs green)
  - DOCS-01, DOCS-02 (typedoc + per-package README)
