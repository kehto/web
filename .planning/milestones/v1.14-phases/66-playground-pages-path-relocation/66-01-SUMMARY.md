# Summary 66-01: Playground Pages Path Relocation

**Phase:** 66 - Playground Pages Path Relocation
**Completed:** 2026-05-23
**Status:** Complete

## Delivered

- Changed `scripts/build-playground-pages.mjs` to default to `.pages/web/playground`.
- Changed the playground Pages base default to `/web/playground/`.
- Extended `scripts/build-pages.mjs` so the unified Pages packer invokes the playground packer under `web/playground/`.
- Verified generated gateway manifests use `/web/playground/napplet-gateway/...` `htmlUrl` values.

## Requirements Closed

- PLAY-01
- PLAY-02
- PLAY-03
- PLAY-04

## Verification

- `PLAYGROUND_BASE_PATH=/web/playground/ pnpm --filter @kehto/playground build`
- `pnpm build:pages`
- `find .pages/web/playground/napplet-gateway -name manifest.json | wc -l` -> `13`
- `grep -q '/web/playground/assets/' .pages/web/playground/index.html`
- `grep -R '"htmlUrl": "/web/playground/napplet-gateway/' .pages/web/playground/napplet-gateway/*/manifest.json | wc -l` -> `13`

## Notes

The GitHub Actions workflow still needs to be updated to use the explicit Pages bases and upload `.pages`; Phase 67 owns that deploy gate.
