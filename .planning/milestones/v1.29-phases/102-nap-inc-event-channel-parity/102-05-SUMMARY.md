---
phase: 102-nap-inc-event-channel-parity
plan: 05
subsystem: paja-inc-browser-proof
tags: [paja, nap-inc, srcdoc, opaque-origin, playwright, shim]
requires:
  - phase: 102-04
    provides: Replacement-safe shared INC prelude with canonical convention normalization and symmetric channels
  - phase: 101-04
    provides: Trusted Paja pre-srcdoc identity registration and frozen shell environment
provides:
  - Static proof that both Paja target modes use the shared protected prelude before executable srcdoc
  - Real opaque-origin Paja coverage after the installed shim reassigns window.napplet
  - Reload-safe INC probe coverage for normalized emit, subscriptions, and correlated channel failures
affects: [paja, nap-inc, phase-104-nap-intent-convention-binding, phase-105-published-napplet-package-adoption]
tech-stack:
  added: []
  patterns: [post-shim srcdoc verification, shell-onReady reload-safe fixture synchronization]
key-files:
  created: []
  modified:
    - packages/paja/src/browser-host.test.ts
    - tests/e2e/paja-single-window.spec.ts
key-decisions:
  - "NAP-INC #89 (4593ce9e301ce098fd3dad64206fcd6f144fa7af), web projection #90 (896c32c92deee68dc4d10fc1132b62df20cccb6f), and symmetric channels #92 (c5cd06f7be6d4690b303949abb26e87ff62f4729) remain the exact authority."
  - "The Paja browser proof serves the installed shim global bundle and verifies the shared prelude restores canonical INC operations after shim namespace assignment."
  - "The reload fixture observes captured shell.init through protected shell.onReady so an early prelude handshake cannot race its raw message listener."
patterns-established:
  - "Host-specific Paja INC coverage must use the real sandboxed srcdoc and post-shim namespace assignment, never a synthetic client."
requirements-completed: [BASE-04, BASE-05, INC-01, INC-02, INC-05, INC-08]
coverage:
  - id: D1
    description: Paja URL and runtime-pointer paths retain trusted pre-srcdoc registration and the shared protected INC boundary.
    requirement: BASE-04
    verification:
      - kind: unit
        ref: packages/paja/src/browser-host.test.ts#registers both Paja target modes before their shared protected INC prelude executes
        status: pass
    human_judgment: false
  - id: D2
    description: An opaque-origin Paja target retains canonical INC through a real shim assignment, normalizes convention queries, receives exact events, correlates channels, and reloads cleanly.
    requirement: INC-05
    verification:
      - kind: e2e
        ref: tests/e2e/paja-single-window.spec.ts#keeps canonical INC protected through the real shim assignment in an opaque Paja srcdoc
        status: pass
    human_judgment: false
metrics:
  duration: 16min
  completed: 2026-07-23
  tasks: 2
  files: 2
status: complete
---

# Phase 102 Plan 05: Paja INC Browser Proof Summary

**Paja’s real opaque-origin srcdoc now proves that the shared, replacement-safe INC API survives the installed shim’s namespace assignment and preserves canonical event/channel behavior across reload.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-23T18:38:00Z
- **Completed:** 2026-07-23T18:54:03Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Guarded both Paja target navigation paths so identity/environment registration precedes the same shared prelude injection and no Paja-owned convention parser or INC client can emerge.
- Served the already-installed `@napplet/shim` global bundle through the real fixture target, then proved canonical post-shim emit/on/channel operations in a sandboxed opaque-origin frame.
- Verified query transposition, runtime-attested delivered event shape, empty channel-list correlation, missing-peer errors, fire-and-forget emits, and fresh post-reload listener state.

## Task Commits

1. **Task 1: Guard Paja's single shared-prelude ownership** — `68fb3df` (test)
2. **Task 2: Exercise canonical INC calls inside a real Paja target** — `72ef95c` (test)

## Files Created/Modified

- `packages/paja/src/browser-host.test.ts` — static source-ownership and target-mode ordering guard.
- `tests/e2e/paja-single-window.spec.ts` — real post-shim Paja INC fixture and reload behavior proof.

## Decisions Made

- Checked `napplet/naps` #89 at `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, #90 at `896c32c92deee68dc4d10fc1132b62df20cccb6f`, and #92 at `c5cd06f7be6d4690b303949abb26e87ff62f4729`; the proof conforms to their attested sender, queryless identity/transposed payload, and symmetric-channel semantics.
- Kept Paja production code unchanged: the host continues to delegate to the shell prelude, and the test alone proves that boundary after a real bundle assignment.
- Used protected `shell.onReady` in the INC fixture alongside its raw listener, ensuring a fast reload cannot miss the prelude-captured `shell.init` event.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Imported the fixture shim-bundle loader**
- **Found during:** Task 2
- **Issue:** The new fixture referenced `readFileSync` without importing it.
- **Fix:** Added the Node filesystem import and reran the focused browser scenario.
- **Files modified:** `tests/e2e/paja-single-window.spec.ts`
- **Verification:** Playwright Paja spec passed.
- **Committed in:** `72ef95c`

**2. [Rule 1 - Integration timing] Made the reload probe consume the captured shell lifecycle**
- **Found during:** Task 2
- **Issue:** On a fast srcdoc reload, the prelude could receive `shell.init` before the fixture’s raw message listener attached, leaving the test probe at `booting`.
- **Fix:** Registered the fixture’s one-shot initialization through the protected `shell.onReady` API while retaining raw envelope observation.
- **Files modified:** `tests/e2e/paja-single-window.spec.ts`
- **Verification:** Focused and complete Paja Playwright specs passed.
- **Committed in:** `72ef95c`

**Total deviations:** 2 auto-fixed Rule 1 test/integration defects. No production scope expansion.

## Issues Encountered

- The AI-slop executable is not installed in this worktree; `npx --no-install aislop scan -d .` correctly declined to download it. No package was installed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Verification

- PASS `pnpm exec vitest run packages/paja/src/browser-host.test.ts` — 10 tests.
- PASS `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1` — 6 tests.
- PASS `pnpm type-check` — full build and 33-package TypeScript validation.
- NOT RUN `aislop` — executable unavailable; no install attempted.

## Next Phase Readiness

- Phase 104 can reuse the same queryless convention identity and projection-side transposition posture for Intent without changing Paja.
- Phase 105 package adoption has a Paja regression that exercises actual shim reassignment rather than a synthetic namespace.

## Self-Check: PASSED

- Found both declared test artifacts and this Summary on disk.
- Found task commits `68fb3df` and `72ef95c` in git history.

---
*Phase: 102-nap-inc-event-channel-parity*
*Completed: 2026-07-23*
