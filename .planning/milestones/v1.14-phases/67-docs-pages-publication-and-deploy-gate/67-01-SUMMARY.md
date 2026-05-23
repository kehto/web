# Summary 67-01: Docs Pages Publication and Deploy Gate

**Phase:** 67 - Docs Pages Publication and Deploy Gate
**Completed:** 2026-05-23
**Status:** Complete

## Delivered

- Extended `scripts/build-pages.mjs` to copy VitePress output into `.pages/web/docs`.
- Copied generated TypeDoc output into `.pages/web/docs/api` so docs API links resolve in the deployed artifact.
- Added `scripts/audit-pages-artifact.mjs` and root `pnpm audit:pages`.
- Updated the GitHub Pages workflow to set explicit `/web/playground/` and `/web/docs/` bases, pack one `.pages` artifact, audit it, and upload `.pages`.
- Added Turbo `VITEPRESS_BASE` env sensitivity for docs builds to avoid cached wrong-base VitePress output.
- Updated unit guards for the new Pages publication contract.

## Requirements Closed

- DOCS-01
- DOCS-02
- DOCS-03
- VERIFY-01
- VERIFY-02
- VERIFY-03

## Verification

- `VITEPRESS_BASE=/web/docs/ pnpm docs:check`
- `PLAYGROUND_BASE_PATH=/web/playground/ pnpm --filter @kehto/playground build`
- `pnpm build:pages`
- `pnpm audit:pages`
- `pnpm vitest run tests/unit/playground-gateway-guard.test.ts`
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm audit:gateway-artifacts`
- `git diff --check`

## Notes

`pnpm docs:check` initially replayed a cached VitePress build with the wrong base. Adding `VITEPRESS_BASE` to the Turbo `docs:build` task env fixed the cache key; rerunning with `VITEPRESS_BASE=/web/docs/` produced `/web/docs/assets/` links in `docs/.vitepress/dist/index.html`.
