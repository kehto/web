---
quick_id: 260623-fh2
status: complete
completed: 2026-06-23T09:15:00.000Z
---

# Summary

Aligned Kehto's real `@napplet/*` dependency graph with the published package
versions that include `resource.bytesMany`.

## Changed

- Updated playground napplet and fixture package manifests to:
  - `@napplet/core` 0.21.0
  - `@napplet/nap` 0.21.0
  - `@napplet/sdk` 0.19.0
  - `@napplet/shim` 0.22.0
  - `@napplet/vite-plugin` 0.10.0
- Updated published Kehto package peer/dev ranges to `>=0.21.0 <0.22.0`.
- Refreshed `pnpm-lock.yaml`.
- Updated the SDK migration guard to enforce the new package graph.
- Added a patch changeset for affected Kehto packages.

## Verification

- Fresh npm install smoke check of latest Napplet packages showed `bytesMany`
  as a function on `@napplet/nap/resource`, `@napplet/sdk`, and `@napplet/shim`.
- `pnpm test:unit` passed: 92 files, 1202 tests.
- `pnpm build` passed: 32 tasks.
- `pnpm type-check` passed: 17 tasks.
- `pnpm lint` passed with no configured lint tasks.
- `git diff --check` passed.
- `npx --yes aislop scan -d` passed: 100/100, 0 issues.
