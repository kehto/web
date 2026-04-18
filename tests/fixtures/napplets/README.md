# Fixture Napplets

This directory holds the **Layer-A fixture napplets** used by the Playwright harness at `:4173`. Each fixture is a single-purpose protocol probe that exercises one NUB domain and is loaded via `window.__loadNapplet__('nub-<domain>')` in a Layer-A spec (`tests/e2e/nub-*.spec.ts`).

## Pattern (v1.3+)

Each fixture is a minimal `@napplet/sdk`-based package named `@kehto/fixture-nub-<domain>`:

- `package.json` — `@napplet/shim` + `@napplet/sdk` link deps; `vite build` + `vite preview` scripts (mirrors demo napplets)
- `vite.config.ts` — `nip5aManifest({ nappletType: 'fixture-nub-<domain>' })`
- `tsconfig.json` — strict TS, ESNext, DOM lib (mirrors demo napplets)
- `index.html` — minimal HTML with `<title>nub-<domain> fixture</title>` and required DOM sentinels
- `src/main.ts` — imports `@napplet/shim` + relevant `@napplet/sdk` namespace; performs one or two SDK calls on init

Six active fixtures (one per non-stub NUB domain):
- `nub-identity/` — `identity.getPublicKey` / `identity.getProfile`
- `nub-ifc/`      — `ipc.subscribe` / `ipc.emit`
- `nub-notify/`   — `notify.send` / `notify.dismiss`
- `nub-relay/`    — `relay.publish` / `relay.publishEncrypted`
- `nub-storage/`  — `storage.setItem` / `storage.getItem`
- `nub-theme/`    — receives `theme.changed` push (no fixture-side SDK call required for theme)

Stub-domain coverage (no fixture napplet — spec uses `__injectEnvelope__` directly):
- `nub-keys.spec.ts`  — asserts runtime stub response shape for `keys.registerAction`
- `nub-media.spec.ts` — asserts runtime stub response shape for `media.session.create`

## Anti-features (hard-enforced)

- NO raw `window.addEventListener('message')` — fixtures use `@napplet/sdk` only.
- NO `window.nostr`, NO `signer-service`, NO `BusKind`, NO kind 29001/29002.
- NO new consumers of `packages/runtime/src/core-compat.ts`.
- NO `allow-same-origin` in any iframe sandbox.

## Removed in Phase 21

Three legacy fixtures were deleted in v1.3 Phase 21 (E2E-09):

- `auth-napplet/` — used `window.addEventListener('message')` + NIP-01 `['OK', challenge, success]` arrays. Incompatible with v1.2 NIP-5D shell.
- `publish-napplet/` — used NIP-01 array dispatch + raw `window.napplet.relay.publish`. Replaced by `nub-relay/` (Plan 21-02).
- `pure-napplet/` — HTML stub with no JS, kept only for AUTH-timing tests in `tests/e2e/lifecycle.spec.ts` (spec file itself deleted in Phase 22-07).

All seven specs that loaded these fixtures (`lifecycle`, `routing`, `replay`, `acl-matrix-state`, `acl-matrix-relay`, `acl-lifecycle`, `acl-enforcement`) carried `test.describe.skip(...)` markers citing "Phase 21 (E2E-09) — requires fixture napplet migration to NIP-5D protocol." The spec files themselves were deleted in **Phase 22-07 (E2E-10)** per Phase 21-01's "cleanliness > backward compat" precedent — migrating them would duplicate the eight new `nub-*.spec.ts` Layer-A specs (Plans 21-03 + 21-04) which now own that coverage.
