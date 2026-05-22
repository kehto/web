# Phase 56: Contract Authority and Package Source Baseline - Summary

## Outcome

Established the pinned NIP-5D contract as the only active authority and made the
playground package graph consume local `@napplet/*` sources for protocol work.

## Delivered

- Added root `specs/NIP-5D.md` as the active repo-local contract derived from
  pinned source commit `d80d7b25f9c4331acbeb40dbeb3b077caa80e885`.
- Replaced `RUNTIME-SPEC.md` with current NIP-5D runtime guidance and explicitly
  retired AUTH/REGISTER/IDENTITY/NIP-01 identity negotiation as active protocol
  identity.
- Marked `napplet/specs/NIP-5D.md` non-authoritative for Kehto v1.12 so its
  former residual extension content cannot drift the milestone contract.
- Added `docs/policies/NIP-5D-CONFORMANCE.md` with extension decisions for
  `connect`, `class`, `nostrdb`, `identity.decrypt`, and
  `relay.publishEncrypted`.
- Expanded root pnpm overrides and workspace membership so `@napplet/core`,
  `@napplet/nub`, `@napplet/sdk`, `@napplet/shim`, and
  `@napplet/vite-plugin` resolve to repo-local package sources.
- Added a unit guard that fails if the local protocol package overrides,
  workspace inclusion, or lockfile source-resolution invariant drifts.

## Changed Files

- `specs/NIP-5D.md`
- `RUNTIME-SPEC.md`
- `napplet/specs/NIP-5D.md`
- `docs/policies/NIP-5D-CONFORMANCE.md`
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `tests/unit/sdk-migration-guard.test.ts`

## Notes

- The first root `pnpm type-check` after adding local overrides exposed that
  Turbo could not see nested `napplet/packages/*` builds. Adding those packages
  to the root workspace fixed the actual source-resolution baseline instead of
  relying on ignored generated dist files.
- `nostrdb` is intentionally out of the active playground conformance path until
  a NUB contract and shell capability advertisement exist.
