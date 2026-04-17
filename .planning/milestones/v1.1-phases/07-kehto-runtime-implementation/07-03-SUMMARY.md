---
phase: 07-kehto-runtime-implementation
plan: "03"
subsystem: "@kehto/runtime"
tags: [nip-5d, nub-handlers, relay, signer, storage, ifc, tdd]
dependency_graph:
  requires:
    - phase: 07-02
      provides: [handleMessage-stubs, NUB-dispatch-routing, createNip5dSessionEntry, findEnvelopeResponse]
  provides:
    - handleRelayMessage: subscribe/close/publish/query with relay pool fallback and eose
    - handleSignerMessage: all 7 signer methods with consent gate and service delegation
    - handleStorageMessage: delegates to handleStorageNub with NUB envelope format
    - handleIfcMessage: explicit subscribe/emit/unsubscribe with cross-window delivery
    - handleStorageNub: new NUB-format storage handler in state-handler.ts
    - 44 dispatch tests covering all 4 domains + ACL + lifecycle
  affects:
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/state-handler.ts
    - packages/runtime/src/dispatch.test.ts
    - packages/runtime/src/index.ts
tech_stack:
  added: []
  patterns: [NUB-envelope-response, ifcSubscriptions-Map, NIP-5D-storage-scoping, TDD-green-on-write]
key_files:
  created: []
  modified:
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/state-handler.ts
    - packages/runtime/src/dispatch.test.ts
    - packages/runtime/src/index.ts
key_decisions:
  - "isBusKind check uses filters.length > 0 guard to avoid vacuous true on empty filter arrays"
  - "handleStorageNub placed in state-handler.ts alongside legacy handleStateRequest — both exported"
  - "IFC handler: no ACL response for subscribe/unsubscribe — they are control messages, not data requests"
  - "Signer dispatch: action extracted via slice(1).join('.') to handle nip04.encrypt nested paths"
requirements-completed: [RT-I03]

duration: ~6min
completed: "2026-04-07"
---

# Phase 07 Plan 03: NUB Domain Handler Implementation Summary

**All 4 NUB domain handler stubs replaced with full implementations: relay subscribe/close/publish/query, signer 7-method delegation, storage NUB envelope get/set/remove/clear/keys, IFC subscribe/emit/unsubscribe — 61 tests passing**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-07T22:19:29Z
- **Completed:** 2026-04-07T22:25:46Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

### Task 1: Implement relay, signer, storage, and IFC handlers

- **handleRelayMessage** (relay.subscribe/close/publish/query):
  - `relay.subscribe`: stores subscription, replays buffered events, routes to relay service if registered, falls back to relay pool + cache hooks, sends `relay.eose` when pool unavailable
  - `relay.close`: removes subscription, notifies relay service, untracks from pool, sends `relay.closed`
  - `relay.publish`: replay-detects event, routes to relay service or pool, sends `relay.publish.result`; `relay.publish.error` for invalid event input
  - `relay.query`: counts buffered events matching filters, sends `relay.query.result`
  - Added `ifcSubscriptions` Map for IFC topic subscription management
  - Added IFC cleanup to `destroyWindow()` and `destroy()`

- **handleSignerMessage** (signer.getPublicKey/signEvent/getRelays/nip04.encrypt|decrypt/nip44.encrypt|decrypt):
  - Checks registered signer service first (Phase 9 will migrate service to NUB)
  - Falls back to `hooks.auth.getSigner()` for all 7 methods
  - `signEvent`: consent gate via `_consentHandler` for destructive kinds
  - Result field names: `pubkey` (not publicKey), `event`, `relays`, `ciphertext`, `plaintext`
  - All errors via `${msg.type}.error` suffix

- **handleStorageMessage**: delegates to `handleStorageNub()` in state-handler.ts

- **handleIfcMessage** (ifc.subscribe/unsubscribe/emit):
  - Topic-based pub/sub with `ifcSubscriptions: Map<topic, Set<windowId>>`
  - `emit` delivers to all subscribers except sender
  - `subscribe`/`unsubscribe` are control messages with no response
  - Automatic cleanup on `destroyWindow()` and `destroy()`

- **handleStorageNub** (new function in state-handler.ts):
  - NUB envelope format (NappletMessage in, sendResult/sendError out)
  - Identity lookup via `sessionRegistry.getEntryByWindowId()` (NIP-5D path, pubkey may be empty)
  - Preserved triple-read migration logic for `storage.get`
  - Preserved quota enforcement for `storage.set`
  - Exported from `index.ts` alongside legacy `handleStateRequest`

### Task 2: NIP-5D dispatch test suite (44 new tests, 61 total passing)

- Envelope guard: 6 tests (null, primitives, legacy arrays, no-type, no-dot, unknown domain)
- Message routing: 8 tests covering all 4 domains
- Relay handler: 7 tests (subscribe/eose, close/closed, publish result/error, query count)
- Signer handler: 4 tests (no-signer error, getPublicKey result, signEvent result, ACL bypass)
- Storage handler: 7 tests (get miss, set ok, round-trip, keys, remove, clear, unregistered error)
- IFC handler: 4 tests (subscribe no-response, emit delivery, no-echo-to-sender, unsubscribe)
- ACL enforcement: 3 tests (blocked = .error, getPublicKey bypass, ifc default grant)
- Lifecycle: 5 tests (destroy/destroyWindow IFC cleanup, service register/unregister)

## Task Commits

1. **Task 1: Implement all 4 NUB domain handlers** - `15c839c` (feat)
2. **Task 2: NIP-5D dispatch test suite** - `50128d1` (test)
3. **Fix: Promise.resolve() flushes for async signer tests** - `3fc1770` (fix)

## Files Created/Modified

- `packages/runtime/src/runtime.ts` — All 4 handler stubs replaced with full implementations; ifcSubscriptions Map added
- `packages/runtime/src/state-handler.ts` — New handleStorageNub() function added alongside legacy handleStateRequest
- `packages/runtime/src/dispatch.test.ts` — 44 new tests covering all 4 NUB domains, ACL, and lifecycle
- `packages/runtime/src/index.ts` — handleStorageNub added to exports

## Decisions Made

- `isBusKind` uses `filters.length > 0 && filters.every(...)` guard — prevents vacuous true on empty filter arrays (which would incorrectly classify empty subscriptions as bus subscriptions)
- `handleStorageNub` lives in `state-handler.ts` alongside `handleStateRequest` — both are exported; the legacy function is kept for any callers that haven't migrated yet
- IFC subscribe/unsubscribe have no response messages — they are control operations, not data requests (consistent with NIP-5D spec)
- Signer action extracted via `msg.type.split('.').slice(1).join('.')` to correctly handle nested paths like `nip04.encrypt` (dot is part of the action name, not a separator)
- Async signer tests use `Promise.resolve()` flushes instead of `setTimeout` — `setTimeout` is not in the ES2022 lib type declarations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: setTimeout not declared in test file**
- **Found during:** Task 2 TypeScript verification
- **Issue:** Test file used `await new Promise((r) => setTimeout(r, 10))` to flush async signer methods, but `setTimeout` is not in the ES2022 lib (runtime.ts declares it for source files but tests don't include that declaration)
- **Fix:** Replaced with `await Promise.resolve(); await Promise.resolve();` to flush microtasks — sufficient for single-level promise chains in the signer handler
- **Files modified:** `packages/runtime/src/dispatch.test.ts`
- **Verification:** TypeScript compiles clean, 61 tests pass
- **Committed in:** `3fc1770`

**2. [Rule 1 - Bug] Pre-existing @kehto/shell build failure (out of scope)**
- **Found during:** Full `pnpm build` verification
- **Issue:** `packages/shell/src/shell-bridge.ts` references `runtime.sendChallenge()` which was removed in Plan 02. Full monorepo build fails for `@kehto/shell`.
- **Scope:** Pre-existing from Plan 02 (d22cb0a removed sendChallenge from Runtime interface). Not caused by Plan 03 changes.
- **Resolution:** Logged to deferred-items; `@kehto/runtime` package builds and tests cleanly. Shell migration is planned for Phase 08.
- **Verification:** `npx tsc --noEmit -p packages/runtime/tsconfig.json` passes; all 61 runtime tests pass.

---

**Total deviations:** 1 auto-fixed (Rule 1 — test compilation bug), 1 out-of-scope pre-existing issue documented

## Issues Encountered

None beyond the auto-fixed TypeScript issue — all handler implementations compiled cleanly on first attempt.

## Known Stubs

None — all 4 handler stubs from Plan 02 have been fully implemented.

## Next Phase Readiness

- Phase 08 (shell): `shell-bridge.ts` references removed `sendChallenge` — this is the primary blocker for shell migration
- All NUB domain handlers are production-ready
- Storage scoping and quota logic preserved verbatim from legacy `handleStateRequest`
- IFC subscription lifecycle is complete with destroy cleanup

## Self-Check: PASSED

- FOUND: packages/runtime/src/runtime.ts
- FOUND: packages/runtime/src/state-handler.ts
- FOUND: packages/runtime/src/dispatch.test.ts
- FOUND: packages/runtime/src/index.ts
- FOUND: .planning/phases/07-kehto-runtime-implementation/07-03-SUMMARY.md
- FOUND commit: 15c839c (Task 1 - handler implementation)
- FOUND commit: 50128d1 (Task 2 - dispatch tests)
- FOUND commit: 3fc1770 (Fix - setTimeout → Promise.resolve)

---
*Phase: 07-kehto-runtime-implementation*
*Completed: 2026-04-07*
