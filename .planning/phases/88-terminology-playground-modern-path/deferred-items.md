# Phase 88 — Deferred Items

Items discovered during execution but out of the current plan's scope. Tracked
for the owning plan/wave.

## From 88-03 (NAP migration of runtime packages)

The four target packages (`@kehto/acl`, `@kehto/runtime`, `@kehto/services`,
`@kehto/shell`) build, type-check, and test green against `@napplet/core@0.12` +
`@napplet/nap@0.12`. The **full** `pnpm build` (24 tasks) reports 9 successful /
15 failed. All 15 failures are downstream chunks that depend on this wave-1
runtime migration and are owned by other plans:

### 88-04 — test fixtures (`tests/fixtures/napplets/nub-*`)
Their `package.json` deps were already bumped to `@napplet/nap@0.12` (commit
95fa20c, removing `@napplet/nub`), but their **source** still imports
`@napplet/nub/<domain>/sdk`. Vite/Rollup cannot resolve the removed package.
- `@kehto/fixture-nub-storage`  — `@napplet/nub/storage/sdk` unresolved
- `@kehto/fixture-nub-relay`    — `@napplet/nub/relay/sdk` unresolved
- `@kehto/fixture-nub-theme`    — `@napplet/nub/theme/sdk` unresolved
- `@kehto/fixture-nub-notify`   — `@napplet/nub/notify/sdk` unresolved
- `@kehto/fixture-nub-identity` — `@napplet/nub/identity/sdk` unresolved
- `@kehto/fixture-nub-ifc`      — `@napplet/nub/ifc/sdk` unresolved
**Fix (88-04):** migrate fixture `src/main.ts` imports to `@napplet/nap/<domain>/sdk`.

### 88-01 — playground demo napplets (`apps/playground/napplets/*`)
Fail in `@napplet/vite-plugin@0.8.0`'s `assertNoInlineScripts` build contract
(a 0.8.0 change), not the nub→nap rename.
- demo-bot, demo-chat, demo-composer, demo-cvm-relatr, demo-feed,
  demo-preferences, demo-profile-viewer, demo-resource-demo, demo-toaster
**Fix (88-01):** adapt demo napplet HTML/build to the @napplet/vite-plugin@0.8.0
no-inline-script contract.

## Gate-wording note (88-03 gate #1)
Gate #1 literally reads `rg "@napplet/nub" packages/*/src returns ZERO matches`,
but the plan's must_have truth and Task 1 scope it to import **specifiers**.
Zero `@napplet/nub` *import specifiers* remain. 25 `@napplet/nub` references
remain in **doc comments / one error string**, where they accurately document
the back-compat dual-emit (the `nubs` array exists specifically to serve
`@napplet/nub` consumers). Rewording them would falsify the code's behavior, so
they were intentionally preserved. The substantive requirement is met.
