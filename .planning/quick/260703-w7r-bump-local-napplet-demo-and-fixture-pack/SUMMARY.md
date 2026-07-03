---
status: complete
completed: "2026-07-03T21:18:00Z"
branch: fix/napplet-package-version-catchup
---

# Summary

Aligned Kehto's Napplet package graph with the latest published Napplet line:

- `@napplet/core` and `@napplet/nap` now resolve to `0.27.0`.
- `@napplet/sdk` now resolves to `0.24.0`.
- `@napplet/shim` now resolves to `0.26.2`.
- `@napplet/vite-plugin` remains at current `0.10.1`.

## Changes

- Updated playground and fixture napplet package pins.
- Raised published Kehto package peer/dev ranges for `@napplet/core` and
  `@napplet/nap` through `<=0.27.x`.
- Refreshed docs package dependency tables and the lockfile.
- Added a changeset for the published package metadata change.
- Updated static guards to enforce the current Napplet package graph and the
  installed `@napplet/nap@0.27.0` NAP-OUTBOX type surface.

## Verification

- `npm view @napplet/core version` -> `0.27.0`
- `npm view @napplet/nap version` -> `0.27.0`
- `npm view @napplet/shim version` -> `0.26.2`
- `npm view @napplet/sdk version` -> `0.24.0`
- `npm view @napplet/vite-plugin version` -> `0.10.1`
- `pnpm exec vitest run tests/unit/sdk-migration-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts packages/services/src/outbox-service.test.ts`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main`
- `git diff --check`
