---
phase: 105-published-convention-adoption-and-host-flows
plan: 10
subsystem: NIP-5D conformance guard evidence
tags: [vitest, nap-intent, nap-shell, published-packages, playground, paja]
requires:
  - phase: 105-07
    provides: "Paja verified installed catalog and source-bound retained intent delivery."
  - phase: 105-09
    provides: "Published playground profile intent, resource-byte media, and theme browser flow."
provides:
  - "Classification-aware static evidence for the final published package and authority graph."
  - "Positive guard evidence for Kehto's mandatory host-owned NAP-SHELL prelude."
  - "Active catalog, target delivery, resource cleanup, and theme proof boundaries."
affects: [105-11, 105-12, phase-verification, package-drift]
tech-stack:
  added: []
  patterns: [classified-static-evidence, positive-host-prelude-proof, active-host-flow-guard]
key-files:
  created: []
  modified:
    - tests/unit/nip5d-conformance-guard.test.ts
    - tests/unit/sdk-migration-guard.test.ts
    - tests/unit/playground-gateway-guard.test.ts
key-decisions:
  - "Restrict static migration evidence to explicit live sources; preserve planning, changelog, and intentional fixture history as classified exclusions."
  - "Treat published core/shim shell omission as upstream package drift and prove the retained Kehto prelude positively."
requirements-completed: [PKG-01, PKG-02, PKG-03, PKG-04, IDENTITY-05, THEME-04, ARCH-03]
coverage:
  - id: D1
    description: "Published package pins, ranges, lock snapshots, canonical intent ownership, and exact authorities remain guarded."
    requirement: PKG-01
    verification:
      - kind: unit
        ref: pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Verified catalogs, retained target-only delivery, resource URL cleanup, and current/changed theme proof remain guarded in active host paths."
    requirement: ARCH-03
    verification:
      - kind: unit
        ref: pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/profile-resource-media.test.ts tests/unit/playground-intent-controller.test.ts packages/paja/src/browser-intent-controller.test.ts
        status: pass
    human_judgment: false
metrics:
  duration: 5m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 10: Final Published Convention Guard Summary

**Active Vitest guards now pin the released Napplet graph, preserve Kehto's mandatory host shell prelude, and structurally protect verified catalog and profile host flows.**

## Performance

- **Duration:** 5m
- **Started:** 2026-07-27T11:08:27Z
- **Completed:** 2026-07-27T11:13:21Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Replaced the SDK guard's repository-wide history scan with explicit active migration source classification while preserving archived planning, changelog, and intentional fixture exclusions.
- Required the exact NAP-INTENT, NAP-IDENTITY/NAP-THEME, published-source, and release authority refs in active evidence; package, JSR, and frozen-lock checks remain structural.
- Added positive proof that released intent types are canonical, the local mirror is absent, and the Kehto-owned NAP-SHELL prelude still supplies shell, ready/init, local supports, and onReady.
- Added explicit host-flow evidence for serializable verified catalogs, source-bound exactly-once delivery after acceptance, no profile INC carrier, resourceBytes/Object URL revocation, selected resource-demo versions, and current/changed theme checks.

## NAP Authority

- **NAP-INTENT:** `napplet/naps` PR #91 head `a718915ddefa2f03a0126579601f59d8bd86f7c4` — URI normalization, accepted retained responsibility, target-only `intent.deliver`, and no visible INC dependency are conformant.
- **NAP-IDENTITY / NAP-THEME / NAP-SHELL:** `napplet/naps` master `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` — profile media follows identity's explicit `resource.bytes` delegation, theme uses current/automatic changed behavior, and NAP-SHELL remains mandatory.
- **Published artifacts:** source `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b`; release `60889f1c2476e063500c7ab6624af6abe0dbcbe5`.
- **NAP-RESOURCE / NAP-DM:** no standalone NAP-RESOURCE semantics or NAP-DM behavior was inferred or enabled; resource coverage follows only NAP-IDENTITY's explicit delegation and the released declarations.

## Verification

- `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts` — passed (4 files, 35 tests).
- `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/profile-resource-media.test.ts tests/unit/playground-intent-controller.test.ts packages/paja/src/browser-intent-controller.test.ts` — passed (5 files, 49 tests).
- `git diff --check` — passed.

## Task Commits

1. **Task 1: Guard exact released ownership, lineage, and host shell drift** — `020c54b` (RED), `20fbbe5` (GREEN)
2. **Task 2: Guard installed catalogs, profile intent, resource cleanup, and live theme** — `21781f1` (RED), `c14d6aa` (GREEN)

## Files Created/Modified

- `tests/unit/nip5d-conformance-guard.test.ts` — positive published-ownership, host-prelude, and Paja catalog/controller evidence.
- `tests/unit/sdk-migration-guard.test.ts` — exact final graph and classified live-source migration checks.
- `tests/unit/playground-gateway-guard.test.ts` — classified playground host-flow evidence for catalogs, deliveries, media, and theme tests.

## Decisions Made

- Use explicit source lists rather than broad tracked-file scans so historical documentation and deliberately invalid fixtures cannot make active conformance evidence flaky.
- Keep the package shell omission as a positive upstream-drift exception: published core/shim omission does not weaken the retained Kehto host-owned mandatory shell prelude.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevent guard source discovery from traversing installed dependencies**
- **Found during:** Task 1
- **Issue:** The first classified recursive source scan entered nested `node_modules`, producing false legacy transport matches from published declarations.
- **Fix:** Excluded generated dependency and build directories before scanning active TypeScript sources.
- **Files modified:** `tests/unit/sdk-migration-guard.test.ts`
- **Verification:** Both focused guard commands pass.
- **Committed in:** `c14d6aa`

**2. [Rule 1 - Bug] Make classification tests verify declarations instead of their own expectation literals**
- **Found during:** Tasks 1 and 2
- **Issue:** The initial red assertions could satisfy their own string search instead of proving the classified source declarations existed.
- **Fix:** Constructed the searched declaration markers at runtime, so removing the declarations fails the guard.
- **Files modified:** `tests/unit/sdk-migration-guard.test.ts`, `tests/unit/playground-gateway-guard.test.ts`
- **Verification:** Both focused guard commands pass.
- **Committed in:** `c14d6aa`

**Total deviations:** 2 auto-fixed Rule 1 guard-correctness fixes. No scope expansion.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Phase 105's completed published package and host-flow work now has active, classification-aware drift coverage for Plans 11–12 verification and documentation closeout.

## Self-Check: PASSED

- All three active guard artifacts and this summary exist.
- TDD RED and GREEN commits `020c54b`, `20fbbe5`, `21781f1`, and `c14d6aa` exist.
- Stub scan found only local empty-array accumulators, not rendered placeholders or unwired data.
