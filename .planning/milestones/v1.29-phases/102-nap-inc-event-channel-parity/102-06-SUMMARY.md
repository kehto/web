---
phase: 102-nap-inc-event-channel-parity
plan: 06
subsystem: playground-inc-conformance
tags: [nap-inc, playground, playwright, nip-5d, channels, srcdoc]
requires:
  - phase: 102-04
    provides: Shared replacement-safe INC namespace binding with retained symmetric handles
  - phase: 101-05
    provides: Trusted identity registration before playground srcdoc execution
provides:
  - Static guard for trusted playground INC prelude ownership and shim-safe replacement
  - Two-frame browser proof of exact INC event routing, attested dTags, and retained symmetric channels
affects: [102-07, 102-08, phase-102-verification, playground]
tech-stack:
  added: []
  patterns: [isolated IPv6 Playwright preview override, real-frame INC conformance proof]
key-files:
  created:
    - tests/e2e/nap-inc-playground.spec.ts
  modified:
    - tests/unit/playground-gateway-guard.test.ts
key-decisions:
  - "NAP-INC #89 (4593ce9), web projection #90 (896c32c), and symmetric channels #92 (c5cd06f) remain the exact authority for this browser proof."
  - "The browser proof uses public window.napplet.inc handles for all normal traffic; raw envelopes occur only for required forged-sender and raw-query negative vectors."
  - "Focused verification selects an IPv6 preview through KEHTO_PLAYGROUND_BASE_URL so an unrelated IPv4 listener on 127.0.0.1:4174 is never used or stopped."
patterns-established:
  - "Use two already-loaded opaque-origin playground frames as neutral INC endpoints rather than adding a host-specific test client."
  - "Exercise onOpened, on, and onClosed retention through a real host push before handler attachment."
requirements-completed: [BASE-04, BASE-05, INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, INC-07, INC-08]
coverage:
  - id: D1
    description: Playground registers creation-time identity and environment before the shared replacement-safe INC prelude executes.
    requirement: BASE-04
    verification:
      - kind: unit
        ref: tests/unit/playground-gateway-guard.test.ts#registers the trusted INC environment before the shared replacement-safe prelude executes
        status: pass
    human_judgment: false
  - id: D2
    description: Two live trusted dTag frames prove exact event routing, sender attestation, raw-query isolation, symmetric channel handles, retained lifecycle, and inert post-close traffic.
    requirement: INC-05
    verification:
      - kind: e2e
        ref: tests/e2e/nap-inc-playground.spec.ts#two live playground frames retain exact NAP-INC events and symmetric channel lifecycle
        status: pass
    human_judgment: false
duration: 4min
completed: 2026-07-23
status: complete
---

# Phase 102 Plan 06: Playground INC Event and Channel Parity Summary

**Two real opaque-origin playground frames now prove canonical INC event transposition, dTag attestation, symmetric public channel handles, retained lifecycle delivery, and complete close cleanup.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-23T19:57:34+01:00
- **Completed:** 2026-07-23T20:01:14+01:00
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Guarded the playground path so its trusted identity and live environment are registered before shared-prelude `srcdoc` execution, with no host-local INC parser or client.
- Added a serial real-browser proof across bot and chat frames for query transposition, exact raw-wire isolation, sender exclusion, and forged-sender rejection.
- Proved target-first symmetric channel opening plus retained `onOpened`, early `on`, and terminal `onClosed` lifecycle data, list informational shape, and inert traffic after closure.

## Task Commits

1. **Task 1: Guard playground identity registration and shared INC ownership** — `f1909f6` (test)
2. **Task 2: Prove exact two-frame event and channel behavior** — `fe6f866` (test)

## Files Created/Modified

- `tests/unit/playground-gateway-guard.test.ts` — static ordering and replacement-safe shared-INC ownership guard.
- `tests/e2e/nap-inc-playground.spec.ts` — focused two-frame public-API browser contract with event, channel, retention, and teardown vectors.

## Decisions Made

- Checked NAP-INC #89 at `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, web projection #90 at `896c32c92deee68dc4d10fc1132b62df20cccb6f`, and symmetric-channel #92 at `c5cd06f7be6d4690b303949abb26e87ff62f4729`; the proof is conformant with their exact event, identity, channel, and retention contract.
- Kept the shared namespace prelude as the only public implementation: the playground test frames use `window.napplet.inc`, while direct raw `postMessage` is limited to the two negative attestation/routing assertions required by `kehto/web#203`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added an opt-in isolated preview base URL for focused browser verification**
- **Found during:** Task 2
- **Issue:** Playwright reused an unrelated IPv4 process on `127.0.0.1:4174`, so the playground test received a different application.
- **Fix:** Kept the normal localhost default and added `KEHTO_PLAYGROUND_BASE_URL` for the requested temporary `http://[::1]:4174` preview.
- **Files modified:** `tests/e2e/nap-inc-playground.spec.ts`
- **Verification:** The focused test passed against the IPv6 preview while the unrelated IPv4 listener remained running.
- **Committed in:** `fe6f866`

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The opt-in endpoint preserves normal CI behavior and makes the requested isolated proof reproducible without touching the unrelated process.

## Issues Encountered

- The first focused run reached the unrelated IPv4 application because Playwright reused its normal localhost server. The isolated IPv6 override corrected only the test endpoint and the temporary preview was stopped afterward.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The browser surface now verifies the phase’s public INC event/channel contract against live trusted frame identities.
- The Phase 105 profile convention demo remains unchanged; this test uses bot and chat only as neutral already-loaded endpoints.

## Verification

- `pnpm exec vitest run tests/unit/playground-gateway-guard.test.ts` — passed (12 tests).
- `KEHTO_PLAYGROUND_BASE_URL='http://[::1]:4174' pnpm exec playwright test tests/e2e/nap-inc-playground.spec.ts --workers=1` — passed (1 test).

## Self-Check: PASSED

- Found both planned test artifacts and task commits `f1909f6` and `fe6f866`.

---

*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-23*
