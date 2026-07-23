---
phase: 102-nap-inc-event-channel-parity
plan: 04
subsystem: shell-prelude
tags: [nap-inc, nip-5d, convention-uri, channels, postmessage]
requires:
  - phase: 102-01
    provides: Canonical INC runtime event and channel wire routing
provides:
  - Shared convention URI normalizer for the serialized web prelude
  - Replacement-safe canonical INC emit, subscription, and symmetric channel client API
affects: [104-nap-intent-convention-binding, 105-published-napplet-package-adoption, paja, playground]
tech-stack:
  added: []
  patterns: [serialized prelude normalizer, retained symmetric channel handles, shared topic subscription lifetime]
key-files:
  created: []
  modified:
    - packages/shell/src/napplet-namespace.ts
    - packages/shell/src/napplet-namespace.test.ts
key-decisions:
  - "NAP-INC #89 (4593ce9), web projection #90 (896c32c), and symmetric channels #92 (c5cd06f) are the authority."
  - "Convention query parsing remains projection-side and only wires INC in this plan; intent remains untouched for Phase 104."
  - "INC assignment merges extension fields but always restores Kehto-owned emit, on, and channel operations."
patterns-established:
  - "Normalize convention URI query text once before postMessage; route only the stable queryless identity."
  - "Retain inbound channel handles, early events, and terminal closure locally with finite overflow close behavior."
requirements-completed: [BASE-04, BASE-05, INC-01, INC-02, INC-05, INC-07, INC-08]
coverage:
  - id: D1
    description: Canonical convention emit normalization, local rejection, protected assignment, and exact topic subscriptions
    requirement: INC-02
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#normalizes canonical INC conventions, protects INC assignment, and shares topic subscriptions
        status: pass
    human_judgment: false
  - id: D2
    description: Symmetric correlated channel handles with retention, closure, and fire-and-forget envelopes
    requirement: INC-05
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#provides symmetric correlated INC channel handles with retained lifecycle state
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-23
status: complete
---

# Phase 102 Plan 04: Shared INC Prelude Client Summary

**A replacement-safe shared NAP-INC browser binding now normalizes convention URIs and exposes symmetric, retained channel handles for both Paja and playground.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-23T17:49:32Z
- **Completed:** 2026-07-23T17:55:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced legacy Nostr-flavored INC calls with canonical emit and exact `IncEvent` subscriptions, including decode-once convention URI payload transposition and local rejection before posting.
- Preserved Kehto-owned INC operations across INC-domain and whole-namespace assignment while retaining unrelated extension fields.
- Added correlated open/list, inbound `onOpened`, and symmetric channel handles with bounded early-event, unopened-handle, and terminal-close retention.

## Task Commits

1. **Task 1: Complete the shared replacement-safe binding, canonical emit, and topic subscriptions**
   - `c5ca660` test RED: canonical binding coverage
   - `1d12881` feature GREEN: normalized protected INC bindings
2. **Task 2: Add symmetric correlated/pushed channel handles and retained lifecycle**
   - `67cf6a4` test RED: symmetric channel coverage
   - `e49e1bf` feature GREEN: symmetric INC channel handles

## Files Created/Modified

- `packages/shell/src/napplet-namespace.ts` — serialized normalizer, protected INC API, subscription correlation, and retained symmetric channel client.
- `packages/shell/src/napplet-namespace.test.ts` — executed-prelude matrices for parsing, replacement, correlation, lifecycle retention, and overflow closure.

## Decisions Made

- Checked NAP-INC #89 at `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, web projection #90 at `896c32c92deee68dc4d10fc1132b62df20cccb6f`, and symmetric clarification #92 at `c5cd06f7be6d4690b303949abb26e87ff62f4729`; the implementation conforms to their INC binding shapes.
- Kept `makeIntent` and its assignment behavior unchanged. The normalizer is outside `makeInc` for Phase 104 reuse but is wired only to INC here.
- Chose a 32-entry bound for retained unopened handles and early messages; overflow sends `inc.channel.close` and retains a local terminal notification instead of silently dropping traffic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm docs:check` completed its API/site build but failed its existing package-page audit because `docs/packages/paja.md` is missing the current `| Version | \`0.8.1\` |` row. This is outside this plan's shell-prelude ownership and was deferred unchanged.
- The repository's configured AI-slop executable is unavailable both locally and on `PATH`; no package was installed because this plan forbids package installation.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` — passed (19 tests)
- `pnpm --filter @kehto/shell type-check` — passed
- `pnpm build` — passed
- `pnpm type-check` — passed
- `pnpm test:unit` — passed (107 files, 1335 tests)
- `pnpm docs:check` — failed on the pre-existing Paja package-documentation version row; no in-scope documentation surface changed
- AI-slop gate — not run because no `aislop` executable is installed or available on `PATH`

## Next Phase Readiness

Phase 104 can reuse `normalizeConventionUri` for NAP-INTENT without changing this canonical INC binding. Phase 105 remains responsible for published package adoption.

## Self-Check: PASSED

- Found both modified shell prelude files and all four task commits.

---

*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-23*
