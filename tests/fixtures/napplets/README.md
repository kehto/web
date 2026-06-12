# Fixture Napplets

This directory holds the **Layer-A fixture napplets** used by the Playwright harness at `:4173`. Each fixture is a single-purpose protocol probe that exercises one NAP domain and is loaded via the legacy fixture id `window.__loadNapplet__('nub-<domain>')` in a Layer-A spec (`tests/e2e/nub-*.spec.ts`).

## Pattern (v1.3+)

Each fixture is a minimal helper-based package named `@kehto/fixture-nub-<domain>`:

- `package.json` — exact `@napplet/shim`, `@napplet/sdk`, and `@napplet/nub` 0.5.0 deps; `vite build` + `vite preview` scripts (mirrors demo napplets)
- `vite.config.ts` — `nip5aManifest({ nappletType: 'fixture-nub-<domain>' })`
- `tsconfig.json` — strict TS, ESNext, DOM lib (mirrors demo napplets)
- `index.html` — minimal HTML with `<title>nub-<domain> fixture</title>` and required DOM sentinels
- `src/main.ts` — imports `@napplet/shim` + relevant `@napplet/nub/<domain>/sdk` direct helpers; performs one or two helper calls on init

Six active fixtures (one per non-stub NAP domain):
- `nub-identity/` — `identityGetPublicKey` / `identityGetProfile`
- `nub-ifc/`      — `ifcOn` / `ifcEmit`
- `nub-notify/`   — `notifySend`
- `nub-relay/`    — `relayPublish` / `relayPublishEncrypted`
- `nub-storage/`  — `storageSetItem` / `storageGetItem`
- `nub-theme/`    — receives `theme.changed` push (no fixture-side SDK call required for theme)

Stub-domain coverage (no fixture napplet — spec uses `__injectEnvelope__` directly):
- `nub-keys.spec.ts`  — asserts runtime stub response shape for `keys.registerAction`
- `nub-media.spec.ts` — asserts runtime stub response shape for `media.session.create`

## Anti-features (hard-enforced)

- NO raw `window.addEventListener('message')` — fixtures use shim-mounted NAP helper functions only.
- NO `window.nostr`, NO `signer-service`, NO `BusKind`, NO kind 29001/29002.
- NO new consumers of the former `@napplet/core` compatibility shim (removed in Phase 24).
- NO `allow-same-origin` in any iframe sandbox.

## Removed in Phase 21

Three legacy fixtures were deleted in v1.3 Phase 21 (E2E-09):

- `auth-napplet/` — used `window.addEventListener('message')` + NIP-01 `['OK', challenge, success]` arrays. Incompatible with v1.2 NIP-5D shell.
- `publish-napplet/` — used legacy NIP-01 relay publishing. Replaced by helper-based `nub-relay/` (Plan 21-02).
- `pure-napplet/` — HTML stub with no JS, kept only for AUTH-timing tests in `tests/e2e/lifecycle.spec.ts` (spec file itself deleted in Phase 22-07).

All seven specs that loaded these fixtures (`lifecycle`, `routing`, `replay`, `acl-matrix-state`, `acl-matrix-relay`, `acl-lifecycle`, `acl-enforcement`) carried `test.describe.skip(...)` markers citing "Phase 21 (E2E-09) — requires fixture napplet migration to NIP-5D protocol." The spec files themselves were deleted in **Phase 22-07 (E2E-10)** per Phase 21-01's "cleanliness > backward compat" precedent — migrating them would duplicate the eight new `nub-*.spec.ts` Layer-A specs (Plans 21-03 + 21-04) which now own that coverage.
