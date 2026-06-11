---
status: complete
completed: 2026-06-11T00:43:22Z
quick_id: 260611-3pq
description: Adapt Kehto playground feed napplet to Hyprgate-style identity and shell relay flow
---

# Quick Task 260611-3pq Summary

## Result

- Inspected Hyprgate's feed at `/home/sandwich/Develop/hyprgate/napps/feed`.
- Matched the important architecture: identity is resolved at the napplet boundary, relay work routes through the shell helper, and the napplet does not own a relay pool.
- Added `apps/playground/napplets/feed/src/feed-store.ts` as a pure TypeScript feed store for shell `relaySubscribe` lifecycle, event dedupe, newest-first ordering, and cleanup.
- Kept Kehto scoped to the active user feed: timeline and live subscriptions both request kind 1 events with `authors: [pubkey]`.
- Updated E2E and static guards for the logged-out sentinel and the new store boundary.

## Simplifications

- Removed relay subscription details from `main.ts`; it now handles identity, rendering, and lifecycle only.
- Reused the existing direct NAP helpers instead of introducing Svelte, `@napplet/sdk`, IFC auth topics, or a per-napplet relay pool.
- Kept the feed UI small while moving behavior into a unit-testable store.

## Verification

- `pnpm exec vitest run tests/unit/playground-feed-store.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts` passed: 15 tests.
- `pnpm test:unit` passed: 38 test files, 588 tests.
- `pnpm --filter @kehto/demo-feed build` passed.
- `pnpm --filter @kehto/playground build` passed.
- `npx playwright test tests/e2e/relay-subscribe.spec.ts tests/e2e/gateway-artifact-parity.spec.ts tests/e2e/nip66-suggestions.spec.ts` passed: 4 browser tests.
- `npx aislop scan` passed: `100 / 100 Healthy`, no issues.
- `git diff --check` passed.

## Remaining Risks

- `pnpm --filter @kehto/playground exec tsc --noEmit` still fails on existing playground strictness issues outside this feed adaptation: ACL labels, consent-modal request typing, ShellAdapter excess props, DOM nullability, signer casts, and shell-host undefined checks.
