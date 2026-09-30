---
phase: 102-nap-inc-event-channel-parity
plan: 12
subsystem: documentation-and-conformance
tags: [nap-inc, nip-5d, services, documentation, vitest]
requires:
  - phase: 102-09
    provides: Exact direct-domain service routing with INC owned by the runtime
  - phase: 102-10
    provides: Retired legacy notification and audio INC compatibility paths
provides:
  - Active direct-domain service-routing guidance
  - Scoped static protection against legacy service and synthetic INC-event recommendations
affects: [services, playground, shell-integration, phase-102]
tech-stack:
  added: []
  patterns:
    - Active documentation distinguishes direct message domains from opaque INC topics
    - Static guards scan named active surfaces while allowing explicit retirement prose
key-files:
  created: []
  modified:
    - apps/playground/README.md
    - packages/services/README.md
    - docs/packages/services.md
    - skills/add-service/SKILL.md
    - skills/integrate-shell/SKILL.md
    - tests/unit/nip5d-conformance-guard.test.ts
key-decisions:
  - "Direct services route only from the exact wire message.type domain; INC topics never choose a service."
  - "Only the authenticated runtime attaches INC sender identity and produces delivery envelopes."
patterns-established:
  - "Keep historical planning and changelogs outside active-surface service guidance guards."
requirements-completed: [BASE-05, INC-03, INC-04]
coverage:
  - id: D1
    description: Active service docs and skills teach direct-domain routing and runtime-attested INC delivery.
    requirement: BASE-05
    verification:
      - kind: unit
        ref: tests/unit/nip5d-conformance-guard.test.ts#keeps active service guidance on direct domains and runtime-attested INC delivery
        status: pass
    human_judgment: false
  - id: D2
    description: The scoped guard rejects legacy service compatibility recommendations without scanning preserved history.
    requirement: INC-04
    verification:
      - kind: unit
        ref: pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts
        status: pass
    human_judgment: false
metrics:
  duration: 9 min
  completed: 2026-07-23
status: complete
---

# Phase 102 Plan 12: Active Service Guidance Boundary Summary

**Current service documentation now routes only direct message domains while INC remains an exact opaque runtime channel with authenticated sender delivery.**

## Performance

- **Duration:** 9 min
- **Completed:** 2026-07-23T18:38:41Z
- **Tasks:** 1/1
- **Files modified:** 6

## Accomplishments

- Replaced legacy audio and notification compatibility guidance with direct `notify.*` service examples.
- Rewrote the service-authoring skill around exact `message.type` dispatch, not topic-prefix parsing.
- Added an active-surface static guard for legacy factories, colon-topic emissions, prefix routing, and fabricated INC delivery.

## Task Commits

1. **Task 1: Align active guidance and guard the retirement boundary** — `b99959e` (TDD RED), `3a8d218` (guidance and guard GREEN)

## Files Created/Modified

- `apps/playground/README.md` — describes direct notify routing and INC's runtime boundary.
- `packages/services/README.md` and `docs/packages/services.md` — remove retired service compatibility guidance.
- `skills/add-service/SKILL.md` and `skills/integrate-shell/SKILL.md` — teach direct envelopes and runtime-owned INC delivery.
- `tests/unit/nip5d-conformance-guard.test.ts` — enforces the active guidance boundary without scanning historical records.

## NAP Authority Checked

- `napplet/naps` draft PR #89 exact head `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, `naps/NAP-INC.md`: topics are exact opaque identities and `inc.event.sender` is runtime-attested.
- `napplet/naps` draft PR #90 exact head `896c32c92deee68dc4d10fc1132b62df20cccb6f`, `projections/web.md`: convention processing happens before delivery and routing uses the stable queryless identity.

The changed guidance is conformant with those scoped draft requirements.

## Decisions Made

- Direct services use exact `message.type` domains; `inc.emit` is never a service-selection mechanism.
- Explicit prohibitions are permitted in the guard's active docs, while executable or recommended legacy patterns are rejected.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The initial `pnpm docs:check` run exposed the Phase 102 ACL observer types and a stale Paja version row. The phase follow-up exported/documented the observer types, corrected the row, repaired the Windows counts, and reran the complete gate successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Future documentation changes have a focused guard against reintroducing service-over-INC compatibility.
- The full strict TypeDoc, VitePress, package-page, and docs-wiring gate now passes.

## Self-Check: PASSED

- Confirmed all six declared active guidance/guard files exist.
- Confirmed task commits `b99959e` and `3a8d218` exist in git history.
