# Quick Task 260710-jmo Summary

## Status

Complete.

## Changes

- Moved Paja runtime tabs into the header stage column so the first tab aligns
  with the napplet frame/body edge.
- Introduced one shared `--paja-console-column` used by both the top header grid
  and the main console/stage grid.
- Added host-page regression assertions for the shared grid column and stage tab
  wrapper.

## Verification

- `pnpm --filter @kehto/paja test:unit`
- `pnpm --filter @kehto/paja type-check`
- `pnpm --filter @kehto/paja build`
- `node scripts/build-paja-pages.mjs`
- `node scripts/audit-pages-artifact.mjs`
- Browser geometry check at 1100x720: tab left, top-stage left, and stage left
  all measured `380px` with zero delta.
- `npx playwright test tests/e2e/paja-single-window.spec.ts`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `git diff --check`
- `npx aislop@0.12.0 scan --changes --base origin/main`

## Notes

The desktop header now has the same left grid boundary as the body. Mobile keeps
the compact single-column header and hides the console-side label.
