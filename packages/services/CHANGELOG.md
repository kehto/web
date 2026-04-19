# @kehto/services

## 0.2.0

### Minor Changes

- 226cdca: Reference services realigned to the 8-nub protocol. `signer-service` is deleted; its responsibilities are split into a new `identity-service` (read-only `getPublicKey` / `getRelays` / `getProfile` / `getFollows` / `getList` / `getZaps` / `getMutes` / `getBlocked` / `getBadges`) and shell-mediated signing/encryption inside `relay.publish` / `relay.publishEncrypted`. New reference handlers added for the other four new nub domains: `keys-service` (keyboard actions — bindings/register/forward), `media-service` (MediaSession create/update/destroy + controls), `notify-service` (send/permission/channel register/dismiss/badge), and `theme-service` (get/changed broadcast with `publishTheme`/`getCurrentTheme` host-facing bundle). Legacy `audio-service` and `notification-service` remain for ifc-emit topics and coexist with the new NIP-5D envelope handlers.

  **Breaking changes:**

  - `signer-service` REMOVED. Napplets and hosts depending on `registerService('signer', ...)` must either register an `identity` service or remove the call; signing/encryption happens inside the shell via relay publishes.

  **Migration note:**

  - `tests/unit/shell-runtime-integration.test.ts` was removed in v1.2 — its v1.1 BusKind / signer.\* assertions no longer apply to the 8-nub protocol model. Equivalent coverage is provided by the per-package integration tests added in v1.2 Phases 12-03 (identity), 12-04 (ifc), 12-08 (relay publishEncrypted), and 12-09 (storage).

  **Peer deps:**

  - @napplet/core bumped from >=0.1.0 to ^0.2.0
  - Added @napplet/nub-identity, @napplet/nub-ifc, @napplet/nub-keys, @napplet/nub-media, @napplet/nub-notify, @napplet/nub-relay, @napplet/nub-storage, @napplet/nub-theme (all ^0.2.0)

### Patch Changes

- 41b12b9: v1.3 behavior-alignment rollup — no new services, no breaking changes:

  - **notification-service canonical `notify.*` handling.** The service now handles both canonical v1.2 NIP-5D `notify.create` / `notify.list` / `notify.read` / `notify.dismiss` envelopes AND the legacy `ifc.emit` format for in-flight compatibility (Phase 17 + Phase 19 alignment). Registered under both `'notifications'` (topology key) and `'notify'` (runtime routing key) so the demo topology and the runtime dispatch both resolve correctly from a single handler instance (Phase 19 dual-register pattern).
  - **identity-service `getPublicKey` contract.** The service always returns a result envelope (with an empty pubkey when no signer is present) rather than throwing — matches the `identity.getPublicKey` "Always succeeds" contract. Enables the `profile-viewer` napplet to render a `no-pubkey` sentinel cleanly under the no-signer case (Phase 20).
  - **Documentation surface.** Canonical v1.2 `packages/services/README.md` groups factories by NIP-5D NUB domain with explicit capability-gate annotations (e.g., `createIdentityService` requires `identity:read` ACL entry).

  Requirement IDs covered:

  - DEMO-05 (`createDemoHooks()` registers reference services for keys / media / theme alongside identity / notifications)
  - DEMO-07 (notification demo + kinds panel + constants panel reflect v1.2 data)
  - NAP-05 (toaster creates / lists / dismisses via `notify.*`)
  - NAP-07 (profile-viewer calls `identity.getPublicKey` + `identity.getProfile`)
  - E2E-07 (`notify-lifecycle`, `identity-flow` specs green)
  - DOCS-01, DOCS-02 (typedoc + services README)

  No API renames. Additive behavior; legacy call sites continue to work.

- Updated dependencies [226cdca]
- Updated dependencies [97b7bc8]
  - @kehto/runtime@0.2.0
