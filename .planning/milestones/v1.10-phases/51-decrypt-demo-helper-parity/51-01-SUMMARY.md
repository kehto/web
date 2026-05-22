---
phase: 51-decrypt-demo-helper-parity
plan: 01
status: completed
completed_at: 2026-05-22T13:04:00+02:00
requirements_completed:
  - DECRYPT-DEMO-01
  - DECRYPT-DEMO-02
  - DECRYPT-DEMO-03
---

# Phase 51 — Plan 01 Summary

## Result

Phase 51 migrated `decrypt-demo` to the `@napplet/nub@0.3.0` `identityDecrypt` helper and removed its remaining old `0.2.1` napplet helper graph.

## Changes Made

- Updated `apps/playground/napplets/decrypt-demo/package.json`:
  - Added exact `@napplet/nub: 0.3.0`.
  - Changed `@napplet/shim` to exact `0.3.0`.
  - Changed `@napplet/vite-plugin` to exact `0.3.0`.
- Regenerated `pnpm-lock.yaml`; the old `@napplet/core@0.2.1`, split `@napplet/nub-* @0.2.1`, `@napplet/shim@0.2.1`, and `@napplet/vite-plugin@0.2.1` lockfile entries were removed.
- Replaced local decrypt request/reply plumbing in `decrypt-demo`:
  - Added `identityDecrypt` from `@napplet/nub/identity/sdk`.
  - Removed the local request counter and pending response map.
  - Removed raw `window.parent.postMessage({ type: 'identity.decrypt', ... })` request construction.
  - Removed the raw `identity.decrypt.result` / `identity.decrypt.error` response handler.
- Preserved the existing UI sentinel behavior by adapting helper success to `{ ok: true, rumor }` and helper rejection to `{ ok: false, error }`.

## Verification Evidence

- `pnpm install` -> exit 0; lockfile updated. Existing optional peer warning under `apps/playground -> unocss -> oxc-parser -> @napi-rs/wasm-runtime` remains.
- `pnpm --filter @kehto/demo-decrypt-demo build` -> exit 0; Vite built 30 modules and emitted `dist/index.html` plus one JS asset.
- `pnpm test:e2e -- tests/e2e/decrypt-demo.spec.ts` -> exit 0; full build reported 27/27 successful build tasks and Playwright reported 1 passed.
- `rg "@napplet/(shim|vite-plugin|nub)@0\\.2\\.1|@napplet/nub-[a-z]+@0\\.2\\.1|@napplet/core@0\\.2\\.1" pnpm-lock.yaml` -> no matches.
- `rg "requestCounter|window\\.parent\\.postMessage\\(\\{ type: 'identity\\.decrypt'" apps/playground/napplets/decrypt-demo/src/main.ts` -> no matches.

## Requirement Status

- DECRYPT-DEMO-01: complete
- DECRYPT-DEMO-02: complete
- DECRYPT-DEMO-03: complete

## Notes

The demo still exercises the `identity.decrypt` protocol through the helper, so comments that refer to the protocol name remain accurate. Phase 52 will extend static guard coverage for the retired package graph and manual raw-envelope pattern.
