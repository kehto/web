# Quick Task 260628-mkr: Fix stale package docs versions blocking publish workflow

## Scope

Update package documentation version rows after the merged Version Packages PR so `pnpm docs:check` passes on `main`.

## Tasks

1. Align `docs/packages/*` version rows with current package manifests for packages reported by CI.
2. Run the docs gate and lightweight verification.
3. Commit, push, and open a PR so merging it lets main CI succeed and trigger `publish.yml`.
