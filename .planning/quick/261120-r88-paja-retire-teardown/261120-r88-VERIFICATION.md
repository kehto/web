---
status: passed
issue: kehto/web#488
---

# Verification

- New `packages/paja/src/browser-target-frame-retire.test.ts`: fails with the revoke call reverted
  (only the revoke-hook assertion; session/service assertions already held on staging).
- `pnpm build`, `pnpm type-check`: green. `pnpm test:unit`: 306 files, 3949 tests passed.
- `pnpm docs:check`: green. `npx aislop@0.12.0 scan`: 100/100 (same pre-existing
  `browser-llm-panel.ts` warning).
- Playwright `--workers=1`: paja-firewall-approvals, paja-firewall-rules, paja-runtime-pointer,
  paja-version-consent, paja-single-window, paja-intent-links: 63 passed.
