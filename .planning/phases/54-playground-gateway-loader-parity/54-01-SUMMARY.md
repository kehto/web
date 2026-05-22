# Phase 54: Playground Gateway Loader Parity - Summary

## Outcome

The playground now loads all 13 demo napplets through a local gateway-style route using manifest-derived `(dTag, aggregateHash)` identity metadata.

## Delivered

- Added `apps/playground/napplets/shared-vite-config.ts` so all demo napplets use the same single-file artifact config.
- Updated all 13 playground napplet `vite.config.ts` files to use the shared config and route-aligned `dTag` values.
- Added a deterministic playground-only fixture signing key so local builds always produce `.nip5a-manifest.json` metadata without operator env setup.
- Added `/napplet-gateway/<dTag>/manifest.json` and `/napplet-gateway/<dTag>/<aggregateHash>/index.html` local gateway routes.
- Gateway HTML serving validates the requested hash against `.nip5a-manifest.json` before streaming `index.html`.
- `loadNapplet()` now fetches gateway metadata before iframe navigation and registers shell sessions with the real aggregate hash.
- Resource-demo pregrant now grants the manifest-derived hash before gateway navigation so the first HTML response receives the correct CSP.
- Revocation reload still destroys and recreates the iframe, while preserving the snapshot-before-mutate safety pattern.

## Changed Files

- `apps/playground/vite.config.ts`
- `apps/playground/src/shell-host.ts`
- `apps/playground/src/main.ts`
- `apps/playground/napplets/shared-vite-config.ts`
- `apps/playground/napplets/*/vite.config.ts`
- `package.json`
- `pnpm-lock.yaml`

## Notes

- The legacy `/napplets` static middleware remains as a compatibility file server, but the active playground boot path uses `/napplet-gateway/...`.
- Built napplet dist folders now contain only `index.html` and `.nip5a-manifest.json`.

