---
status: complete
completed: 2026-06-30
branch: feat/paja-visible-errors-real-signers
---

# Summary

Paja now renders visible details for `.error` message rows and can switch the host signer between the generated development signer, browser NIP-07, and bunker/NIP-46.

## Evidence

- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit` — 96 files, 1259 tests
- `pnpm --filter @kehto/paja type-check`
- `pnpm --filter @kehto/paja test:unit` — 8 files, 31 tests
- `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1` — 3 tests
- `pnpm docs:check`
- `git diff --check`
- `npx aislop scan --staged` — 100/100
