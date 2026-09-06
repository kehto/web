# Phase 91 Plan 01 Summary: Single-Window Host and HMR Loop

**Completed:** 2026-06-21  
**Status:** Complete

## Delivered

- Added a bundled browser host script served from `/__kehto/browser-host.js`.
- Moved iframe navigation out of the static HTML `src` attribute and into browser bootstrap code.
- Preserved minimal visible chrome: one top bar, one iframe, one bottom bar, and no side panels.
- Kept iframe sandboxing to `allow-scripts` and explicitly excluded `allow-same-origin`.
- Added a production-shaped `shell.ready` -> `shell.init` capability payload using `domains`, `protocols`, `naps`, and `sandbox`.
- Added reload/reinitialize behavior that keeps one iframe and reloads the target URL without restarting the CLI or target app process.
- Added focused Playwright coverage with an ephemeral target fixture and a built dev-runtime server.

## Verification

```bash
pnpm --filter @kehto/dev-runtime test:unit
pnpm --filter @kehto/dev-runtime type-check
pnpm --filter @kehto/dev-runtime build
npx playwright test tests/e2e/dev-runtime-single-window.spec.ts --project=chromium
```

All listed focused commands passed before the final root verification pass.

## Remaining Work

- Phase 92 must wire full NAP/service parity and add the static parity guard.
- Phase 93 must add environment simulation controls and config-file schema coverage.
- VERIFY-02 remains open for representative NAP traffic through the wired services.
