---
status: passed
---

# Verification

- Repro: new resolver tests failed on the pre-fix resolver (3 failed: the #471 nevent case in both
  formats and the rewritten mixed-connectivity case), pass after.
- `pnpm build`, `pnpm type-check`: green.
- `pnpm test:unit`: 293 files, 3817 tests passed.
- `pnpm docs:check`: OK.
- Playwright (`--workers=1`): paja-pointer-not-found, paja-relay-unreachable, paja-runtime-pointer,
  paja-version-consent, paja-manifest-kinds, paja-intent-links: 44 passed.
- `npx aislop@0.12.0 scan`: 100/100 (baseline at staging `acdb7c57`: 100/100, same 1 warning).
