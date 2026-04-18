---
phase: 20-expanded-domain-napplets
plan: "01"
subsystem: demo
tags: [relay, mock, fixture, nostr, napplet, feed]

requires:
  - phase: 19-core-domain-napplets
    provides: ShellAdapter.relayPool slot wired in createDemoHooks() — replaced by mock in this plan

provides:
  - In-memory mock relay pool (apps/demo/src/mock-relay-pool.ts) satisfying ShellAdapter.relayPool shape
  - 5 deterministic kind:1 fixture events for feed napplet delivery and Playwright spec assertions
  - createMockRelayPool() wired into createDemoHooks() replacing the no-op stub

affects:
  - 20-02 (feed napplet — relay.subscribe delivers fixture events)
  - 20-07 (relay-subscribe.spec.ts — uses fixture events for deterministic E2E assertion)

tech-stack:
  added: []
  patterns:
    - "queueMicrotask dispatch: onevent/oneose callbacks fired after subscribe() returns (mirrors real relay behavior)"
    - "Neutral JSDoc phrasing for anti-feature references (extends Phase 18/19 decision)"

key-files:
  created:
    - apps/demo/src/mock-relay-pool.ts
  modified:
    - apps/demo/src/shell-host.ts

key-decisions:
  - "NostrEvent/NostrFilter imported from @kehto/shell (re-export) — no direct @napplet/core dep added to apps/demo"
  - "Microtask dispatch for onevent/oneose so runtime's subscription dispatcher sees events AFTER subscribe() returns"
  - "Minimal filter matching (kinds + limit only) — other filter fields intentionally deferred for v1.3"

patterns-established:
  - "Mock relay pool pattern: SimplePool-shaped object with queueMicrotask dispatch — reusable template for Playwright test stubs"

requirements-completed:
  - NAP-06

duration: 2min
completed: 2026-04-18
---

# Phase 20 Plan 01: In-Memory Mock Relay Pool Summary

**In-memory SimplePool-shaped mock relay pool with 5 kind:1 fixture events, wired into createDemoHooks() to unblock feed napplet relay.subscribe delivery**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-18T09:15:50Z
- **Completed:** 2026-04-18T09:18:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `apps/demo/src/mock-relay-pool.ts` (219 lines) exporting `createMockRelayPool()` conforming to `ShellAdapter.relayPool` shape
- 5 deterministic kind:1 fixture events with varied content, pubkeys, and time-ordered `created_at` values
- On relay.subscribe: emits matching events via `queueMicrotask` then EOSE — events arrive after subscribe() returns (mirrors real relay behavior)
- On relay.publish: stores event in module-level `publishedEvents[]`, returns `[Promise.resolve('ok')]`
- Replaced no-op inline stub in `createDemoHooks()` with `createMockRelayPool()` — single-line replacement
- `pnpm build` produces 102 modules (vs 101 before — mock-relay-pool.ts bundled), zero errors

## Mock Relay Pool API Surface

```
createMockRelayPool() returns MockRelayPool:
  - getRelayPool()            → SimplePool-shaped object
    - subscription(relays, filters, options) → { close: () => void }
    - publish(relays, event)               → Promise<string>[]
    - request(relays, filters)             → no-op handle
  - trackSubscription()       → void
  - untrackSubscription()     → void
  - openScopedRelay()         → void
  - closeScopedRelay()        → void
  - publishToScopedRelay()    → false
  - selectRelayTier()         → string[]
  - getPublishedEvents()      → NostrEvent[]  (debug/future test use)
```

## Fixture Event Reference (for Plan 20-07 spec assertions)

| # | id | pubkey | content | created_at |
|---|----|---------|---------| -----------|
| 1 | `'1'.repeat(64)` | `aaaa0000...000aa` | "Welcome to the kehto demo!" | now - 4 |
| 2 | `'2'.repeat(64)` | `bbbb0000...000bb` | "NIP-5D ships in v1.3 — 8 nub domains end-to-end" | now - 3 |
| 3 | `'3'.repeat(64)` | `cccc0000...000cc` | "feed napplet subscribes; EOSE marks loaded" | now - 2 |
| 4 | `'4'.repeat(64)` | `dddd0000...000dd` | "composer + preferences + toaster cover core domains" | now - 1 |
| 5 | `'5'.repeat(64)` | `eeee0000...000ee` | "theme-switcher broadcasts; preferences observes" | now |

All events: kind 1, tags `[['t', 'demo-feed']]`, sig `'0'.repeat(128)`.

## Microtask Dispatch Decision

`options.onevent(event)` is invoked via `queueMicrotask()`, not synchronously in the subscription loop. This matches real relay behavior where events arrive asynchronously after the subscription handle is returned. The `oneose` callback is also queued via `queueMicrotask()` after all onevent microtasks, preserving ordering.

## Anti-Feature Grep Results

- `grep -c "window\.addEventListener" apps/demo/src/mock-relay-pool.ts` → 0
- `grep -c "window\.nostr\|signer-service\|BusKind" apps/demo/src/mock-relay-pool.ts` → 0

## Task Commits

1. **Task 1: Create mock-relay-pool.ts** - `2cf7009` (feat)
2. **Task 2: Wire createMockRelayPool() into shell-host.ts** - `5059f30` (feat)

**Plan metadata:** (docs commit — see final_commit below)

## Files Created/Modified

- `apps/demo/src/mock-relay-pool.ts` — New: in-memory mock relay pool, 219 lines, exports `createMockRelayPool()`
- `apps/demo/src/shell-host.ts` — Modified: added import + replaced inline relayPool stub with `createMockRelayPool()` call + JSDoc

## Decisions Made

- **NostrEvent/NostrFilter from @kehto/shell:** The shell package re-exports both types from `@napplet/core`. Using this re-export avoids adding a direct `@napplet/core` dep to `apps/demo/package.json` (Pitfall 4 — dedupe risk).
- **Minimal filter matching:** Only `kinds` and `limit` checked; `authors`, `since`, `until`, `#t` ignored for v1.3. The feed napplet uses `{kinds:[1], limit:5}` which the matcher handles correctly.
- **queueMicrotask for dispatch:** Ensures subscription handle is returned to caller before events are delivered — prevents edge cases where runtime state is not yet initialized when the first onevent fires.

## Deviations from Plan

None — plan executed exactly as written. The anti-feature comment wording was adjusted to use neutral phrasing (per established Phase 18/19 decision) to prevent false-positive grep matches in acceptance criteria verification.

## Issues Encountered

None.

## Known Stubs

None in this plan's scope — `createMockRelayPool()` is the replacement for the stub, not a new stub. The `getPublishedEvents()` helper is a forward-compatible debug accessor (not a stub that affects plan goal achievement).

## Next Phase Readiness

- Plan 20-02 (feed napplet) can now call `sdk.relay.subscribe({ kinds: [1], limit: 5 })` and receive all 5 fixture events + EOSE
- Plan 20-07 (relay-subscribe.spec.ts) has deterministic fixture values documented above for assertion writing
- No blockers introduced

---
*Phase: 20-expanded-domain-napplets*
*Completed: 2026-04-18*
