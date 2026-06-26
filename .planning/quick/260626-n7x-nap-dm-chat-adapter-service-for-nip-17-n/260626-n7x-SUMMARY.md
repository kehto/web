---
status: complete
---

Completed NAP-DM service/adapters branch. Kehto now keeps unpublished NAP-DM wire types local, routes `dm.*` through a runtime-owned service, adds `dm:read`/`dm:write` enforcement and shell capability advertisement, and exposes NIP-17, NDR, and Cordn adapters. Follow-up verification added relay-backed NDR transport and Cordn coordinator helpers, with local `nak` e2e coverage for all three DM implementations.

Verification:
- `pnpm exec vitest run packages/services/src/dm-service.test.ts tests/unit/dm-nip17-nak.test.ts` — 2 files, 7 tests passed with local `nak` relay available.
- `pnpm build` — 32 tasks passed.
- `pnpm type-check` — 17 tasks passed.
- `pnpm test:unit` — 94 files, 1228 tests passed.
- `pnpm docs:check` — TypeDoc/VitePress/docs audit passed.
- `npx aislop scan` — 100/100, no issues.
- `pnpm test:e2e` — 69 Playwright tests passed.
- `git diff --check` — passed.
