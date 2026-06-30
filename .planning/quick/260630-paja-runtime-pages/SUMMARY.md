---
status: complete
date: 2026-06-30
---

# Summary

Added a static Paja Runtime route for GitHub Pages at `/web/paja/` that loads verified napplet manifests from `naddr` or `nevent` pointers with HMR disabled. The existing Paja dev-server path remains `iframe-url` mode with target-url HMR.

## Verification

- `pnpm --filter @kehto/paja test:unit`
- `pnpm --filter @kehto/paja type-check`
- `pnpm --filter @kehto/paja build`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm docs:check`
- `pnpm site:build && pnpm audit:pages`
- `pnpm test:e2e`
- `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1`
- `npx --yes aislop scan --changes --base origin/main`
- `git diff --check`
