---
phase: 104-nap-intent-and-manifest-contract-parity
plan: 03
subsystem: intent-resolution
tags: [nap-intent, resolver, authorization, retained-delivery, user-policy]
requires:
  - phase: 104-nap-intent-and-manifest-contract-parity
    plan: 02
    provides: exact installed manifest contracts and derived candidate indexes
provides:
  - exact complete-convention candidate compatibility
  - default, sole, chooser, and authorized explicit selection policy
  - pre-acceptance immutable retained delivery responsibility
affects: [104-04, 104-05, 105]
tech-stack:
  added: []
  patterns: [filter-before-policy, fail-closed explicit targeting, retain-before-acceptance]
key-files:
  created: []
  modified:
    - packages/services/src/catalog-intent-resolver.ts
    - packages/services/src/catalog-intent-resolver.test.ts
    - packages/services/src/intent-service.ts
    - packages/services/src/index.ts
key-decisions:
  - "Only authoritative contract.convention exact equality creates the compatible set; quick indexes, event kinds, payload, and catalog order never select."
  - "Explicit dTag targeting is fail-closed without positive sender-aware host authorization, and every default or chooser output is revalidated."
  - "Resolver acceptance exists only after a target controller retains an immutable canonical delivery and returns an unstarted opaque task."
patterns-established:
  - "Selection order is explicit authorization, explicit chooser, compatible default, sole compatible candidate, chooser, or rejection."
  - "Kehto orchestration types wrap exact canonical result/delivery values without adding carrier or window lifecycle fields."
requirements-completed: [INTENT-05, INTENT-06, INTENT-07, INTENT-08, INTENT-09, INTENT-10]
coverage:
  - id: D1
    description: Candidate compatibility is exact complete convention equality and ignores payload-like routing data.
    requirement: INTENT-05
    verification:
      - kind: unit
        ref: packages/services/src/catalog-intent-resolver.test.ts#compatible selection policy
        status: pass
    human_judgment: false
  - id: D2
    description: Defaults, sole candidates, chooser output, cancellation, ambiguity, and explicit authorization obey user policy without catalog-order fallback.
    requirement: INTENT-06
    verification:
      - kind: unit
        ref: packages/services/src/catalog-intent-resolver.test.ts#compatible selection policy
        status: pass
    human_judgment: false
  - id: D3
    description: Immutable exact delivery responsibility is retained before acceptance and its opaque task remains unstarted.
    requirement: INTENT-08
    verification:
      - kind: unit
        ref: packages/services/src/catalog-intent-resolver.test.ts#retained delivery responsibility
        status: pass
    human_judgment: false
duration: 11min
completed: 2026-07-26
status: complete
---

# Phase 104 Plan 03: Exact Selection and Retained Delivery Summary

**Handler resolution now uses only exact installed contracts and explicit user policy, then retains immutable source-independent delivery responsibility before reporting acceptance.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-07-26T15:29:00+01:00
- **Completed:** 2026-07-26T15:40:00+01:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced action/protocol and first-candidate resolution with exact complete
  convention filtering followed by compatible default, sole candidate, chooser,
  or structured rejection.
- Made explicit dTag targeting require an installed exact-compatible candidate
  plus positive sender-aware authorization, with chooser/default outputs
  revalidated against the same compatible set.
- Replaced target-window opening with an immutable canonical delivery retention
  seam and an accepted resolver outcome carrying one opaque unstarted task.

## Task Commits

1. **Task 1: Select only exact compatible contracts through explicit user policy** — `8e437ca`
2. **Task 2: Retain an opaque target delivery task before returning acceptance** — `7446523`

## Files Created/Modified

- `packages/services/src/catalog-intent-resolver.ts` — Exact compatibility,
  fail-closed user policy, immutable retention, and canonical outcomes.
- `packages/services/src/catalog-intent-resolver.test.ts` — Complete selection,
  authorization, payload non-inference, retention ordering, and exact-shape matrix.
- `packages/services/src/intent-service.ts` — Sender-only resolver context and
  retained-delivery outcome orchestration types.
- `packages/services/src/index.ts` — Public retained-delivery and target-controller
  exports with old window/open lifecycle exports removed.

## Authority Check

Checked `napplet/naps` draft PR #91 at
`a718915ddefa2f03a0126579601f59d8bd86f7c4` immediately before implementation.
Its exact manifest compatibility, user-owned selection, explicit-handler
authorization, sender provenance, acceptance, and lifecycle-neutrality rules
remain unchanged and this resolver conforms to that exact draft.

## Decisions Made

- Treat an explicit `default` preference without a compatible user default as
  rejection; it does not silently fall through to sole or chooser policy.
- Treat a missing chooser for implicit ambiguity as `invoke rejected`, while a
  requested chooser returning no candidate is `user cancelled`.
- Freeze freshly copied delivery, behavior, and controller parameter objects;
  payload remains opaque and is neither inspected nor interpreted.
- Convert authorization and retention exceptions into the same fixed
  pre-acceptance rejection so neither path can accidentally start target policy.

## Deviations from Plan

### Sequenced sender context with Task 1

`IntentResolverContext` changed to authenticated `sender` during exact selection
rather than waiting for Task 2, because the explicit-handler authorization hook
cannot be implemented safely with a source window identifier. The same file and
final contract were already owned by this plan.

### Deferred cross-wave service integration verification

The package-wide `@kehto/services` type-check now reports only the intentionally
stale intent service invocation and integration fixtures assigned to Plans
104-04 and 104-05:

- `intent-service.ts` still passes a window identifier until runtime attachment
  supplies authenticated sender in Plan 104-04;
- `intent-service.test.ts` still models direct canonical results until Plan
  104-04 implements result-before-start orchestration;
- `manifest-intent-dispatch.test.ts` still uses the old manifest/controller
  fixture until Plan 104-05 completes the integrated dispatch proof.

No resolver, retained-delivery test, exact type, or catalog adapter diagnostic
remains. Plan 104-04 must close the first two items immediately; Plan 104-05
closes the integrated fixture before phase verification.

## Verification

- `pnpm exec vitest run packages/services/src/catalog-intent-resolver.test.ts packages/services/src/manifest-intent-catalog.test.ts packages/services/src/intent-types.test.ts` — 34 passed.
- Exact selection subset (`compatible|default|chooser|explicit|payload`) — 12 passed.
- `pnpm --filter @kehto/services type-check` — deferred only for the three explicitly assigned cross-wave consumers above.
- Production resolver/export search found no active `protocol`, `handled`,
  `windowId`, `newWindow`, `IntentWindowController`, or `IntentOpenParams`
  contract.
- `git diff --check` — passed.
- No package manifest, lockfile, or dependency changes.
- AI-slop gate — unavailable; the workspace contains no configured script or installed executable.

## User Setup Required

None.

## Next Phase Readiness

Plan 104-04 can attach the service to authenticated runtime identity, send the
accepted source result before starting the retained task, and replace
request-history change broadcasts with current policy-aware session delivery.

## Self-Check: PASSED

- All four modified files exist and task commits `8e437ca` and `7446523` are present.
- All 34 focused resolver/catalog/type tests pass.
- Exact canonical result and delivery objects contain no host lifecycle,
  protocol, handled-state, carrier, or window identifiers.
- No runtime registration, source-result ordering, package adoption, live host
  flow, generated docs, or changeset work entered this plan.
