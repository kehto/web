# Phase 54: Playground Gateway Loader Parity - Context

## Scope

Move the playground from a local Vite-only napplet asset shortcut to a production-equivalent gateway loading path.

## Requirements Covered

- GATEWAY-02
- PLAYGROUND-01
- PLAYGROUND-02
- PLAYGROUND-03

## Inputs

- Phase 53 added `artifactMode: 'single-file'` to `@napplet/vite-plugin`.
- All 13 playground napplets must build through the same shared single-file artifact config.
- The shell session identity must use the real manifest-derived `(dTag, aggregateHash)` pair instead of the empty-hash demo convention.
- The iframe sandbox must remain opaque-origin: `allow-scripts` only, no `allow-same-origin`.

## Boundaries

- Do not change visible playground behavior beyond loading through the gateway path.
- Do not introduce new dependencies.
- Keep existing connect grant and revocation flows working, including the resource-demo pregrant requirement before the iframe document request.
- Keep the old `/napplets` static server only as a non-active compatibility route; the active loader path must be `/napplet-gateway/...`.

## Verification Target

- `@kehto/playground` and all 13 napplet builds succeed.
- Built napplet `dist/` folders contain the gateway artifact shape produced by Phase 53.
- Runtime session entries use non-empty aggregate hashes from `.nip5a-manifest.json`.

