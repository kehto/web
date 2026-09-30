---
phase: 105-published-convention-adoption-and-host-flows
plan: 04
subsystem: package-compatibility
tags: [pnpm, npm, jsr, napplet-core, napplet-nap, napplet-shim, nap-shell, vitest]
requires:
  - phase: 105-03
    provides: "Exact published pins and the third generated/frozen pnpm lock checkpoint for every remaining app and fixture consumer."
provides:
  - "Dynamic active-manifest, JSR-map, frozen-lock, and installed-metadata guard for the published Napplet release matrix."
  - "Released declaration and official-lineage proof for intent, resource, SDK, and convention-archetype Vite surfaces."
  - "Regression proof that Kehto retains the mandatory, source-bound NAP-SHELL host prelude despite the published generic package omission."
affects: [105-05, 105-06, 105-08, 105-09, 105-10, package-release, paja, playground]
tech-stack:
  added: []
  patterns:
    - "Discover active package and JSR consumers dynamically; never freeze an archived consumer count."
    - "Treat published shell omission as explicit upstream package drift while testing Kehto's host-owned mandatory shell binding end to end."
key-files:
  created:
    - tests/unit/napplet-package-alignment.test.ts
    - tests/unit/published-napplet-contract.test.ts
  modified:
    - packages/shell/src/napplet-namespace.test.ts
key-decisions:
  - "Keep the audited exact package matrix: core/nap 0.29.0, shim 0.27.0, SDK 0.25.0, and Vite plugin 0.12.0."
  - "Keep Kehto's host-owned NAP-SHELL prelude: generic core/shim omission is upstream package drift, not permission to remove the mandatory binding."
patterns-established:
  - "Package-line tests inspect active importers, package snapshots, and frozen installed metadata together."
  - "NAP-SHELL regressions prove real parent-source admission and namespace replacement resistance, not only declaration text."
requirements-completed: [PKG-01, PKG-02, PKG-03, PKG-04]
coverage:
  - id: D1
    description: "Published package pins, JSR maps, lock importers/snapshots, and installed metadata stay aligned on the audited release matrix."
    requirement: PKG-04
    verification:
      - kind: unit
        ref: tests/unit/napplet-package-alignment.test.ts
        status: pass
      - kind: other
        ref: pnpm install --lockfile-only && pnpm install --frozen-lockfile
        status: pass
    human_judgment: false
  - id: D2
    description: "Released intent, resource, SDK, and Vite convention-archetype declarations remain importable with exact authority and lineage evidence."
    requirement: PKG-01
    verification:
      - kind: unit
        ref: tests/unit/published-napplet-contract.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Kehto's mandatory NAP-SHELL prelude remains source-bound, one-shot, synchronous, immutable, and resistant to namespace replacement."
    requirement: PKG-02
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts
        status: pass
      - kind: other
        ref: pnpm --filter @kehto/shell build
        status: pass
    human_judgment: false
metrics:
  duration: 6m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 04: Published Package Contract Summary

**Dynamic proofs now lock every active Napplet consumer to the audited published release line while preserving Kehto's real NAP-SHELL host prelude as an explicit upstream-drift exception.**

## Performance

- **Duration:** 6m
- **Started:** 2026-07-27T09:09:00Z
- **Completed:** 2026-07-27T09:15:35Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Added a dynamic guard that discovers active package manifests and JSR maps, validates public ranges versus exact app/fixture pins, checks every matching lock importer and final snapshot, and resolves frozen installed metadata for the full official package matrix.
- Added a released-contract guard that imports the published intent, resource, SDK, and Vite archetype surfaces; it records the exact NAP/source/release refs and verifies official repository lineage with no postinstall hook.
- Extended the real shell prelude regression harness to prove a prelude installed before authored code only accepts the registered parent’s first init, exposes synchronous cached discovery, and resists direct and whole-namespace replacement.

## Verification

- `pnpm install --lockfile-only` — passed.
- `pnpm install --frozen-lockfile` — passed.
- `pnpm exec vitest run tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts` — passed (8 tests).
- `pnpm exec vitest run tests/unit/published-napplet-contract.test.ts packages/shell/src/napplet-namespace.test.ts` — passed (32 tests).
- `pnpm --filter @kehto/shell build` — passed.
- `pnpm test:unit` — passed (117 files, 1,504 tests).
- `git diff --check` — passed.
- Package authority recheck — npm metadata confirmed all five exact releases, their official `sandwichfarm/napplet` package directories, and no `postinstall`; remote refs confirmed NAP-SHELL master `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, NAP-INTENT PR #91 `a718915ddefa2f03a0126579601f59d8bd86f7c4`, and published release `60889f1c2476e063500c7ab6624af6abe0dbcbe5`.

## Task Commits

1. **Task 1: Guard the final npm, JSR, lock, and published declaration lineage** — `668057d` (test)
2. **Task 2: Preserve the locked host-owned NAP-SHELL prelude** — `49b0121` (test)

## Files Created/Modified

- `tests/unit/napplet-package-alignment.test.ts` — dynamic active-consumer, JSR, final-lock, and installed-package guard.
- `tests/unit/published-napplet-contract.test.ts` — published declaration, exact evidence, official-lineage, and shell-omission guard.
- `packages/shell/src/napplet-namespace.test.ts` — source-bound mandatory shell lifecycle and namespace-replacement regression.

## Decisions Made

- Kehto remains on core/nap `0.29.0`, shim `0.27.0`, SDK `0.25.0`, and Vite plugin `0.12.0`; active app and fixture consumers stay exact while public declarations stay bounded to the verified core/nap line.
- The generic published core/shim surface is not a NAP-SHELL implementation. Kehto continues to own and test the mandatory prelude until an audited upstream release supplies that API.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The TDD baseline correctly failed because the two planned guard files did not yet exist. After adding them, the first run exposed root-level package-resolution and lock-importer parsing gaps; the guards were corrected to load the frozen installed artifacts directly and to inspect importer specifiers plus resolved versions.
- `pnpm install --frozen-lockfile` reported the existing ignored `esbuild` build-script warning. Both required installation modes and all verification gates completed successfully without changing dependency policy.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 05–09 can consume the released intent/resource/SDK/Vite surfaces with a durable exact-line guard in place. The host-owned NAP-SHELL compatibility boundary remains explicitly protected for every later host flow.

## Self-Check

PASSED - all three planned code/test artifacts exist, task commits `668057d` and `49b0121` are present, no tracked deletion occurred, and the focused plus full unit verification completed successfully.
