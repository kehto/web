---
status: complete
completed: 2026-06-30
branch: feat/paja-visible-errors-real-signers
---

# Summary

Paja's host header brand now renders as lowercase `@kehto/paja`, with `paja` in a distinct color.

## Evidence

- `pnpm --filter @kehto/paja type-check`
- `pnpm --filter @kehto/paja test:unit` — 8 files, 31 tests
- `pnpm --filter @kehto/paja build`
- `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1` — 3 tests
- `git diff --check`
