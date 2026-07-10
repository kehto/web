---
quick_id: 260710-pnr
slug: fix-paja-nip07-ci-ready-race
status: complete
created: 2026-07-10
completed: 2026-07-10
---

# Quick Task 260710-pnr: Fix Paja NIP-07 CI Ready Race

## Scope

The CI Playwright job for `main` merge commit `56a1ca4` failed
`tests/e2e/paja-single-window.spec.ts` because the NIP-07 signing target stayed
loaded with an empty `#identity-pubkey` after the signer was expected to be
connected.

## Plan

1. Rebuild locally before browser tests so Playwright uses current generated
   assets.
2. Reproduce or stress the focused Paja spec locally in CI mode.
3. Fix the smallest runtime or test synchronization issue shown by local
   evidence.
4. Re-run the focused spec with repeats, then run the relevant package/unit and
   repo gates before pushing.

## Verification

- `pnpm build`
- `CI=true pnpm exec playwright test tests/e2e/paja-single-window.spec.ts`
- Focused repeat run for the failing spec before push
- Relevant type/unit/docs/slop gates after the fix
