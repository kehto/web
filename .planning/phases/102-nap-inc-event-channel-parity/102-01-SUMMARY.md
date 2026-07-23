---
phase: 102-nap-inc-event-channel-parity
plan: 01
subsystem: runtime
tags: [nap-inc, nip-5d, web-projection, dtag, vitest]
requires:
  - phase: 101-nap-shell-session-integrity
    provides: Source-bound NIP-5D session registration and trusted dTag identities.
provides:
  - INC canonical event tracer from injected web prelude through runtime fan-out.
  - Projection-owned convention URI query transposition for INC emit.
  - Runtime-attested dTag senders with exact stable-topic routing.
affects: [102-02, 102-04, 102-05, 102-06, 104-intent]
tech-stack:
  added: []
  patterns: [serialized prelude helper, exact Map topic routing, session-attested sender identity]
key-files:
  created: [tests/unit/nap-inc-conformance.test.ts]
  modified: [packages/shell/src/napplet-namespace.ts, packages/runtime/src/inc-handler.ts, packages/runtime/src/dispatch.test.ts]
key-decisions:
  - "Convention query transposition is serialized in the injected web prelude and never performed by the runtime router."
  - "inc.event sender is derived solely from the authenticated source session dTag."
patterns-established:
  - "Convention URI binding: convert only napplet: query URIs before fire-and-forget wire emission; retain literal plus characters."
  - "INC event fan-out: lookup only the complete stable topic and exclude the emitting window."
requirements-completed: [BASE-04, BASE-05, INC-01, INC-02, INC-03, INC-04, INC-08]
coverage:
  - id: D1
    description: Canonical queried INC emit becomes a queryless stable topic with decoded text payload before crossing the web wire boundary.
    requirement: BASE-04
    verification:
      - kind: integration
        ref: tests/unit/nap-inc-conformance.test.ts#transposes before the wire and preserves exact routing
        status: pass
    human_judgment: false
  - id: D2
    description: Exact runtime topic routing emits one recipient event with the source session dTag and no source echo.
    requirement: INC-03
    verification:
      - kind: integration
        ref: tests/unit/nap-inc-conformance.test.ts#transposes before the wire and preserves exact routing
        status: pass
    human_judgment: false
  - id: D3
    description: Sessionless INC emit, subscribe, and channel-open envelopes are inert at runtime ingress.
    requirement: INC-08
    verification:
      - kind: unit
        ref: packages/runtime/src/dispatch.test.ts#fails closed for sessionless INC emit, subscribe, and channel open
        status: pass
    human_judgment: false
duration: 4min
completed: 2026-07-23
status: complete
---

# Phase 102 Plan 01: Canonical INC Event Tracer Summary

**One canonical `napplet:` INC emit now transposes in the injected web prelude and reaches exact runtime subscribers as a dTag-attested event.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-23T17:29:15Z
- **Completed:** 2026-07-23T17:33:00Z
- **Tasks:** 1/1
- **Files modified:** 4

## Accomplishments

- Added an executable cross-package tracer pinned to NAP-INC draft PR #89 head `4593ce9e301ce098fd3dad64206fcd6f144fa7af` and web projection PR #90 head `896c32c92deee68dc4d10fc1132b62df20cccb6f`.
- Added one prelude-owned convention URI helper that strips the query, percent-decodes text values, preserves literal `+`, and posts only the stable `napplet:` topic for canonical INC emits.
- Changed INC event fan-out to use exact topic lookup and a source session dTag, ignoring any caller-provided sender and excluding the source window.
- Proved sessionless INC emit, subscribe, and channel-open messages have no effect at runtime ingress.

## Task Commits

1. **Task 1: Trace one canonical convention emit to an exact dTag event (RED)** - `57b8610` (test)
2. **Task 1: Trace one canonical convention emit to an exact dTag event (GREEN)** - `cdbda39` (feat)

## Files Created/Modified

- `tests/unit/nap-inc-conformance.test.ts` - Cross-package injected-prelude to runtime tracer.
- `packages/shell/src/napplet-namespace.ts` - Serialized convention URI transposition helper wired only to INC emit.
- `packages/runtime/src/inc-handler.ts` - Exact fan-out with session-derived dTag sender identity.
- `packages/runtime/src/dispatch.test.ts` - Sessionless ingress regression and dTag sender expectations.

## Decisions Made

- Checked NAP-INC draft PR #89 at `4593ce9e301ce098fd3dad64206fcd6f144fa7af` and web projection PR #90 at `896c32c92deee68dc4d10fc1132b62df20cccb6f`; this tracer is conformant with their proposed authority.
- Retained the existing legacy three-argument INC emit compatibility path while the new canonical two-argument path owns convention URI transposition; no intent behavior changed.
- Kept all query parsing out of `inc-handler.ts`; raw query-bearing wire topics remain opaque and cannot match a queryless subscription.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Compatibility] Preserved the existing legacy INC emit call shape**
- **Found during:** Task 1
- **Issue:** Replacing the legacy three-argument implementation outright broke the existing injected namespace regression suite.
- **Fix:** Kept its parsing behavior for three arguments while adding the canonical two-argument prelude path.
- **Files modified:** `packages/shell/src/napplet-namespace.ts`
- **Verification:** `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` (17 passed)
- **Committed in:** `cdbda39`

**Total deviations:** 1 auto-fixed (Rule 1 compatibility)

## Issues Encountered

- The local AI-slop executable is not present, so its gate was not run; no package was installed to obtain it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 102 can extend this tracer into channel completeness without adding a second topic parser.
- Phase 104 can reuse the prelude helper for intent after its own planned scope begins.

## Self-Check

PASSED - all four task files exist, both TDD commits are present, and `git diff --check` passed.
