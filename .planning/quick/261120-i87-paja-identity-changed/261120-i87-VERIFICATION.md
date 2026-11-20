---
status: passed
issue: kehto/web#487
---

# Verification

- `paja-identity.spec.ts` former `test.fixme` now passes (connect, switch, disconnect; generation unchanged).
- `pnpm build`, `pnpm type-check`: green. `pnpm test:unit`: 309 files, 4055 tests passed (after rebasing on staging with #495).
- `pnpm docs:check`: green. `npx aislop@0.12.0 scan`: 100/100 (same pre-existing warning).
- `kehto conformance --profile full --domain identity`: 52 pass, 0 fail, 158 skip.
- Playwright `--workers=1` after the rebase: paja identity, relay, version-consent, single-window, webrtc,
  multiplayer, runtime-pointer, storage, cvm, firewall-approvals, firewall-rules, intent-links,
  llm, target-url-resource, conformance: 93 passed.