---
phase: quick-260804-dql
plan: "03"
subsystem: paja-filesystem-and-dm-lifecycle
tags: [paja, nap-fs, nap-dm, nip-5d, filesystem, nip17, vitest]
requires:
  - phase: quick-260804-dql-02
    provides: immutable authority inventory and completed Paja device recovery work
provides:
  - terminal service-layer filesystem watch teardown
  - terminal browser filesystem watch setup teardown
  - reliable synchronous NIP-17 live-message delivery
affects: [quick-260804-dql-04, review-resolution]
tech-stack:
  added: []
  patterns:
    - reserve lifecycle ownership before invoking reentrant or asynchronous backend setup
    - validate ownership identity after every setup await before publishing a handle
key-files:
  created:
    - .planning/quick/260804-dql-assess-prioritize-and-resolve-every-revi/260804-dql-03-SUMMARY.md
  modified:
    - packages/services/src/fs-service.ts
    - packages/services/src/fs-service.test.ts
    - packages/paja/src/browser-fs.ts
    - packages/paja/src/browser-fs.test.ts
    - packages/services/src/dm-nip17-adapter.ts
    - packages/services/src/dm-service.test.ts
    - .planning/quick/260804-dql-assess-prioritize-and-resolve-every-revi/260804-dql-REVIEW-INVENTORY.md
key-decisions:
  - "Service FS reserves a per-window record before backend.watch(), treats a late destroyed setup as cancelled, and closes the acquired handle."
  - "Browser FS tracks pending setup separately from active records so teardown blocks post-await interval registration."
  - "NIP-17 registers the live subscription before relay subscribe() so synchronous callbacks retain their subscription owner."
patterns-established:
  - "Lifecycle setup: reserve → await → validate record identity/liveness → publish ownership; close any late handle."
requirements-completed: [QUICK-260804-DQL]
coverage:
  - id: D1
    description: Service FS destruction closes a late backend handle and suppresses setup-time callbacks.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: packages/services/src/fs-service.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Browser FS destruction during resolution prevents later active-watch and interval ownership.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: packages/paja/src/browser-fs.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: NIP-17 relay events emitted synchronously from subscribe() reach their live subscription.
    requirement: QUICK-260804-DQL
    verification:
      - kind: unit
        ref: packages/services/src/dm-service.test.ts
        status: pass
    human_judgment: false
duration: 17m
completed: 2026-08-04
status: complete
---

# Quick 260804-dql Plan 03: FS and DM Lifecycle Races Summary

**Paja now keeps filesystem teardown terminal across pending setup and retains the first valid NIP-17 message even when a relay invokes its subscription callback synchronously.**

## Performance

- **Duration:** ~17 min
- **Completed:** 2026-08-04
- **Tasks:** 2/2 planned tasks, plus explicitly assigned C09
- **Files modified:** 7

## Accomplishments

- C07 service FS reserves ownership before awaiting `backend.watch()`, suppresses callbacks until the handle is active, closes a late handle after destruction, and reports a shaped `cancelled` result.
- C08 browser FS keeps pending setup separate from active timer records and rechecks liveness after path-resolution and snapshot awaits, preventing a destroyed window from gaining a timer or watch.
- C09 NIP-17 creates the live-map record before relay registration, so a synchronous valid relay delivery has an owner; reentrant teardown closes a returned handle instead of leaking it.
- Updated the review inventory with separate authority mappings, regressions, and commits for C07, C08, and C09. No GitHub review replies or thread resolutions were made.

## Verification

- `pnpm exec vitest run packages/services/src/fs-service.test.ts packages/paja/src/browser-fs.test.ts packages/services/src/dm-service.test.ts` — **21 passed**.
- `pnpm test:unit` — **142 files / 1667 tests passed**.
- `pnpm type-check` — **passed**.
- `git diff --check` — **passed**.
- `pnpm exec aislop` remains unavailable locally (`Command "aislop" not found`); no rule configuration was changed.

## Task Commits

1. **Task 1: Prevent late service-layer watch ownership** — `de056b6` (`test`), `6ee379b` (`fix`), `7ecc23d` (`docs`)
2. **Task 2: Prevent late browser-backend watch ownership** — `a61c967` (`test`), `f0c3c31` (`fix`), `650f0ac` (`test`), `1f92efa` (`docs`)
3. **Explicitly assigned C09: Retain synchronous NIP-17 delivery** — `f6e4b27` (`test`), `e02f2a4` (`fix`), `3b92e83` (`docs`)

## Decisions Made

- The service and browser FS layers remain separate owners even though both use reserve-and-recheck lifecycle guards: the service owns wire-scoped backend handles; the browser backend owns pending resolution/snapshot state and intervals.
- NAP-FS `b640cf337c0481f0f9a0216c00843f797a5c6df6`, NAP-DM `a0a48588b3c9caca9540cccec19635b85231a00f`, and NIP-5D `eb45dfd7335b7f88cb53781984c553581d2b4c34` were re-read before their respective changes. The resulting wire behavior is conformant; record reservation and cancellation are bounded Kehto lifecycle policies where the NAP does not prescribe setup ordering.

## Deviations from Plan

### Explicitly Assigned Scope

**1. Implemented C09 NIP-17 synchronous callback ownership**

- **Reason:** The execution assignment explicitly included C09 even though the written Plan 03 task list named only C07/C08.
- **Files modified:** `packages/services/src/dm-nip17-adapter.ts`, `packages/services/src/dm-service.test.ts`, review inventory.
- **Verification:** Focused DM unit suite, full unit suite, and full type-check passed.
- **Committed in:** `f6e4b27`, `e02f2a4`, `3b92e83`.

**Impact on plan:** This remained within the assigned review-invariant scope and did not touch later-plan files.

## Known Stubs

None.

## Next Phase Readiness

Plans 04–06 can rely on C07/C08/C09 as fixed with immutable authority evidence. All three review threads remain unresolved until the final plan pushes the supporting commits and verifies exact-head CI.

## Self-Check: PASSED

All seven modified artifacts exist, all ten task commits are present, the C07/C08/C09 inventory rows carry their authority and regression evidence, and the focused plus repository-wide verification commands pass.
