---
status: passed
---

- Repro: the new `policy-denials.test.ts` Firewall rows failed on staging
  `99353c60` with `<type>.error` for all seven domains; identity already passed.
- `kehto conformance --profile full`: `catalog/firewall-denial` passes in both
  variants (25 domains); `catalog/acl-denial` still passes. With the runtime
  rows reverted it fails for link, common, lists, serial, ble, webrtc and
  gamepad. Remaining failures are the known `catalog/package-drift` and
  `relay/semantics`. `--profile minimal`: all pass.
- `pnpm build`, `pnpm type-check`, `pnpm docs:check`: green.
- `pnpm test:unit`: 309 files, 4087 tests passed.
- `npx aislop@0.12.0 scan`: 100/100 (one pre-existing warning in
  `paja/src/browser-llm-panel.ts`).
