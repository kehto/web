---
status: complete
completed: 2026-06-10T22:23:06Z
quick_id: 260610-xa6
description: Implement playground relay service with applesauce, @snort/worker-relay caching, NIP-65 outbox resolution, relay hints, and NIP-66 relay attribute groups
---

# Quick Task 260610-xa6 Summary

## Result

- Registered a concrete playground `relay` service through the existing runtime `ServiceHandler` seam.
- Added an Applesauce-backed relay runtime with local EventStore state, real RelayPool subscriptions/publishing, worker-relay cache coordination, and publish-result envelopes.
- Added NIP-65 mailbox resolution for author outboxes and recipient inboxes, relay-hint support from filters/events, and NIP-66 role routing for `Indexer` and `RelayIndexer` relays.
- Moved deterministic playground seed data into `playground-relay-fixtures.ts`; `mock-relay-pool.ts` remains a mock utility and is no longer imported by `demo-hooks.ts`.

## Simplifications

- Reused the existing runtime `relay` service stub instead of adding a napplet-side protocol path.
- Kept relay selection as pure functions with focused unit coverage rather than embedding all decisions inside service side effects.
- Stopped live relay fanout once the local seed cache satisfies a finite subscription limit, preserving deterministic playground demos while keeping real relay behavior for cache misses.

## Verification

- `pnpm --filter @kehto/nip66 test:unit` passed: 14 tests.
- `pnpm exec vitest run tests/unit/playground-relay-selection.test.ts packages/nip66/src/index.test.ts` passed: 20 tests.
- `pnpm exec vitest run tests/unit/playground-relay-service.test.ts` passed: 6 tests.
- `pnpm exec vitest run tests/unit/playground-relay-service.test.ts tests/unit/playground-relay-selection.test.ts packages/nip66/src/index.test.ts` passed: 26 tests.
- `pnpm --filter @kehto/nip66 build` passed.
- `pnpm --filter @kehto/playground build` passed and emitted the `worker-*.mjs` worker-relay bundle.
- `npx playwright test tests/e2e/relay-subscribe.spec.ts tests/e2e/nip66-suggestions.spec.ts tests/e2e/relay-publish.spec.ts` passed: 4 tests.
- `npx playwright test tests/e2e/nip66-suggestions.spec.ts` passed after fixture-module wording cleanup.
- `npx playwright test tests/e2e/relay-subscribe.spec.ts` passed after the per-filter cache limit gate was tightened.

## Remaining Risks

- `pnpm --filter @kehto/playground exec tsc --noEmit` still fails on pre-existing strictness issues in ACL, consent, signer, and shell-host files; the relay-service-specific errors disappeared after rebuilding `@kehto/nip66`.
- Live public relay availability is intentionally best-effort; cache misses may depend on relay reachability and timeout behavior.
