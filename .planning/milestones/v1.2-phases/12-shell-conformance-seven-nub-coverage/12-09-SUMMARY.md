---
phase: 12-shell-conformance-seven-nub-coverage
plan: 09
subsystem: api
tags: [nub-storage, nip-5d, envelopes, runtime, acl]

# Dependency graph
requires:
  - phase: 11-nub-peer-deps-type-imports
    provides: "@napplet/nub-storage peer dependency + StorageMessage type-only imports"
  - phase: 12-01-shell-conformance
    provides: "shell conformance baseline (SH-C01/02/03) — prerequisite for cap renames"
provides:
  - "handleStorageNub narrowed to canonical 4 @napplet/nub-storage actions (get/set/remove/keys)"
  - "storage.get.result emits { value: string | null } (null ⇔ missing; `found` field removed)"
  - "storage.clear rejected with explicit .error envelope (not in canonical nub-storage union)"
  - "DRIFT-ACL-08 code-side closure (state-handler.ts marker deleted)"
  - "ACL-denial test shape for storage.get (state:read senderCap routed through createNubEnforceGate)"
affects: [12-10-acl-capability-extension, 14-dispatch-refactor, 15-release-prep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct-dispatch test harness: call handleStorageNub() with a real SessionRegistry + quota-stubbed AclStateContainer; NappletMessage[] captures all envelopes. Bypasses ACL for handler-shape tests."
    - "ACL-denial tests route through createRuntime().handleMessage() to exercise createNubEnforceGate + the runtime's .error-envelope emission path."
    - "Canonical @napplet/nub-storage envelope contract: `{ value: string | null }` on get.result; `error` presence is the canonical failure signal on set/remove.result (kehto still emits `ok` for backward-compat — Phase 15 decides whether to drop)."

key-files:
  created:
    - packages/runtime/src/state-handler.test.ts
  modified:
    - packages/runtime/src/state-handler.ts
    - packages/runtime/src/dispatch.test.ts

key-decisions:
  - "Kept `ok` field on storage.set/remove.result alongside canonical `error` for backward compat. Phase 15 decides final shape pre-release. Napplets SHOULD check `!result.error` (canonical) rather than `result.ok === true` (legacy)."
  - "storage.clear gets an explicit case in the switch emitting 'storage.clear is not in @napplet/nub-storage; action not supported' rather than falling through to default. Improves observability for napplets still sending the legacy action."
  - "Internal cleanupNappState() helper retained — it is not napplet-reachable; used only by runtime.destroyWindow() for lifecycle cleanup. Storage.clear removal only applies to the NUB dispatch surface."
  - "Direct-dispatch test harness (bypasses ACL) + runtime-dispatch ACL-denial test pattern established — reusable for any per-nub handler test file where both shape and ACL paths need coverage."

patterns-established:
  - "Canonical nub envelope alignment: Each handler's .result emission should exactly mirror the upstream `<Domain>ResultMessage` shape. Extra fields (like `found`) are deviation, not convenience."
  - "DRIFT marker closure discipline: Phase 11-added DRIFT-*-markers are deleted — not rewritten — as part of the code change they annotated. Phase 15 greps for orphans as a release gate."

requirements-completed: [NUB-09]

# Metrics
duration: 4 min
completed: 2026-04-17
---

# Phase 12 Plan 09: Storage Nub Handler Retrofit Summary

**handleStorageNub narrowed to canonical 4 @napplet/nub-storage actions (get/set/remove/keys), storage.clear explicitly rejected, `found` field dropped from get.result, DRIFT-ACL-08 code-side marker closed.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-17T19:11:37Z
- **Completed:** 2026-04-17T19:15:41Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- handleStorageNub now exactly matches `@napplet/nub-storage` canonical 4-action surface
- `storage.get.result` envelope reshaped to `{ value: string | null }` — `found` field removed
- `storage.clear` is explicitly rejected with `storage.clear.error` envelope (not in canonical union)
- DRIFT-ACL-08 code-side marker deleted from `state-handler.ts`; ACL-side closure deferred to Plan 12-10
- Transitive `.found` callers in `dispatch.test.ts` migrated to `value === null` / `value !== null` checks
- New `state-handler.test.ts` with 9 test cases: 4 per-action canonical envelopes, quota-exceeded error flow, storage.clear rejection, unknown sub-action rejection, and ACL-denial routing through the full runtime gate

## Task Commits

Each task committed atomically (TDD cycle):

1. **Task 1 (RED): Write failing test for canonical storage envelopes** — `6d135f7` (test)
2. **Task 2 (GREEN): Narrow handleStorageNub to canonical 4 actions + drop found** — `e6dba80` (feat)

**Plan metadata:** _(committed after this summary)_

_Note: No REFACTOR commit was necessary — the GREEN implementation was already clean._

## Files Created/Modified

- `packages/runtime/src/state-handler.test.ts` — **created** — 9-case direct-dispatch + ACL-denial test suite covering all 4 canonical actions, quota path, storage.clear rejection, and unknown-action rejection
- `packages/runtime/src/state-handler.ts` — **modified** — `handleStorageNub` switch: `case 'get'` now emits `{ value: result }` (no `found`); `case 'clear'` now emits `.error` envelope with explicit "not in @napplet/nub-storage" message; DRIFT-ACL-08 marker deleted; JSDoc deviation note added covering the `ok` vs `error` backward-compat decision
- `packages/runtime/src/dispatch.test.ts` — **modified** — 3 `.found` assertions migrated to canonical `value` checks + the `storage.clear removes all napplet state` test rewritten as `storage.clear is rejected — not in @napplet/nub-storage (Plan 12-09)` asserting `storage.clear.error` and verifying prior sets survive (clear never ran)

## Decisions Made

- **Keep `ok` alongside canonical `error` on set/remove.result.** Canonical `@napplet/nub-storage` only specifies optional `error` — napplets check `!result.error` for success. Emitting both preserves backward compatibility for the existing in-tree callers until Phase 15 release prep decides whether to drop `ok`. JSDoc on `handleStorageNub` documents the deviation.
- **Explicit `case 'clear'` with error emission over `default` fall-through.** The default branch already emits `'unknown storage action: clear'`, but an explicit `case 'clear'` with `'storage.clear is not in @napplet/nub-storage; action not supported'` improves observability for napplets still sending the legacy action.
- **Internal `cleanupNappState()` helper retained.** It is not napplet-reachable; used only by `runtime.destroyWindow()` for lifecycle cleanup. Only the napplet-facing NUB dispatch surface is narrowed.
- **ACL-denial test goes through full runtime dispatch.** `state-handler.ts` only receives messages after ACL passes; asserting the `.error`-envelope denial shape requires routing through `createRuntime().handleMessage()` so `createNubEnforceGate` + `formatDenialReason` both exercise.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed
**Impact on plan:** Plan executed atomically; scope held.

## Issues Encountered

- **Parallel agent artifact (scope boundary):** While running the full `pnpm test:unit` suite, 2 unrelated `ifc.subscribe` test failures surfaced in `dispatch.test.ts`. Root cause: the parallel 12-04 (ifc) agent modified `runtime.ts` to emit `ifc.subscribe.result` envelopes; two older tests still assert `ctx.sent` is empty for subscribe. These are **owned by Plan 12-04** and out of scope for 12-09 per the deviation-rules scope boundary. All 22 storage-related tests pass (verified via `pnpm test:unit -t storage`).

## Known Stubs

None — all 4 canonical actions ship with real implementations (triple-read migration on get, quota-aware set, remove, prefix-scoped keys). Neither internal helpers nor UI paths depend on stubbed storage surfaces.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 12-10 (ACL capability extension — NUB-10)** can proceed: `DRIFT-ACL-08` code-side is closed; the remaining ACL-side work is isolated to `packages/acl/src/resolve.ts:120-122` (remove the `case 'clear': return { senderCap: 'state:write', ... }` branch so the capability table stops advertising the now-unreachable action).
- **Plan 12-04 (ifc NUB-04)** runs in parallel — the 2 ifc.subscribe test failures observed are their scope and expected to resolve as that plan lands.
- **Phase 15 release prep** inherits the `ok`-vs-`error` deviation decision (JSDoc-documented at `handleStorageNub`).
- No blockers. Ready for parallel-wave aggregation.

## Self-Check: PASSED

All files created/modified on disk. Both task commits (6d135f7, e6dba80) present in git history.

---
*Phase: 12-shell-conformance-seven-nub-coverage*
*Completed: 2026-04-17*
