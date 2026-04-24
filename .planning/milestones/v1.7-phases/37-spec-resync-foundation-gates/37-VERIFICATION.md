---
phase: 37-spec-resync-foundation-gates
verified: 2026-04-24T14:00:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 37: SPEC Resync + Foundation Gates Verification Report

**Phase Goal:** The canonical NIP-5D spec is current, the provisional local type strategy is established, and the v1.6 E2E baseline is confirmed unbroken — so all downstream phases build on verified ground.
**Verified:** 2026-04-24
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `specs/NIP-5D.md` body matches upstream dskvr/nips nip/5d at a recorded commit SHA; class-posture delegation paragraph present; sync header refreshed | VERIFIED | File exists; SHA `d80d7b25f9c4331acbeb40dbeb3b077caa80e885` recorded at line 5; "Class-posture delegation" present at line 124; "milestone v1.7, 2026-04-24" at line 4 |
| 2 | Three provisional type files exist under `packages/shell/src/types/` each marked `// provisional` and `TODO: swap import` | VERIFIED | All three files exist; `grep -l "// provisional"` returns 3; `grep -l "TODO: swap import"` returns 3; version-specific TODO strings verified per file |
| 3 | `pnpm clean && pnpm build && pnpm test:e2e` records 54/0/0 — no regression | VERIFIED | `37-ITERATION-LOG.md` records "54 passed / 0 failed / 0 skipped (19.9s)"; E2E-19 gate explicitly cleared |
| 4 | `README.md` Specification section cross-reference to `specs/NIP-5D.md` is valid and reflects v1.7 sync date | VERIFIED | Line 67 reads "Last synced at **v1.7** (2026-04-24)"; old v1.2 line gone (count=0); file cross-referenced at lines 6 and 65; `specs/NIP-5D.md` exists on disk |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `specs/NIP-5D.md` | Canonical NIP-5D spec resynced from upstream nip/5d branch | VERIFIED | 131 lines; header comment present as line 1; upstream SHA recorded; "Class-posture delegation" body paragraph present; extended Security Considerations item 1 ("load-bearing precondition for browser-enforced isolation") present |
| `README.md` | Updated Specification section reflecting v1.7 resync date | VERIFIED | "Last synced at **v1.7** (2026-04-24)" at line 67; both spec links valid |
| `packages/shell/src/types/provisional-class.ts` | NUB-CLASS wire types — provisional staging | VERIFIED | 36 lines; `// provisional` line 1; `TODO: swap import to @napplet/nub/class when published at ^0.3.0`; exports `NappletClass`, `ClassAssignmentPayload` |
| `packages/shell/src/types/provisional-connect.ts` | NUB-CONNECT wire types — provisional staging | VERIFIED | 59 lines; `// provisional` line 1; `TODO: swap import to @napplet/nub/connect when published at ^0.3.0`; exports `ConnectGrantKey`, `ConnectGrant`, `ConsentResult`, `ConnectConsentRequest` |
| `packages/shell/src/types/provisional-resource.ts` | NUB-RESOURCE wire types — provisional staging | VERIFIED | 94 lines; `// provisional` line 1; `TODO: swap import to @napplet/nub/resource when published at ^0.2.2`; exports full 4-message protocol types including `ResourceInbound`/`ResourceOutbound` unions |
| `.planning/phases/37-spec-resync-foundation-gates/37-ITERATION-LOG.md` | Canonical v1.6-format iteration log recording 54/0/0 | VERIFIED | File exists; "54 passed" count=6; "0 failed" count=5; "0 skipped" count=5; HEAD SHA `889d5a0` recorded; zero unsubstituted placeholders |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `README.md` | `specs/NIP-5D.md` | Markdown relative link `[`specs/NIP-5D.md`](./specs/NIP-5D.md)` | WIRED | Link present at line 65; file exists on disk |
| `specs/NIP-5D.md` header comment | upstream dskvr/nips nip/5d branch | Source URL + Synced-at date + commit SHA | WIRED | Source URL present (count=1); "milestone v1.7, 2026-04-24" present; 40-char SHA `d80d7b25f9c4331acbeb40dbeb3b077caa80e885` recorded at line 5 |
| provisional-class.ts / provisional-connect.ts / provisional-resource.ts | future `@napplet/nub/{class,connect,resource}` imports | `TODO: swap import` comment referencing published semver range | WIRED | All three files carry the TODO with version-specific ranges (`^0.3.0`, `^0.3.0`, `^0.2.2`); confirmed by grep returning count=1 per file |
| `37-ITERATION-LOG.md` result line | v1.6 close baseline (54/0/0) | Byte-for-byte match on pass/fail/skip counts | WIRED | "54 passed / 0 failed / 0 skipped" present; "Phase 37 E2E-19 gate clears" present |

### Data-Flow Trace (Level 4)

Not applicable. Phase 37 delivers documentation (spec resync, README update), staging type files, and a test baseline record — none of these render dynamic data to a UI. The provisional type files are intentionally not imported by any consumer yet; data flow begins in Phases 38/39/40.

### Behavioral Spot-Checks

Not applicable for this phase. No runnable entry points were added or modified. The canonical verification for this phase is the iteration loop result recorded in `37-ITERATION-LOG.md`, which captures actual `pnpm test:e2e` output (54 passed, 19.9s) — this is a recorded run, not a live check. Behavioral integrity is confirmed by the existing 54-spec green suite.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SPEC-04 | 37-01-PLAN.md | `specs/NIP-5D.md` updated byte-identical to upstream at a recorded commit SHA; header comment sync date + commit SHA refreshed | SATISFIED | SHA `d80d7b25...` at spec line 5; "milestone v1.7" at line 4; class-posture delegation paragraph confirmed at line 124; Security Considerations item 1 extended text confirmed |
| E2E-19 | 37-02-PLAN.md | Entering v1.7 Phase 1: canonical pnpm clean+build+test:e2e loop records 54/0/0 baseline preserved | SATISFIED | `37-ITERATION-LOG.md` records 54/0/0 result; "Phase 37 E2E-19 gate clears" statement present; HEAD SHA recorded |
| DOCS-06 | 37-01-PLAN.md | `specs/NIP-5D.md` header comment updated to reference v1.7 sync date and upstream commit SHA; README cross-reference verified valid | SATISFIED | README line 67 updated to v1.7 (2026-04-24); old v1.2 line absent; spec file cross-reference at README lines 6 and 65 confirmed valid |

REQUIREMENTS.md traceability table maps all three IDs to Phase 37 and marks them `[x]` (complete). No orphaned requirements detected for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/shell/src/types/provisional-class.ts` | 1 | `// provisional` line comment | Info | By design — this IS the required provisional marker, not an anti-pattern |
| `packages/shell/src/types/provisional-connect.ts` | 1 | `// provisional` line comment | Info | By design |
| `packages/shell/src/types/provisional-resource.ts` | 1 | `// provisional` line comment | Info | By design |

No blocking anti-patterns found. The `// provisional` markers are the explicit required annotation, not accidental stubs. No `TODO` comments indicate unfinished functionality — all three files are complete staging definitions. No `return null`, `return []`, or empty implementation patterns present (these are pure type files with no runtime logic). No existing code imports the provisional files, confirming they are correctly staged and not accidentally wired.

### Human Verification Required

None. All four success criteria are verifiable programmatically:

1. Spec content verified by grep against the actual file.
2. Provisional file content verified by grep and direct inspection.
3. E2E result captured verbatim in `37-ITERATION-LOG.md` — no human re-run required.
4. README cross-reference verified by grep + file existence check.

### Gaps Summary

No gaps. All must-haves pass at all applicable levels (exists, substantive, wired). The phase goal is fully achieved.

---

## Summary

Phase 37 delivers exactly what the ROADMAP goal specifies:

- `specs/NIP-5D.md` is current: resynced from upstream dskvr/nips branch nip/5d at commit `d80d7b25f9c4331acbeb40dbeb3b077caa80e885` (2026-04-24). The class-posture delegation paragraph is present. The extended Security Considerations item 1 prose is present. The sync header records v1.7 date and the full 40-character SHA.

- Provisional local type strategy is established: three files under `packages/shell/src/types/` (provisional-class.ts, provisional-connect.ts, provisional-resource.ts) each carry the required `// provisional` marker and version-specific `TODO: swap import` annotation. None are exposed in the public barrel or imported by any consumer — correctly staging-only for Phases 38/39/40.

- v1.6 E2E baseline confirmed unbroken: `37-ITERATION-LOG.md` records 54 passed / 0 failed / 0 skipped (19.9s) against the built `:4174` demo after Plan 37-01 changes landed. The E2E-19 gate is cleared.

All three Phase 37 REQ-IDs (SPEC-04, E2E-19, DOCS-06) are fully satisfied with evidence in the codebase.

---

_Verified: 2026-04-24_
_Verifier: Claude (gsd-verifier)_
