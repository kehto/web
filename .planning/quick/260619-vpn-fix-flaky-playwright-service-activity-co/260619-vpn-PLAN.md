---
quick_id: 260619-vpn
slug: fix-flaky-playwright-service-activity-co
status: complete
created_at: 2026-06-19T20:49:59.028Z
---

# Fix Flaky Playwright Service Activity Counter Wait

## Goal

Repair PR #63's failing Playwright job by making the shell UI state counter spec
wait for the documented counter floor instead of only waiting for the counter
elements to exist.

## Evidence

CI failure: Playwright job in PR #63 failed
`tests/e2e/shell-ui-state-surfaces.spec.ts` with `storage activity: 0` /
`relay activity: 0`.

Local reproduction:
`CI=true pnpm exec playwright test tests/e2e/shell-ui-state-surfaces.spec.ts`
reported the first test as flaky: first attempt failed with `storage activity:
0`, retry passed.

## Plan

Patch the test poll so it returns only when storage, relay, and identity
counters are all `>= 1`. Keep the final explicit assertions for useful failure
messages.

## Result

Updated `tests/e2e/shell-ui-state-surfaces.spec.ts` so the Playwright poll waits
for the service activity counters to satisfy the same documented floor asserted
by the final failure-message checks.

## Verification

- `CI=true pnpm exec playwright test tests/e2e/shell-ui-state-surfaces.spec.ts`
- `CI=true pnpm test:e2e`
- `pnpm type-check`
- `pnpm test:unit`
- `git diff --check`
- `npx aislop scan` (exit 0; existing 82/100 warnings are outside this test)
