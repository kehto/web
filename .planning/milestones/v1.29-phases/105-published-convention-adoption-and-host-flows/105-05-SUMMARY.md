---
phase: 105-published-convention-adoption-and-host-flows
plan: 05
subsystem: services
tags: [nap-intent, napplet-core, type-ownership, vitest]
requires:
  - phase: 105-04
    provides: "Verified installed @napplet/core and @napplet/nap 0.29.0 package declarations and published-contract lineage guard."
provides:
  - "@kehto/services consumes and re-exports the released NAP-INTENT value declarations from @napplet/core."
  - "The Phase 104 local intent-type mirror is deleted and guarded against reintroduction."
  - "Resolver, retention, target-controller, authorization, and delivery policy remain Kehto-owned."
affects: [105-06, 105-08, 105-09, 105-10, paja, playground]
tech-stack:
  added: []
  patterns:
    - "Import released NAP-INTENT value types directly from @napplet/core while retaining host-policy interfaces in @kehto/services."
    - "Static conformance guards inspect installed published declarations instead of local protocol mirrors."
key-files:
  created: []
  modified:
    - packages/services/src/intent-service.ts
    - packages/services/src/catalog-intent-resolver.ts
    - packages/services/src/manifest-intent-catalog.ts
    - packages/services/src/index.ts
    - tests/unit/published-napplet-contract.test.ts
    - tests/unit/nip5d-conformance-guard.test.ts
  deleted:
    - packages/services/src/intent-types.ts
key-decisions:
  - "Use the released @napplet/core 0.29.0 declarations as the canonical owner for every Intent* value type; @napplet/nap/intent re-exports its supported subset."
  - "Keep all Kehto host-policy seams, including exact selection, authorization, retain-before-result ordering, sender attestation, and carrier-neutral delivery."
patterns-established:
  - "When a published protocol declaration replaces a local mirror, update compile fixtures and static guards in the same atomic migration."
requirements-completed: [PKG-01]
coverage:
  - id: D1
    description: "Services import and publicly re-export released NAP-INTENT values without a competing local type mirror."
    requirement: PKG-01
    verification:
      - kind: unit
        ref: "tests/unit/published-napplet-contract.test.ts#keeps services on published intent declarations without a competing local mirror"
        status: pass
      - kind: unit
        ref: "tests/unit/nip5d-conformance-guard.test.ts#keeps active intent and manifest surfaces on exact convention contracts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Canonical value ownership preserves exact resolver authorization, retained delivery, result-before-start, and sender-attestation behavior."
    requirement: PKG-01
    verification:
      - kind: unit
        ref: "packages/services/src/intent-service.test.ts"
        status: pass
      - kind: unit
        ref: "packages/services/src/catalog-intent-resolver.test.ts, packages/services/src/manifest-intent-catalog.test.ts, packages/services/src/manifest-intent-dispatch.test.ts"
        status: pass
    human_judgment: false
metrics:
  duration: 6m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 05: Published Intent Ownership Summary

**@kehto/services now consumes released NAP-INTENT declarations from @napplet/core 0.29.0 while preserving the host-owned exact-selection and retained-delivery policy path.**

## Performance

- **Duration:** 6m
- **Started:** 2026-07-27T09:19:15Z
- **Completed:** 2026-07-27T09:25:19Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

- Deleted the Phase 104 `intent-types.ts` mirror and replaced every active production import and public re-export with type-only `@napplet/core` declarations.
- Kept `IntentResolver`, retained delivery, target controller, catalog, chooser, and explicit-handler authorization as deliberate Kehto-owned policy seams.
- Retained complete accepted-result-before-start, runtime sender-attestation, exact-contract, ambiguity, authorization, and carrier-neutral delivery coverage.
- Moved static contract guards to the installed released core declaration and made mirror removal a regression-tested invariant.

## NAP Authority

Checked NAP-INTENT at `napplet/naps` PR #91 head `a718915ddefa2f03a0126579601f59d8bd86f7c4` (the `nap-intent` branch), alongside installed official `@napplet/core@0.29.0` and `@napplet/nap@0.29.0` packages. The migrated service remains conformant: URI-derived request identity, result-before-start acceptance, runtime-attested sender, and target-only carrier-neutral delivery are unchanged.

## Verification

- `pnpm exec vitest run packages/services/src/intent-service.test.ts` — passed (34 tests).
- `pnpm --filter @kehto/services type-check` — passed.
- `pnpm exec vitest run packages/services/src/intent-types.test.ts packages/services/src/catalog-intent-resolver.test.ts packages/services/src/manifest-intent-catalog.test.ts packages/services/src/manifest-intent-dispatch.test.ts` — passed (39 tests).
- Wave 5 aggregate services gate — passed (73 tests).
- `pnpm build` — passed (32 packages).
- `pnpm type-check` — passed (17 packages).
- `pnpm test:unit` — passed (117 files, 1,506 tests).
- `pnpm docs:check` — passed.
- `npx --no-install aislop scan -d` — completed with the pre-existing 72/100 warning baseline and no errors.
- `git diff --check` — passed.

## Task Commits

1. **Task 1: Delete the mirror through one accepted service path** — `12f61f2` (test), `a57aa69` (feat)
2. **Task 2: Port the complete service/catalog regression matrix** — `b611627` (test), `c35bc8f` (test)

## Files Created/Modified

- `packages/services/src/intent-types.ts` — deleted temporary local NAP-INTENT value mirror.
- `packages/services/src/intent-service.ts` — consumes canonical request, availability, and result declarations.
- `packages/services/src/catalog-intent-resolver.ts` — preserves Kehto policy over canonical catalog/delivery values.
- `packages/services/src/manifest-intent-catalog.ts` and `index.ts` — import and re-export canonical published types.
- `packages/services/src/*intent*.test.ts` — compile and lifecycle regression fixtures import released values.
- `tests/unit/published-napplet-contract.test.ts` and `tests/unit/nip5d-conformance-guard.test.ts` — prevent the deleted mirror from returning and inspect installed core shapes.

## Decisions Made

- All canonical NAP-INTENT values come directly from `@napplet/core`, their released owner; `@napplet/nap/intent` remains the domain adapter export but does not expose the accepted/rejected result split separately.
- No host policy was moved upstream: installed catalog ownership, ACL/authorization, target retention, FIFO delivery, and runtime source trust remain in Kehto.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test imports and static guards required by mirror deletion**
- **Found during:** Task 1 and Task 2
- **Issue:** Services type-check fixtures and an existing conformance guard still imported or read the deleted local type file.
- **Fix:** Moved fixtures to released imports and changed the guard to inspect the installed `@napplet/core` declaration.
- **Files modified:** `packages/services/src/*intent*.test.ts`, `tests/unit/nip5d-conformance-guard.test.ts`
- **Verification:** Focused service matrix, full unit suite, build, and type-check pass.
- **Committed in:** `a57aa69`, `c35bc8f`

**2. [Rule 1 - Bug] Scoped the static forbidden-field scan to canonical-shape surfaces**
- **Found during:** Task 2
- **Issue:** The guard treated `windowId` in the service's private runtime routing logic as a forbidden public intent field.
- **Fix:** Kept the public-shape scan on resolver/catalog/barrel surfaces and checked the deleted mirror separately.
- **Files modified:** `tests/unit/nip5d-conformance-guard.test.ts`
- **Verification:** Focused guard and full unit suite pass.
- **Committed in:** `c35bc8f`

**Total deviations:** 2 auto-fixed (Rule 1: 1, Rule 3: 1). No host-policy behavior changed.

## Issues Encountered

- The local Napplet checkout did not contain the draft NAP-INTENT commit, so the exact published `napplet/naps` remote ref and immutable raw document were checked directly before the migration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 06 and 08 can now consume the public `@kehto/services` intent exports without a local value-type mirror. The catalog/controller policy boundary remains intact for Paja and playground host composition.

## Self-Check

PASSED - `packages/services/src/intent-types.ts` is absent, all four task commits (`12f61f2`, `a57aa69`, `b611627`, `c35bc8f`) exist, and the focused and full verification commands passed.
