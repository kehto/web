---
phase: 14-dispatch-refactor
plan: 01
subsystem: runtime
tags: [napplet-core, dispatch, nub-routing, acl]

# Dependency graph
requires:
  - phase: 12-shell-conformance-seven-nub-coverage
    provides: All 7 non-theme NUB handlers (relay, identity, keys, media, notify, storage, ifc)
  - phase: 13-theme-nub-implementation
    provides: Theme NUB handler (theme.get fallback + theme-service coexistence)
provides:
  - createDispatch-based NUB routing inside createRuntime()
  - 8 named adapter functions bridging NubHandler shape to handleXxxMessage(windowId, envelope)
  - runtime-scoped currentWindowId closure pattern for adapter-to-handler windowId handoff
  - deletion of 8-case domain switch; runtime no longer reimplements dispatch
affects: [15-milestone-validation-release-prep, future-nub-additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-runtime createDispatch() instance (not module-level singleton) for per-runtime isolation"
    - "closure-scoped currentWindowId with try/finally guard bridges NubHandler(msg) to handleXxxMessage(windowId, msg) without rewriting 8 handler signatures"
    - "Named adapter functions (not inline arrows) passed to registerNub() for readable stack traces"

key-files:
  created: []
  modified:
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/dispatch.test.ts

key-decisions:
  - "Per-runtime createDispatch() instance — not module-level singleton — to match kehto's closed-over-state pattern (serviceRegistry, aclState, sessionRegistry)"
  - "Option B (runtime-scoped currentWindowId variable) chosen over per-message re-registration (registerNub throws on duplicate) and envelope mutation (surprise side channel)"
  - "Named adapter functions (relayAdapter, identityAdapter, etc.) instead of inline arrows in registerNub() calls — preserves stack traces on error paths"
  - "8 handleXxxMessage signatures preserved untouched — refactor is structural, not behavioral"
  - "core-compat.ts deliberately untouched — DRIFT-CORE-06 is NOT dispatch-related and stays tracked separately"
  - "unused `domain` local variable removed from handleMessage() after switch deletion (dispatch() extracts domain internally)"

patterns-established:
  - "createDispatch integration test pattern: structural test asserts all 8 domains produce ≥1 response envelope (proves registerNub round-trip) + unknown-domain drop test (proves NIP-5D silent-drop contract)"
  - "Runtime-scoped closure variable bridges NubHandler signature mismatches — reusable for future dispatch additions that need extra context beyond NappletMessage"

requirements-completed: [DISPATCH-01, DISPATCH-02, DISPATCH-03]

# Metrics
duration: 2 min
completed: 2026-04-17
---

# Phase 14 Plan 01: Dispatch Refactor Summary

**Replaced kehto's hand-rolled 8-case NUB domain switch with @napplet/core's formal createDispatch()/registerNub()/dispatch() infrastructure via per-runtime instance and closure-scoped windowId bridge — zero behavioral change, full structural migration.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-17T20:30:52Z
- **Completed:** 2026-04-17T20:33:37Z
- **Tasks:** 2 (both type=auto, tdd=true)
- **Files modified:** 2

## Accomplishments

- createDispatch + NubHandler imported from @napplet/core into runtime.ts
- Per-runtime `nubDispatch` instance constructed inside createRuntime() via createDispatch()
- 8 named adapter functions (relayAdapter, identityAdapter, keysAdapter, mediaAdapter, notifyAdapter, storageAdapter, ifcAdapter, themeAdapter) registered exactly once at runtime init
- 8-case domain switch in handleMessage() (runtime.ts:1078-1088) DELETED, replaced with `currentWindowId = windowId; try { nubDispatch.dispatch(envelope); } finally { currentWindowId = null; }`
- ACL enforce gate unchanged and still runs BEFORE dispatch() — identical semantics
- 8 handleXxxMessage function signatures and bodies untouched (structural refactor, not behavioral)
- 2 new integration tests added (registerNub 8-domain round-trip + unknown-domain silent drop)
- DRIFT-CORE-06 compat shim (core-compat.ts) preserved — NOT in scope for this plan

## Task Commits

Each task was committed atomically with --no-verify (parallel-executor convention):

1. **Task 1 (RED): Add createDispatch integration tests** — `21f0238` (test)
2. **Task 2 (GREEN): Replace domain switch with createDispatch + 8 registerNub adapters** — `1f327ca` (refactor)

_Note: Task 1 tests passed against the current switch-based code as expected — they are structural coverage guards for the Task 2 refactor, not genuine RED failures. The true RED→GREEN distinction is Task 2's grep invariants (0 case statements, ≥1 createDispatch import, 8 registerNub calls) transitioning from 8→0, 0→1, 0→8._

## Files Created/Modified

- `packages/runtime/src/runtime.ts` — Added `import { createDispatch }` + `import type { NubHandler }` from @napplet/core; inserted per-runtime `nubDispatch = createDispatch()` block with 8 named adapters + 8 registerNub() calls (registration order: relay, identity, keys, media, notify, storage, ifc, theme); replaced 8-case switch with `currentWindowId = windowId; try { nubDispatch.dispatch(envelope); } finally { currentWindowId = null; }`; removed unused `domain` local.
- `packages/runtime/src/dispatch.test.ts` — Appended new describe block `'createDispatch integration (Phase 14 DISPATCH-01/02/03)'` with 2 tests: (1) all 8 NUB domains produce ≥1 response envelope (guards registerNub round-trip), (2) unknown domain 'bogus.action' produces zero envelopes (guards NIP-5D silent-drop contract). No existing tests modified.

## Decisions Made

- **Per-runtime createDispatch() instance (not module-level singleton).** Matches kehto's existing closed-over-state pattern (serviceRegistry, aclState, sessionRegistry are all per-runtime). Also avoids cross-test pollution — each createRuntime() call gets its own isolated registry.
- **Option B: runtime-scoped `currentWindowId: string | null` closure variable.** NubHandler receives only `(msg: NappletMessage) => void`, but kehto's 8 handlers need `(windowId, msg)`. Rejected: Option A (re-register per message) fails because registerNub throws on duplicate; Option C (mutate envelope with windowId) leaks a surprise side channel into serialization. Option B matches kehto's established closed-over-state idiom and is trivially reversible.
- **Named adapter functions (not inline arrows).** `const relayAdapter: NubHandler = (msg) => { ... }` preserves stack traces on error paths, per 14-CONTEXT.md specifics section. Inline arrows in registerNub() calls would anonymize the stack frame.
- **Handler signatures untouched.** 8 handleXxxMessage functions (handleRelayMessage, handleIdentityMessage, handleKeysMessage, handleMediaMessage, handleNotifyMessage, handleStorageMessage, handleIfcMessage, handleThemeMessage) keep their `(windowId, envelope) => void | Promise<void>` shape. This preserves direct test-harness call sites and the internal async fire-and-forget semantics match the old `return handleRelayMessage(windowId, envelope)` switch.
- **core-compat.ts preserved.** DRIFT-CORE-06 covers Capability, BusKind, ALL_CAPABILITIES, etc. — NOT dispatch-related. Removal is an upstream concern (napplet/core re-exports), not this phase.
- **Unused `domain` local removed.** `const domain = envelope.type.slice(0, dotIdx);` at runtime.ts:1065 was only referenced by the switch. After switch deletion, grep confirmed zero remaining references — safely removed. `dotIdx` check on runtime.ts:1062-1063 stays — it still guards early return for malformed types before ACL resolution.

## Deviations from Plan

None — plan executed exactly as written.

Both tasks completed in strict order with the pre-specified Edit/Write operations. All grep invariants hit expected values on the first verification pass. No bugs, no missing critical functionality, no blocking issues, no architectural surprises.

## Issues Encountered

- **vitest path quirk (non-issue):** `pnpm --filter @kehto/runtime exec vitest run packages/runtime/src/dispatch.test.ts` fails with "No test files found" because the vitest config uses repo-rooted include globs but `pnpm --filter` changes cwd to the package. Resolved by running `pnpm exec vitest run packages/runtime/...` from repo root. Tests run normally once path is correct. No code change needed; workflow noted for future plans.

## Grep Invariant Confirmation

Final state (all three invariants satisfied):

```
$ grep -cE "case '(relay|identity|keys|media|notify|storage|ifc|theme)':" packages/runtime/src/runtime.ts
0    # expected 0

$ grep -cE "import.*createDispatch.*from.*'@napplet/core'" packages/runtime/src/runtime.ts
1    # expected ≥1

$ grep -cE "registerNub\('(relay|identity|keys|media|notify|storage|ifc|theme)'" packages/runtime/src/runtime.ts
8    # expected exactly 8
```

## Test Delta

- **Before Phase 14:** 447 tests passing (Phase 13 baseline)
- **After Plan 14-01:** 449 tests passing + 19 skipped (2 new createDispatch integration tests added; 447 existing tests unchanged)
- **Full monorepo:** 30 test files passed, 1 skipped; 449 passed + 19 skipped (468 total)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DISPATCH-01, DISPATCH-02, DISPATCH-03 all satisfied and marked complete.
- Phase 14 is a single-plan phase — plan completion = phase completion.
- Ready for Phase 15 (Milestone Validation & Release Prep): DEPS-02, DEPS-03.
- DRIFT-CORE-06 (core-compat.ts shim) remains tracked but is out of scope for v1.2; upstream dependency on napplet/core re-exports before removal.
- No blockers or concerns.

## Self-Check: PASSED

Verification commands:

```
[ -f packages/runtime/src/runtime.ts ] && echo "FOUND: packages/runtime/src/runtime.ts"
# FOUND: packages/runtime/src/runtime.ts

[ -f packages/runtime/src/dispatch.test.ts ] && echo "FOUND: packages/runtime/src/dispatch.test.ts"
# FOUND: packages/runtime/src/dispatch.test.ts

git log --oneline --all | grep -q "21f0238" && echo "FOUND: 21f0238"
# FOUND: 21f0238 (test(14-01): add createDispatch integration tests ...)

git log --oneline --all | grep -q "1f327ca" && echo "FOUND: 1f327ca"
# FOUND: 1f327ca (refactor(14-01): replace NUB domain switch ...)
```

All self-check items verified.

---
*Phase: 14-dispatch-refactor*
*Completed: 2026-04-17*
