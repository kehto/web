---
status: passed
---

- New `runtime.test.ts` cases fail on the old handler (5 of the 6; the omitted-scheme case was added after) and pass on the fix.
- `kehto conformance --profile full`: `relay/semantics` passes in both variants
  ("4 relay semantic assertions held"). Still failing, owned elsewhere:
  acl-denial (#481), package-drift, cvm/semantics, webrtc/push,
  broadcast-to-loaded.
- `pnpm build`, `pnpm type-check`, `pnpm docs:check`: green.
- `pnpm test:unit`: 305 files, 3951 tests passed.
- `npx aislop@0.12.0 scan`: 100/100.
- Playwright (`--workers=1`): conformance, conformance-mutations, nap-relay,
  paja-relay: 22 passed.
