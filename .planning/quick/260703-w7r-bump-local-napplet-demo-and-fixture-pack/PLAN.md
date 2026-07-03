---
status: complete
created: "2026-07-03T21:11:43Z"
branch: fix/napplet-package-version-catchup
---

# Bump local napplet demo and fixture package versions

## Objective

Align Kehto's local playground napplets and test fixture napplets with the latest
published Napplet package line after the NAP-OUTBOX chase landed upstream.

## Current registry targets

- `@napplet/core`: `0.27.0`
- `@napplet/nap`: `0.27.0`
- `@napplet/shim`: `0.26.2`
- `@napplet/sdk`: `0.24.0`
- `@napplet/vite-plugin`: `0.10.1`

## Plan

1. Update local napplet package manifests under `apps/playground/napplets/` and
   `tests/fixtures/napplets/` to the current published package versions.
2. Refresh `pnpm-lock.yaml` from the updated manifests.
3. Inspect the installed `@napplet/nap` NAP-OUTBOX type surface and update the
   static conformance guard if the package contract needs a direct regression
   assertion.
4. Run focused and repo-level verification, then commit, push, and open a new PR.
