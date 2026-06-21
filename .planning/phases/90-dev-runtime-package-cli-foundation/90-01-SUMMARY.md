# Phase 90 Plan 01 Summary: Dev Runtime Package and CLI Foundation

**Completed:** 2026-06-21  
**Status:** Complete

## Delivered

- Added publishable workspace package `@kehto/dev-runtime`.
- Added ESM package exports plus `kehto-dev-runtime` CLI bin metadata.
- Added dependency-free option normalization and CLI parsing.
- Added a dependency-free HTTP server entry that serves the initial single-window host page and runtime config JSON.
- Added target readiness polling so managed command mode waits for the explicit app URL before serving the runtime.
- Added docs/TypeDoc integration so `@kehto/dev-runtime` is covered by the package reference, VitePress sidebar, generated API reference, and docs audit.
- Established the milestone HMR contract: the target URL is explicit and loaded directly in the runtime iframe; optional child commands are preserved without framework-specific parsing.
- Added host config generation with minimal chrome defaults (`topBar`, `bottomBar`, no side panels).
- Added a direct CLI serve path that starts the runtime server and spawns an optional user command while preserving the explicit target URL contract.
- Added README usage showing package-script integration.
- Added changeset for the new package.
- Updated `pnpm-lock.yaml` with the new workspace importer.

## Verification

```bash
pnpm --filter @kehto/dev-runtime test:unit
pnpm --filter @kehto/dev-runtime type-check
pnpm --filter @kehto/dev-runtime build
pnpm test:unit -- packages/dev-runtime
pnpm build
pnpm type-check
pnpm docs:check
git diff --check
```

All listed commands passed. `pnpm install` reported existing workspace peer warnings for unrelated packages and added only the `packages/dev-runtime` importer to `pnpm-lock.yaml`.

## Remaining Work

- Phase 91 must implement actual iframe shell bootstrap and runtime reinitialization around the served host.
- Phase 92 must wire full NAP/service parity.
- Phase 93 must expand the config-file and simulation controls beyond the Phase 90 placeholder path.
