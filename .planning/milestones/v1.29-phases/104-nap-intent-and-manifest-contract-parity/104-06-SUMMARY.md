---
phase: 104-nap-intent-and-manifest-contract-parity
plan: 06
subsystem: playground-manifest-authoring
tags: [gap-closure, manifest, archetype, validation, fail-closed]
requires:
  - phase: 104-nap-intent-and-manifest-contract-parity
    plan: 05
    provides: exact active contract guards and phase integration proof
provides:
  - raw exact playground archetype authoring validation
  - leading and trailing whitespace rejection vectors
affects: [105, 106]
tech-stack:
  added: []
  patterns: [validate-before-normalize, signed-metadata fail-closed]
key-files:
  created: []
  modified:
    - apps/playground/napplets/shared-vite-config.ts
    - tests/unit/playground-gateway-guard.test.ts
key-decisions:
  - "Signed archetype contract inputs are validated as supplied; authoring never trims them into a different trusted identity."
  - "Only archetype slug/convention normalization was removed; unrelated HTML and CSP parsing trims remain intact."
patterns-established:
  - "Exact signed metadata rejects leading and trailing whitespace at the authoring boundary as well as the runtime parser."
requirements-completed: [ARCH-04]
coverage:
  - id: G1
    description: Leading and trailing whitespace in archetype slugs and conventions fails before manifest generation.
    requirement: ARCH-04
    verification:
      - kind: unit
        ref: tests/unit/playground-gateway-guard.test.ts#validates-exact-convention-bearing-archetype-build-metadata
        status: pass
    human_judgment: false
  - id: G2
    description: Exact and repeated archetype contracts still build into the signed playground manifest.
    requirement: ARCH-04
    verification:
      - kind: unit
        ref: tests/unit/playground-gateway-guard.test.ts#recomputes-a-signed-final-manifest
        status: pass
      - kind: build
        ref: pnpm --filter @kehto/playground build
        status: pass
    human_judgment: false
duration: 3min
completed: 2026-07-26
status: complete
---

# Phase 104 Plan 06: Strict Archetype Authoring Gap Closure Summary

**Playground authoring now rejects whitespace-padded archetype metadata instead
of normalizing it into a different valid convention before signing.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-26T16:20:00+01:00
- **Completed:** 2026-07-26T16:23:00+01:00
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Added leading and trailing whitespace regressions for both archetype slug and
  convention values.
- Removed pre-validation trimming from the signed-metadata authoring path while
  preserving every unrelated HTML/CSP normalization path.
- Restored the verifier's missing fail-closed truth without changing exact
  accepted contracts or dependency state.

## Task Commit

1. **Task 1: Reject whitespace-padded archetype authoring metadata** — `563c747`

## Authority Check

Rechecked `napplet/naps` draft PR #91 before the gap fix. It remains open and
unchanged at exact head `a718915ddefa2f03a0126579601f59d8bd86f7c4`.
The exact queryless manifest contract continues to govern this authoring
boundary.

## TDD Evidence

- **RED:** The four new padding vectors caused the focused gateway test to fail
  because `definePlaygroundNappletConfig()` accepted at least one malformed
  value.
- **GREEN:** Removing the two archetype `.trim()` calls made all four vectors
  reject while the existing exact input remained accepted.

## Verification

- Focused authoring and parser matrix — 56 tests passed.
- Full Phase 104 focused matrix — 309 tests passed across 12 files.
- `@kehto/nip`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, and
  `@kehto/paja` type-checks — passed.
- `pnpm --filter @kehto/playground build` — passed.
- `git diff --check` — passed.
- Package manifests, `pnpm-lock.yaml`, and `.aislop/config.yml` — unchanged.
- AI-slop gate — unavailable; nothing was installed.

## Deviations from Plan

None.

## User Setup Required

None.

## Next Phase Readiness

Phase 104 is ready for independent re-verification. Phase 105 remains the owner
of published package adoption and persistent live Paja/playground intent flows.

## Self-Check: PASSED

- Both modified files exist and task commit `563c747` is present.
- Negative vectors fail on the old implementation and pass on the fix.
- No normalization outside the exact archetype authoring boundary changed.
