---
quick_id: 260710-pnr
slug: fix-paja-nip07-ci-ready-race
status: complete
created: 2026-07-10
completed: 2026-07-10
---

# Quick Task 260710-pnr Summary

## Status

Complete.

## Failure

The `CI` Playwright job for `main` merge commit `56a1ca4` failed run
`29098394853`, job `86380988349`. The failing test was
`tests/e2e/paja-single-window.spec.ts`, where the NIP-07 signing fixture stayed
on an empty `#identity-pubkey` through the original run and both CI retries.

Local reproduction after a fresh build confirmed the same Paja spec flaked on
the first run and passed on retry.

## Changes

- Added current-generation cancellation to single-frame Paja iframe navigation
  so a stale pending navigation cannot write `srcdoc` after a signer-triggered
  reload.
- Rejected single-frame messages unless their registered window id matches the
  current generation's `runtime.currentWindowId`.
- Cleaned up late obsolete window registrations instead of leaving them in the
  shell/session registries.
- Made the Paja local HTTP server close idle connections and force-close
  lingering browser connections during shutdown.
- Added source guards and a patch changeset for `@kehto/paja`.

## Verification

- `pnpm --filter @kehto/paja build`
- `pnpm --filter @kehto/paja test`
- `CI=true pnpm exec playwright test tests/e2e/paja-single-window.spec.ts`
- `CI=true pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --repeat-each=20` — 80 passed
- `CI=true pnpm exec playwright test tests/e2e/paja-single-window.spec.ts -g "applies simulation config" --repeat-each=30` — 30 passed
- `pnpm test:e2e -- tests/e2e` — 71 passed
- `pnpm type-check`
- `pnpm test:unit` — 101 files, 1311 tests
- `pnpm docs:check`
- `npx aislop scan` — 93/100 baseline; remaining findings are pre-existing `packages/shell/src/napplet-namespace.ts` warnings
- `git diff --check`
