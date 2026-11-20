---
status: passed
issue: kehto/web#480
---

# Verification

- `kehto conformance --profile full --domain theme --domain identity`: before 56 pass / 2 fail
  (`catalog/broadcast-to-loaded` in both shell variants); after 58 pass / 0 fail / 152 skip. Check unchanged.
- `kehto conformance --profile full`: before 12 fail, after 10 fail; the two removed are
  `catalog/broadcast-to-loaded`, the rest are pre-existing known findings.
- New `hello-broadcast-targets.test.ts`: 11 tests; 6 fail with the transport fix reverted.
- `pnpm build`, `pnpm type-check`: green. `pnpm test:unit`: 306 files, 3957 tests passed.
- `pnpm docs:check`: green. `npx aislop@0.12.0 scan`: 100/100 (staging baseline 100/100, same
  pre-existing `browser-llm-panel.ts` warning).
- Playwright `--workers=1`: conformance, conformance-mutations, paja-single-window, nap-theme,
  paja-identity, nip5d-port-binding, harness-smoke, gamepad: 50 passed, 1 skipped (existing fixme).
