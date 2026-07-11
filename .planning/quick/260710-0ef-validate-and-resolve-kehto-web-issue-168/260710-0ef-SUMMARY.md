---
status: complete
completed: 2026-07-09
branch: fix/outbox-relay-hints-issue-168
---

# Quick Task 260710-0ef Summary

Validated and fixed kehto/web#168. Authorless `outbox.query` calls with
`options.relays` now target the host fallback relay plan plus the caller relay
hints, instead of allowing hints to replace fallback policy accidentally.

## Changes

- Changed `resolvePlan` in `@kehto/services` to resolve host-owned relays first,
  use fallback relays when no author-derived relays are available, and merge
  validated caller hints afterward.
- Added a regression test proving authorless query hints augment fallback relays.
- Added a patch changeset for `@kehto/services`.
- Repaired package docs version rows already stale on current `origin/main` so
  `pnpm docs:check` can pass for this PR.

## Verification

- Red check before the fix: `pnpm exec vitest run packages/services/src/relay-pool-outbox-router.test.ts`
  failed because only `wss://hint` was targeted.
- `pnpm exec vitest run packages/services/src/relay-pool-outbox-router.test.ts` — 25 passed.
- `pnpm build`
- `pnpm type-check`
- `pnpm test:unit` — 102 files, 1300 tests.
- `pnpm lint` — exited 0; no Turbo lint tasks are currently configured.
- `pnpm docs:check`
- `npx aislop scan --changes --base origin/main` — clean 100/100.
- `git diff --check`

## Notes

Full `npx aislop scan` reports 93/100 due to pre-existing findings in
`packages/shell/src/napplet-namespace.ts`; the changed-file scan for this PR is
clean.
