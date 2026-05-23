# Quick Task 260523-jev Summary

## Goal

Create a GitHub Actions workflow that publishes the playground to GitHub Pages.

## Result

- Added `Publish Playground to GitHub Pages`, triggered on `main` pushes and `workflow_dispatch`.
- Added a static Pages artifact builder that copies the playground build and materializes the active gateway routes at `/napplet-gateway/<dTag>/manifest.json` and `/napplet-gateway/<dTag>/<aggregateHash>/index.html`.
- Made playground gateway metadata and shell manifest fetches aware of `PLAYGROUND_BASE_PATH`, so the shell can run at localhost root and under the repository Pages path.
- Kept the resource demo functional on Pages by resolving `demo-data.json` against the active playground base instead of hardcoding `localhost:4174`.
- Added guards so the workflow, packer script, base-aware loader, and dynamic resource fixture path do not drift.

## Implementation Commits

- `c89e746` — Publish playground with a static gateway artifact

## Verification

- `pnpm exec vitest run tests/unit/playground-gateway-guard.test.ts`
- `PLAYGROUND_BASE_PATH=/web/ pnpm --filter @kehto/playground build`
- `PLAYGROUND_BASE_PATH=/web/ pnpm build:playground-pages` (13 gateway napplet routes)
- `pnpm type-check`
- `pnpm test:unit` (562 tests)
- `pnpm audit:csp`
- `pnpm audit:gateway-artifacts`
- `pnpm build`
- `pnpm test:e2e` (90 passed)

## Notes

- The workflow intentionally rebuilds `@kehto/playground` directly with `PLAYGROUND_BASE_PATH` after the monorepo build. Local verification showed Turbo does not pass that custom env var through to the Vite package build, and the packer fails closed if the playground dist was built for the wrong base.
