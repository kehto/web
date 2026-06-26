---
status: complete
---

Completed NAP-DM service/adapters branch. Kehto now keeps unpublished NAP-DM wire types local, routes `dm.*` through a runtime-owned service, adds `dm:read`/`dm:write` enforcement and shell capability advertisement, and exposes NIP-17, NDR, and Cordn adapters.

Verification:
- `pnpm exec vitest run packages/services/src/dm-service.test.ts tests/unit/dm-nip17-nak.test.ts packages/acl/src/resolve.test.ts packages/runtime/src/outbox-dispatch.test.ts packages/shell/src/shell-init.test.ts` — 5 files, 211 tests passed.
- `pnpm build` — 32 tasks passed.
- `pnpm type-check` — 17 tasks passed.
- `pnpm test:unit` — 94 files, 1226 tests passed.
- `pnpm docs:check` — TypeDoc/VitePress/docs audit passed.
- `npx aislop scan` — 100/100, no issues.
- `pnpm test:e2e` — 69 Playwright tests passed.
