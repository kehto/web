---
phase: 14-dispatch-refactor
verified: 2026-04-17T22:38:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 14: Dispatch Refactor Verification Report

**Phase Goal:** Replace @kehto/runtime's hand-rolled domain switch with napplet/core's formal dispatch infrastructure (createDispatch / registerNub / dispatch).
**Verified:** 2026-04-17T22:38:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | createRuntime() constructs its NUB dispatcher via createDispatch() imported from @napplet/core (DISPATCH-01) | VERIFIED | runtime.ts:13 `import { createDispatch } from '@napplet/core'`; runtime.ts:1064 `const nubDispatch = createDispatch();` |
| 2 | All 8 nub domain handlers (relay, identity, keys, media, notify, storage, ifc, theme) registered through registerNub() at runtime startup (DISPATCH-02) | VERIFIED | runtime.ts:1099-1106 — exactly 8 `nubDispatch.registerNub(...)` calls in canonical order; grep count = 8 |
| 3 | runtime.ts contains zero domain-specific switch/case branches for NUB messages (DISPATCH-03) | VERIFIED | `grep -cE "case '(relay\|identity\|keys\|media\|notify\|storage\|ifc\|theme)':"` returns 0; remaining `switch` statements (lines 346, 480, 743, 832) operate on intra-handler `topic`/`action`, not NUB domain routing |
| 4 | Inbound NUB envelope routing delegates entirely to nubDispatch.dispatch() (DISPATCH-03) | VERIFIED | runtime.ts:1133-1138 — `currentWindowId = windowId; try { nubDispatch.dispatch(envelope); } finally { currentWindowId = null; }` is the sole post-ACL dispatch path |
| 5 | ACL enforce gate continues to run BEFORE dispatch() call — unchanged semantics | VERIFIED | runtime.ts:1117-1126 — resolveCapabilitiesNub + enforceNub gate runs first; on denial returns BEFORE the dispatch block; on allow falls through to dispatch |
| 6 | Unknown domains silently dropped per NIP-5D spec (dispatch returns false; no fallthrough emission) | VERIFIED | dispatch.test.ts:920 test "unknown NUB domain: dispatch returns false, no envelope emitted" passes; `bogus.action` envelope produces ctx.sent.length === 0 |
| 7 | All existing dispatch.test.ts tests continue to pass (structural change, not behavioral) | VERIFIED | `pnpm exec vitest run packages/runtime/src/dispatch.test.ts` → 55 passed; full monorepo `pnpm exec vitest run` → 449 passed / 19 skipped (468 total); type-check clean |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/runtime/src/runtime.ts` | createDispatch-based NUB dispatcher + 8 registerNub adapter calls; no switch | VERIFIED | Contains `createDispatch` import (line 13), `NubHandler` type import (line 14), nubDispatch instance (line 1064), 8 named adapters (lines 1066-1097), 8 registerNub calls (lines 1099-1106), and the post-ACL dispatch block (1133-1138). 0 NUB-domain case statements remain. |
| `packages/runtime/src/dispatch.test.ts` | Integration tests asserting createDispatch structural contract | VERIFIED | New describe block at line 878 'createDispatch integration (Phase 14 DISPATCH-01/02/03)' contains 2 tests: 8-domain round-trip (line 879) and unknown-domain silent drop (line 920). Both pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `packages/runtime/src/runtime.ts` | `@napplet/core` | `import { createDispatch }` | WIRED | Line 13: `import { createDispatch } from '@napplet/core';` — pattern `import.*createDispatch.*from.*'@napplet/core'` returns 1 match |
| handleMessage (runtime.ts) | nubDispatch.dispatch(envelope) | post-ACL dispatch delegation | WIRED | Line 1135: `nubDispatch.dispatch(envelope);` — invoked after ACL gate (lines 1117-1126) inside try/finally that manages currentWindowId |
| createRuntime init | 8 handleXxxMessage adapters | named adapter functions passed to registerNub() | WIRED | Pattern `registerNub\('(relay\|identity\|keys\|media\|notify\|storage\|ifc\|theme)'` returns 8 matches at runtime.ts:1099-1106; each adapter (relayAdapter through themeAdapter) reads currentWindowId and delegates to its corresponding handler |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| runtime.ts (handleMessage) | envelope | Inbound message arg from hooks.sendToNapplet caller path | Yes — real NappletMessage flows through dispatch | FLOWING |
| runtime.ts (adapters) | currentWindowId | Set in handleMessage before dispatch (line 1133), cleared in finally (line 1137) | Yes — real windowId from caller | FLOWING |
| dispatch.test.ts (test 1) | ctx2.sent | Mock adapter captures real outbound envelopes from runtime | Yes — assertion verifies all 8 domains produce ≥1 response | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 14 dispatch tests pass | `pnpm exec vitest run packages/runtime/src/dispatch.test.ts` | 55 passed | PASS |
| Full runtime test suite passes | `pnpm exec vitest run packages/runtime` | 101 passed (6 files) | PASS |
| Full monorepo test suite passes | `pnpm exec vitest run` | 449 passed / 19 skipped (468 total, 30 files) | PASS |
| Runtime package type-checks | `pnpm --filter @kehto/runtime type-check` | clean (no output) | PASS |
| Zero NUB-domain case statements | `grep -cE "case '(relay\|identity\|keys\|media\|notify\|storage\|ifc\|theme)':" packages/runtime/src/runtime.ts` | 0 | PASS |
| Exactly one createDispatch import | `grep -cE "import.*createDispatch.*from.*'@napplet/core'" packages/runtime/src/runtime.ts` | 1 | PASS |
| Exactly 8 registerNub calls | `grep -cE "registerNub\('(relay\|identity\|keys\|media\|notify\|storage\|ifc\|theme)'" packages/runtime/src/runtime.ts` | 8 | PASS |
| core-compat.ts preserved (DRIFT-CORE-06) | `git log --oneline -1 -- packages/runtime/src/core-compat.ts` | Last touch c0cc091 (Phase 12-10), NOT modified in Phase 14 commits 21f0238/1f327ca | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DISPATCH-01 | 14-01-PLAN | @kehto/runtime creates its dispatcher via createDispatch() from @napplet/core instead of a hand-rolled switch | SATISFIED | runtime.ts:13 import + runtime.ts:1064 invocation. REQUIREMENTS.md line 59 marked `[x]`. |
| DISPATCH-02 | 14-01-PLAN | All eight nub domain handlers registered via registerNub() at runtime startup | SATISFIED | runtime.ts:1099-1106 — 8 registerNub calls in canonical order. Test "registerNub integration: all 8 NUB domains route through createDispatch" passes. REQUIREMENTS.md line 60 marked `[x]`. |
| DISPATCH-03 | 14-01-PLAN | Inbound envelope routing in runtime.ts delegates to dispatch() with no domain-specific branching | SATISFIED | Switch deleted; runtime.ts:1133-1138 sole post-ACL routing block. 0 NUB-domain case statements in file. REQUIREMENTS.md line 61 marked `[x]`. |

No orphaned requirements: REQUIREMENTS.md lines 118-120 map DISPATCH-01/02/03 to Phase 14, and all three appear in 14-01-PLAN's `requirements:` frontmatter.

### Anti-Patterns Found

None. Diff scan of phase 14 commits (21f0238, 1f327ca) for TODO/FIXME/XXX/HACK/PLACEHOLDER markers returned 0 introduced occurrences. No empty handler returns, no console.log-only implementations, no hardcoded empty data introduced. Adapter functions all delegate to real handlers; null check on currentWindowId is a defensive guard against dispatch invocation outside handleMessage scope, not a stub.

### Human Verification Required

None. All success criteria are programmatically verifiable via grep invariants, type-check, and the 449-test suite. The structural refactor preserves all observable behavior (per the SUMMARY's note that all 447 pre-Phase-14 tests passed unchanged), so no UI/UX or external-service verification is needed.

### Gaps Summary

No gaps. All three success criteria from ROADMAP.md are satisfied:

1. createDispatch is imported from @napplet/core and invoked once per runtime instance (DISPATCH-01).
2. All 8 NUB domain handlers are registered via registerNub() at runtime startup in canonical order (DISPATCH-02).
3. The 8-case domain switch was deleted; routing is now a single nubDispatch.dispatch(envelope) call inside a try/finally (DISPATCH-03).

ACL semantics are preserved (gate runs before dispatch). Unknown-domain silent-drop behavior is preserved (verified by Test 2). DRIFT-CORE-06 compat shim (core-compat.ts) is untouched as scoped. Test suite went from 447 to 449 (2 new integration tests), all green. Type-check clean. Phase 14 is a single-plan phase, so plan completion equals phase completion. Ready for Phase 15 (Milestone Validation & Release Prep).

---

_Verified: 2026-04-17T22:38:00Z_
_Verifier: Claude (gsd-verifier)_
