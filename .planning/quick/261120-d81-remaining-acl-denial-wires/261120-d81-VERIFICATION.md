---
status: passed
---

- `kehto conformance --profile full`: `catalog/acl-denial` passes in both
  variants (17 domains). Before: failed for keys, media, outbox, config, upload.
  Still failing, owned elsewhere: package-drift, relay/semantics (#482),
  cvm/semantics, webrtc/push, broadcast-to-loaded.
- `pnpm build`, `pnpm type-check`, `pnpm docs:check`: green.
- `pnpm test:unit`: 305 files, 3981 tests passed.
- `npx aislop@0.12.0 scan`: 100/100.
- Playwright (`--workers=1`): conformance, conformance-mutations,
  paja-firewall-rules, paja-single-window: 41 passed.
