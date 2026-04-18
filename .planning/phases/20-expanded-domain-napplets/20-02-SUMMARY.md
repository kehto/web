---
phase: 20-expanded-domain-napplets
plan: "02"
subsystem: ui
tags: [napplet, relay, subscribe, nostr, feed, vite, typescript]

# Dependency graph
requires:
  - phase: 20-expanded-domain-napplets/20-01
    provides: mock-relay-pool.ts with 5 fixture kind:1 events, queueMicrotask dispatch, EOSE signaling
provides:
  - feed napplet workspace package (@kehto/demo-feed) with full 5-file skeleton
  - relay.subscribe integration: { kinds:[1], limit:5 } subscribed on init
  - DOM sentinel contract: connecting... -> authenticated -> subscribed -> loaded (N)
  - #feed-list renders one <li class="feed-item"> per NostrEvent from mock pool
affects: [20-07-relay-subscribe-spec, 20-expanded-domain-napplets]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-04 init pattern: storage.getItem probe gates on shim AUTH; status set to 'authenticated' after await"
    - "relay.subscribe(filter, onEvent, onEose) with synchronous status set to 'subscribed' after call returns"
    - "textContent-only event content rendering (XSS-safe; no innerHTML for user data)"

key-files:
  created:
    - apps/demo/napplets/feed/package.json
    - apps/demo/napplets/feed/vite.config.ts
    - apps/demo/napplets/feed/tsconfig.json
    - apps/demo/napplets/feed/index.html
    - apps/demo/napplets/feed/src/main.ts
  modified: []

key-decisions:
  - "feed napplet has 0 window.addEventListener occurrences — relay.subscribe is a native SDK call, no postMessage exemption needed (unlike toaster/preferences)"
  - "Status 'subscribed' set synchronously after relay.subscribe returns; onEvent/onEose fire via microtask (matching mock pool contract from Plan 20-01)"
  - "eventCount incremented inside renderEvent; loaded (N) reflects actual rendered count at EOSE time"

patterns-established:
  - "relay.subscribe call site: sub = relay.subscribe(filter, onEvent, onEose) — sub stored for future close() if needed"
  - "renderEvent uses querySelector('.feed-item-content').textContent = event.content — not innerHTML — for XSS safety"

requirements-completed: [NAP-06]

# Metrics
duration: 3min
completed: 2026-04-18
---

# Phase 20 Plan 02: Feed Napplet Summary

**feed napplet (@kehto/demo-feed) — relay.subscribe to { kinds:[1], limit:5 } with DOM sentinel connecting->authenticated->subscribed->loaded(5) and #feed-list rendering 5 fixture events from the Phase 20-01 mock relay pool**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-18T09:20:30Z
- **Completed:** 2026-04-18T09:22:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Complete feed napplet skeleton mirroring composer/preferences/toaster structure (5 files)
- relay.subscribe integrated: { kinds:[1], limit:5 } called exactly once on init via @napplet/sdk
- DOM sentinel contract implemented: connecting... -> authenticated -> subscribed -> loaded (5)
- #feed-list renders one `<li class="feed-item">` per NostrEvent with pubkey prefix + content text
- Build passes (pnpm --filter @kehto/demo-feed build exits 0); TypeScript type-check clean
- 0 window.addEventListener in main.ts (feed needs no postMessage exemption unlike toaster/preferences)

## Task Commits

1. **Task 1: Create feed napplet scaffolding** - `22a696a` (feat)
2. **Task 2: Implement feed napplet main.ts** - `144665f` (feat)

## Files Created/Modified
- `apps/demo/napplets/feed/package.json` - workspace package descriptor; name @kehto/demo-feed
- `apps/demo/napplets/feed/vite.config.ts` - Vite build with nip5aManifest({ nappletType: 'demo-feed' })
- `apps/demo/napplets/feed/tsconfig.json` - identical to composer (strict, bundler, ES2022)
- `apps/demo/napplets/feed/index.html` - #feed-status, #feed-list, #feed-log DOM IDs; feed-item CSS
- `apps/demo/napplets/feed/src/main.ts` - relay.subscribe flow, renderEvent, setStatus/log helpers

## Decisions Made
- 0 window.addEventListener in feed main.ts: relay.subscribe is a native SDK call; no postMessage exemption needed (unlike toaster/preferences). This means Plan 20-07's anti-term grep must assert exactly 0 for feed.
- Status sentinel set synchronously after relay.subscribe returns so the 'subscribed' state is observable before onEvent microtasks fire.
- textContent used (not innerHTML) for event.content in renderEvent to prevent XSS risk from fixture strings.

## Relay.subscribe Call Site
```
line 75: sub = relay.subscribe(
            { kinds: [1], limit: 5 },
            (event: NostrEvent) => { renderEvent(event); ... },
            () => { setStatus(`loaded (${eventCount})`, 'green'); ... },
          );
```
Expected fixture event delivery: 5 kind:1 events from mock-relay-pool.ts FIXTURE_EVENTS array, each delivered via queueMicrotask, EOSE fired after all events queued.

## Anti-term Grep Evidence
- `grep -c "window.addEventListener" apps/demo/napplets/feed/src/main.ts` → **0**
- `grep -v "^\s*\*\|//" main.ts | grep -c "window.nostr\|signer-service\|BusKind\|29001\|29002"` → **0**
- Functional relay.subscribe call sites: **1** (line 75)

## DOM Contract
- `#feed-status` default (HTML): `'connecting...'`
- `#feed-status` after storage.getItem probe resolves: `'authenticated'`
- `#feed-status` after relay.subscribe returns: `'subscribed'`
- `#feed-status` after EOSE fires: `'loaded (5)'` (5 = fixture event count from Plan 20-01)
- `#feed-list li.feed-item` count after EOSE: 5
- Each `<li>` has `data-event-id` attr, `.feed-item-pubkey` (first 8 hex chars), `.feed-item-content` (full event.content)

## Known Stubs
None — all DOM elements are wired to real SDK data. The mock relay pool (Plan 20-01) delivers real fixture events.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None — build, type-check, and all anti-term greps pass on first attempt.

## Next Phase Readiness
- feed napplet is ready for Plan 20-07 (relay-subscribe.spec.ts) to assert the DOM sentinel contract and event rendering
- No blockers for downstream specs

---
*Phase: 20-expanded-domain-napplets*
*Completed: 2026-04-18*
