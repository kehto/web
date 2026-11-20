---
status: passed
---

- Repro: with staging `99353c60`'s `policy-denials.ts`, the new
  `policy-denials.test.ts` Firewall cases fail (30) for all seven domains;
  identity already passes.
- `kehto conformance --profile full`: `catalog/firewall-denial` passes in both
  variants (25 domains); `catalog/acl-denial` still passes. With the runtime
  rows reverted (run on #489's head `701b5683`, whose `policy-denials.ts`
  matches staging `99353c60`) it fails for link, common, lists, serial, ble,
  webrtc and gamepad. Remaining failures are the known `catalog/package-drift` and
  `relay/semantics`. `--profile minimal`: all pass.
- `pnpm build`, `pnpm type-check`, `pnpm docs:check`: green.
- `pnpm test:unit`: 309 files, 4087 tests passed.
- `npx aislop@0.12.0 scan`: 100/100 (one pre-existing warning in
  `paja/src/browser-llm-panel.ts`).
- Playwright (`--workers=1`): conformance, conformance-mutations,
  paja-firewall-rules: 23 passed; conformance-ui: 1 passed.
