---
phase: 102-nap-inc-event-channel-parity
plan: 07
subsystem: inc-conformance-documentation
tags: [nap-inc, nip-5d, conformance, documentation, vitest]
requires:
  - phase: 102-05
    provides: Paja proof of the protected shared INC prelude after shim assignment
  - phase: 102-06
    provides: Playground proof of exact routing and retained symmetric channels
  - phase: 102-12
    provides: INC static conformance seams in the shared guard
provides:
  - Active-surface guard pinned to NAP-INC #89, web projection #90, and channel clarification #92 exact heads
  - Runtime, shell, and policy guidance for projection transposition, exact routing, attested identity, and symmetric teardown
affects: [phase-104-nap-intent-convention-binding, phase-105-published-napplet-package-adoption, docs, runtime, shell]
tech-stack:
  added: []
  patterns: [exact-head active-surface guard, living-draft links instead of local normative copies]
key-files:
  created: []
  modified:
    - tests/unit/nip5d-conformance-guard.test.ts
    - RUNTIME-SPEC.md
    - docs/policies/NIP-5D-CONFORMANCE.md
    - packages/runtime/README.md
    - packages/shell/README.md
key-decisions:
  - "NAP-INC #89 (4593ce9e301ce098fd3dad64206fcd6f144fa7af), web projection #90 (896c32c92deee68dc4d10fc1132b62df20cccb6f), and #92 (c5cd06f7be6d4690b303949abb26e87ff62f4729) remain draft authority and are linked rather than locally copied."
  - "The binding alone owns query-to-text-payload transposition; runtime INC routing remains exact and queryless with runtime-attested dTags."
  - "Phase 104 owns NAP-INTENT lifecycle work and Phase 105 owns released package adoption."
patterns-established:
  - "Conformance guidance must pin all related draft heads and retain the downstream issue link without presenting draft text as merged."
requirements-completed: [BASE-04, BASE-05, INC-01, INC-02, INC-03, INC-04, INC-05, INC-06, INC-07, INC-08]
coverage:
  - id: D1
    description: Active INC guidance and static guard pin the exact draft heads and protect the implemented routing/identity/channel boundary.
    requirement: INC-05
    verification:
      - kind: unit
        ref: tests/unit/nip5d-conformance-guard.test.ts#pins active INC guidance to the draft authority and implemented routing boundary
        status: pass
      - kind: other
        ref: pnpm docs:check
        status: pass
    human_judgment: false
metrics:
  duration: 4min
  completed: 2026-07-23
  tasks: 1
  files: 5
status: complete
---

# Phase 102 Plan 07: INC Contract Documentation Summary

**Active runtime, shell, policy, and guard guidance now pin the three NAP-INC draft heads and document exact routing, runtime-attested dTags, and #92 symmetric channel lifecycle.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-23T20:05:50+01:00
- **Completed:** 2026-07-23T20:09:04+01:00
- **Tasks:** 1/1
- **Files modified:** 5

## Accomplishments

- Added a structural active-surface guard for the three exact upstream heads, projection/runtime split, and existing INC routing/lifecycle seams.
- Aligned runtime, policy, runtime-package, and shell-package guidance with queryless exact routing, open-only ACL, dTag attestation, source exclusion, opaque payloads, and deterministic teardown.
- Recorded #92 target-first symmetric handles, lifecycle retention, bounded overflow closure, informational channel lists, and the `kehto/web#203` downstream tracker.
- Reserved all public #91 NAP-INTENT work for Phase 104 and package adoption claims for Phase 105 while preserving historical material.

## Task Commits

1. **Task 1: Pin the active INC contract and scope boundaries** — `c328768` (test, RED) and `a9730fb` (docs, GREEN)

## Files Created/Modified

- `tests/unit/nip5d-conformance-guard.test.ts` — exact-head and active-boundary structural guard.
- `RUNTIME-SPEC.md` — runtime projection, routing, identity, channel, and phase-scope guidance.
- `docs/policies/NIP-5D-CONFORMANCE.md` — authority, boundary, and historical-scope policy.
- `packages/runtime/README.md` — runtime-facing INC behavior and open-time authorization guidance.
- `packages/shell/README.md` — injected binding transposition and retained symmetric-handle guidance.

## Decisions Made

- Kept the NAP-INC, projection, and #92 PRs explicitly draft/unmerged and linked them rather than adding a local protocol mirror.
- Preserved the existing shared binding/runtime split: only the binding transposes convention queries, while runtime map lookup remains exact and queryless.
- Treated `kehto/web#203` and its upstream-resolution reply as the downstream tracking record; the opener-only interpretation is obsolete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test guard] Allowed Markdown line wrapping in the exact-identity assertion**
- **Found during:** Task 1
- **Issue:** The new guard expected an unbroken `exact queryless topic identity` phrase, but the policy formats the phrase across a Markdown line break.
- **Fix:** Updated the structural assertion to allow whitespace while preserving the required words and ordering.
- **Files modified:** `tests/unit/nip5d-conformance-guard.test.ts`
- **Verification:** Focused guard passed with 12 tests.
- **Committed in:** `a9730fb`

**Total deviations:** 1 auto-fixed Rule 1 test-guard defect. No production or protocol scope expanded.

## Issues Encountered

- `npx --no-install aislop scan -d .` could not run because the executable is not installed; no package was downloaded or installed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 104 has an explicit prohibition against treating this documentation-only INC work as NAP-INTENT implementation.
- Phase 105 has the exact published-package gate and the active boundary to re-audit when upstream draft heads change.

## Verification

- PASS `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts` — 12 tests.
- PASS `pnpm docs:check`.
- PASS `git diff --check`.
- NOT RUN `aislop` — executable unavailable; no installation attempted.

## Self-Check: PASSED

- Found all five declared active artifacts and this Summary on disk.
- Found TDD commits `c328768` and `a9730fb` in git history.

---
*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-23*
