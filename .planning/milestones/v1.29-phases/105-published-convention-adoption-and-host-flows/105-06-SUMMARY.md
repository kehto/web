---
phase: 105-published-convention-adoption-and-host-flows
plan: 06
subsystem: paja intent host
tags: [paja, nap-intent, verified-manifest, retained-delivery]
requires:
  - phase: 105-05
    provides: Published NAP-INTENT resolver and acceptance-before-start seam
provides:
  - Persistent resolver-verified Paja install catalog independent of browser frames
  - Retained browser target controller with exactly-once current-generation delivery
  - Catalog-backed Paja intent resolution with fail-closed user policy hooks
affects: [105-07-paja-live-target-wiring, paja-browser-host]
tech-stack:
  added: []
  patterns: [verified-install-catalog, retained-target-controller, exact-intent-policy]
key-files:
  created:
    - packages/paja/src/installed-napplet-catalog.ts
    - packages/paja/src/browser-intent-controller.ts
    - packages/paja/src/installed-napplet-catalog.test.ts
    - packages/paja/src/browser-intent-controller.test.ts
    - packages/paja/src/browser-adapter-intent.test.ts
  modified:
    - packages/paja/src/browser-adapter.ts
    - packages/paja/src/index.ts
key-decisions:
  - "Paja retains serializable verified manifest and pointer facts, never frame, Window, session, or controller identity."
  - "Retained delivery is frozen before acceptance and sent at most once to a ready current generation."
  - "Defaults, chooser results, and explicit targets are revalidated against exact installed contracts; explicit targets require sender-aware authorization."
requirements-completed: [PKG-01, ARCH-03]
coverage:
  - id: D1
    description: Persistent verified Paja install catalog and immutable retained target controller.
    requirement: PKG-01
    verification:
      - kind: unit
        ref: pnpm exec vitest run packages/paja/src/installed-napplet-catalog.test.ts packages/paja/src/browser-intent-controller.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Catalog-backed Paja default, chooser, and explicit-handler selection through the real intent service.
    requirement: ARCH-03
    verification:
      - kind: integration
        ref: pnpm exec vitest run packages/paja/src/browser-adapter-intent.test.ts
        status: pass
    human_judgment: false
duration: 11min
completed: 2026-07-27
status: complete
---

# Phase 105 Plan 06: Paja verified catalog and retained intent controller Summary

**Paja now resolves intents from persistent resolver-verified manifests and retains immutable delivery until one current target generation is ready.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-27T09:28:00Z
- **Completed:** 2026-07-27T09:39:16Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Added a persistent installed-napplet catalog that records only serializable verified pointer, aggregate, title, and exact manifest-contract facts.
- Added a private-state retained target controller that freezes delivery before acceptance, waits for a current ready generation, and sends once with bounded terminal policy.
- Replaced Paja's hard-coded development intent candidate with `createCatalogIntentResolver`, user-policy hooks, and real intent-service integration tests.

## Task Commits

1. **Task 1: Resolve a cold verified Paja handler through retained state** - `5b8fdf7` (test), `b42031c` (feat)
2. **Task 2: Replace Paja DEV_INTENT with defaults, chooser, and authorization** - `8afca2d` (test), `138c6e4` (feat)

## Files Created/Modified

- `packages/paja/src/installed-napplet-catalog.ts` - Persistent verified-manifest installation records and exact resolver catalog.
- `packages/paja/src/browser-intent-controller.ts` - Immutable retained delivery and exactly-once generation policy.
- `packages/paja/src/browser-adapter.ts` - Catalog resolver, policy hooks, and controller composition.
- `packages/paja/src/index.ts` - Host-facing catalog and controller exports.
- `packages/paja/src/*intent*.test.ts` - Focused catalog, lifecycle, and real-service selection coverage.

## Decisions Made

- NAP-INTENT authority checked: `napplet/naps@a718915ddefa2f03a0126579601f59d8bd86f7c4:naps/NAP-INTENT.md`; implementation conforms to installed-manifest discovery, acceptance-before-start, source-independent retention, and ready-target delivery.
- Browser lifecycle state remains outside the catalog; Plan 07 owns mapping actual verified tabs and `shell.ready` sources to controller generations.
- Default, chooser, and explicit-handler policy is host-injected and fail-closed when absent, stale, invalid, incompatible, or unauthorized.

## Verification

- `pnpm exec vitest run packages/paja/src/browser-adapter-intent.test.ts packages/paja/src/installed-napplet-catalog.test.ts packages/paja/src/browser-intent-controller.test.ts` — passed (3 files, 10 tests).
- `pnpm --filter @kehto/paja type-check` — passed.
- `pnpm --filter @kehto/paja build` — passed; retained the pre-existing `@kehto/nip` side-effects warning.
- `npx --no-install aislop scan -d` — no errors; unchanged documented 72/100 warning baseline.
- `git diff --check` — passed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The scoped build and AI-slop scan reported only pre-existing warnings already documented by the preceding plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 07 can inject the catalog and controller into Paja's verified pointer/tab lifecycle, resolve readiness through registered `MessageEvent.source`, and preserve installations after frame teardown.

## Self-Check: PASSED

- All seven planned implementation/test artifacts exist.
- All four task commits exist and include the required `Co-Authored-By` trailer.
