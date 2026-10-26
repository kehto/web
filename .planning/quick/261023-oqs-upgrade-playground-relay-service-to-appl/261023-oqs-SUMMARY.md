---
phase: quick-261023-oqs
plan: 01
subsystem: playground
tags: [applesauce, v7, relay, nap-relay]
status: complete
key-files:
  modified:
    - apps/playground/package.json
    - package.json
    - pnpm-lock.yaml
    - apps/playground/src/playground-relay-service.ts
    - tests/unit/playground-relay-service.test.ts
  created:
    - .changeset/playground-applesauce-v7.md
metrics:
  completed: 2026-10-23
---

# Quick 261023-oqs: Playground relay service on applesauce v7

The playground relay service now runs on applesauce-core 7.0.3, applesauce-relay 7.0.0 and applesauce-loaders 7.0.2 with nostr-tools 2.25.2. It uses a RelayLiveness-backed pool, loads kind-10002 mailboxes with `createAddressLoader`, relies on pool-owned timeouts, and tears down only the resources it owns. The public API and NAP-RELAY wire behaviour are unchanged.

## Commits (local, not pushed)

| SHA | Message |
|-----|---------|
| f647c3c8 | chore(playground): bump applesauce to v7 and nostr-tools to 2.25 |
| 40154766 | refactor(playground): adopt applesauce v7 loader, liveness and pool timeouts |
| 95ceff55 | chore(changeset): note playground applesauce v7 upgrade |

The planned two-commit split for Task 2 (refactor, then tests) was collapsed into one commit (40154766). The test file's imports and mock changes are shared between old and new cases, so an intermediate commit would have carried unused imports. The fix for the one aislop lint warning was folded into that commit.

## What changed

- **Dependencies (D-01):** `apps/playground` has `applesauce-core ^7.0.3`, `applesauce-loaders ^7.0.2`, `applesauce-relay ^7.0.0`, `nostr-tools ^2.25.2` and `rxjs ^7.8.2`. The root devDependencies mirror applesauce-core, applesauce-relay and rxjs, and use nostr-tools `^2.25.2`, so `tests/unit` resolves the same instances. No `packages/*` file changed (`git diff main --stat -- packages/` is empty). The store holds exactly one copy each of applesauce-core 7.0.3, applesauce-relay 7.0.0 and applesauce-loaders 7.0.2.
- **Pool (D-02):** when no `relayPool` is injected, the service builds `new RelayPool({ liveness: new RelayLiveness() })` with in-memory liveness only.
- **Mailbox lookup (D-03, D-04):** the store and `!skipCache` worker-cache steps are unchanged. The indexer step now uses a per-call `createAddressLoader`. Its upstream is a recording `requestEvents` wrapper, so the indexer requests still show in `getRelayActivity`. No `cacheRequest` is passed, so `relayCache: 'skip'` still disables cache reads and writes. The lookup is bounded by `takeUntil(timer(requestTimeoutMs))`, errors are caught, and `loader.stop()` runs in `finally`.
- **Request options (D-06):** every `pool.request` call passes `timeout`, `firstResponseTimeout` and `RelayGroup.completeAfterFirstRelay`, all set to `requestTimeoutMs`. This covers the hook `request` path too.
- **Publish (D-07):** the `Promise.race` timeout wrapper is gone. `publishFailureText` returns the first relay `message`, else the first error text (`Error.message` or a string), else `'publish failed'`. It never serialises an error object.
- **Subscription (D-08):** added a comment on the `error` handler. v7 subscriptions never emit EOSE and error with RelayGroupError when every relay fails, and the service reports that as `relay.eose`.
- **Teardown (D-09):** `destroy()` is idempotent. It closes the owned pool, destroys the owned liveness and disposes the event store. It never touches an injected pool.
- **Types (D-10):** `PublishResponse` gained `error?`, and `PlaygroundRelayRequestOptions` was added. `PlaygroundRelayRuntimeOptions` and `PlaygroundRelayRuntime` are unchanged. The descriptor text is unchanged (D-11).
- **Selection module (D-12, D-14):** `playground-relay-selection.ts` is untouched, and `playground-relay-selection.test.ts` passed unchanged on v7, so no expectation changes were needed.

## Deviations and notes

- **D-05 fallback:** not used. The loader path passed every behaviour case, and the old `requestRelays` was removed.
- **D-14 selection change:** none.
- **Existing test edit:** one expectation changed, from `limit: 1` to no `limit`, because the v7 address loader builds `{ kinds: [10002], authors: [...] }` filters. A comment in the test says so. This is the loader-filter change the plan anticipated.
- **Playwright browser (environment, not a code issue):** `playwright.config.ts` defaults to `/usr/bin/chromium`, which is absent on this machine. The first `pnpm test:e2e` run therefore failed to launch the browser (0 tests ran). I re-ran with the config's own env override, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome`. The config is not modified.
- **Playground type-check:** `pnpm type-check` (turbo) does not cover `apps/playground`, which has no type-check script. I ran `npx tsc --noEmit -p apps/playground` separately, and it exited 0.
- **Deferred (D-18):** the reactive outbox map and the `outboxSubscription` / `subscriptionMap` rewrite are out of scope and not implemented.

## v7 `.d.ts` confirmations (installed under `apps/playground/node_modules`)

Every API listed in the plan's `<interfaces>` block was confirmed:

- `applesauce-relay` index re-exports group, liveness, pool and types.
- `RelayPool` accepts `liveness?: PoolLivenessSource | PoolLivenessSource[]` and has `close()`.
- `RelayLiveness` has `filter()` and `destroy()`.
- `RelayGroup.completeAfterFirstRelay(timeout?)` is a static method.
- `GroupRequestOptions` has `timeout`, `firstResponseTimeout?: number | false` and `complete`.
- `PublishResponse` has `error?: unknown`.
- `createAddressLoader(pool: UpstreamPool, opts)` is exported from `applesauce-loaders/loaders`. `UpstreamPool` is `NostrRequest | { request }`, and options include `eventStore`, `lookupRelays` and `bufferTime`. `Loader` has `stop()`.
- `EventStore.getByFilters` and `dispose()` exist.

No discrepancies.

## NAP-RELAY spec check (D-17)

- **Spec:** `naps/NAP-RELAY.md` at the open draft PR napplet/naps#2 "NAP-RELAY: Relay proxy interface", head `9f30b3505335a52c574ff570576687d6467021ff`.
- **master:** `19de5ce1cea40cd4c76089cdd8126e9f87648049`. It has no `NAP-RELAY.md`, so the draft head is the authority.
- **Messages checked:**
  - `relay.subscribe` takes `id`, `subId`, `filters` and `relay?`.
  - `relay.event` carries `subId` and a `result` with a `sidecar.relayHints` sidecar.
  - `relay.eose` carries `subId`.
  - `relay.close` tears down by `subId`.
  - `relay.publish.result` carries `id`, `ok`, and either `event` plus `eventId` or a string `error`.
- **Verdict: conformant, wire behaviour unchanged.**
  - The only observable difference is the content of the failure `error` string, which now falls back from relay `message` to relay error text.
  - The relay-hint path still bypasses relay selection and makes no indexer request.
  - `nip5d-conformance-guard.test.ts` is unchanged and green.
  - The playground still maps a subscription RelayGroupError to `relay.eose` rather than `relay.closed`. That is pre-existing behaviour, and the draft says `relay.closed` is a MAY.

## Gate results

| Gate | Result |
|------|--------|
| `pnpm build` | exit 0 (32 tasks successful) |
| `pnpm type-check` | exit 0 (17 tasks successful) |
| `npx tsc --noEmit -p apps/playground` | exit 0 |
| `pnpm test:unit` | 177 files, 2274 tests passed |
| `pnpm docs:check` | exit 0 (`[audit:docs] OK` for 9 public package docs) |
| `pnpm test:e2e` | 148 passed (5.2m), with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome` |
| `npx aislop@0.12.0 scan --changes --base origin/main` | 100 / 100, no issues |
| `npx aislop@0.12.0 scan` (full) | 95 / 100, the recorded baseline; the 5 warnings are all in `packages/paja` and `packages/services`, none in changed files |
| `git diff --check` | clean |

- **Relay e2e specs:** `nap-relay`, `relay-activity`, `relay-publish`, `relay-publish-encrypted` and `relay-subscribe` all passed.
- **Without the override:** the default `pnpm test:e2e` run failed at browser launch only (see Deviations and notes).
- **Docs sweep:** the only applesauce mention in `*.md` outside `.planning` is a generic line in `packages/nip/src/66/README.md`, which is unchanged. There are no stale `6.0.3`, `6.1.0` or `applesauce-relay@6` references in `docs/` or `apps/playground`.

## Manual check

Not run (no interactive browser session). The `relay-activity`, `relay-subscribe` and `relay-publish` e2e specs cover the indexer-then-outbox relay activity, feed events and publish acknowledgement paths.

## Self-Check: PASSED

The four commits above exist, the changeset exists and names only `@kehto/playground` (patch), and the working tree is clean apart from this untracked planning directory.
