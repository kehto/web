---
phase: quick-260802-o1w
plan: 01
subsystem: nip-5d
tags: [nap-intent, nip-5d, rebase, github-actions, changesets]
requires:
  - phase: kehto-web-232
    provides: "Published Napplet package and provenance adoption on main"
provides:
  - "Linearly rebased #229 host-side NAP-INTENT orthogonality fix"
  - "Fresh exact-SHA CI evidence for the rebased implementation head"
affects: [nip-manifest-parser, playground-manifest-validation, pr-229]
tech-stack:
  added: []
  patterns:
    - "Validate routing archetype slugs and payload convention identities independently under NAP-INTENT"
key-files:
  created:
    - .changeset/intent-authority-conformance.md
    - .planning/debug/resolved/hyprgate-intent-authority.md
  modified:
    - packages/nip/src/5d/index.ts
    - apps/playground/napplets/shared-vite-config.ts
    - RUNTIME-SPEC.md
    - packages/nip/src/5d/index.test.ts
    - tests/unit/nip5d-conformance-guard.test.ts
    - tests/unit/playground-gateway-guard.test.ts
key-decisions:
  - "NAP-INTENT 5ac0490 is authoritative: routing archetype and payload convention are orthogonal N:M values."
  - "Rebase #229 onto #232 without changing the published package/provenance line or the @kehto/nip patch changeset."
requirements-completed: [QUICK-260802-O1W]
coverage:
  - id: D1
    description: "Parser and playground builder accept a valid routing slug paired with a different convention URI archetype token while retaining syntax validation."
    requirement: QUICK-260802-O1W
    verification:
      - kind: unit
        ref: "pnpm exec vitest run packages/nip/src/5d/index.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts"
        status: pass
      - kind: e2e
        ref: "pnpm test:e2e"
        status: pass
    human_judgment: false
duration: 11min
completed: 2026-08-02
status: complete
---

# Quick Task 260802-o1w Plan 01: Refresh kehto/web#229 after #232 Summary

**Rebased PR #229 onto #232’s published Napplet package line while retaining the host-side NAP-INTENT N:M archetype/convention fix and fresh successful exact-SHA CI.**

## Performance

- **Duration:** ~11 min
- **Completed:** 2026-08-02T16:38:36Z
- **Tasks:** 3/3
- **Files in implementation diff:** 8

## Accomplishments

- Checked `napplet/naps` NAP-INTENT at exact master commit `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. Its request fields, wire directionality, lifecycle, and security rules explicitly keep routing `archetype` and payload `convention` orthogonal N:M; the host equality-check removal is conformant.
- Rebased `fix/intent-authority-conformance` linearly onto fetched `origin/main` `2be0de741245f51dea00592d162ae2d8c003eba9` (#232), producing `599f55cde23231a7ba14b6ccf0214b1d2b422e2c` with no merge commits or manifest/lockfile diff.
- Preserved #232’s current package/provenance adoption, #229’s strict parser/builder validation and regressions, the existing `@kehto/nip` patch changeset, and the resolved Hyprgate diagnosis.
- Updated PR #229’s body with the published `@napplet/nap@0.31.2` / `@napplet/vite-plugin@0.14.1` status, Version Packages #198 source `dc1d24153c759152b6ba31a6ec9bea967798f2df`, #232 merge, the exact retained conformance sentence, and complete local verification.
- Lease-pushed the implementation head from recorded remote OID `ee1cb415455a2af87ece2af178d2b6a55ee90d41`; PR head OID matched `599f55cde23231a7ba14b6ccf0214b1d2b422e2c` and its new CI runs completed successfully.

## Verification

- Focused Vitest: 3 files, 77 tests — pass.
- `pnpm build` — pass.
- `pnpm type-check` — pass.
- `pnpm test:unit` — 128 files, 1,566 tests — pass.
- `pnpm test:e2e` — 82 Playwright tests — pass.
- `pnpm docs:check`, `pnpm audit:csp`, and `git diff --check origin/main...HEAD` — pass.
- `npx --yes aislop@0.12.0 scan -d` — **100/100 Healthy**.
- Fresh PR implementation-head CI: [CI run 30756827488](https://github.com/kehto/web/actions/runs/30756827488) passed Detect CI Scope, Vitest, Build & Type-Check, Detect Playwright Scope, and Playwright; [changeset-deletion run 30756827489](https://github.com/kehto/web/actions/runs/30756827489) passed.

## Task Commits

1. **Task 1: Rebase #229 and preserve one orthogonal manifest path end to end** — `599f55c` (`fix(nip): accept orthogonal intent conventions`), replayed linearly from the approved branch.
2. **Task 2: Prove the reconciled branch with focused and full release gates** — no additional commit; all gates passed without a corrective change.
3. **Task 3: Refresh PR #229, publish both heads safely, and observe fresh CI twice** — implementation head `599f55c` force-pushed with explicit lease; first exact-head CI passed.

## Files Created/Modified

- `packages/nip/src/5d/index.ts` — removes only the invalid equality check while retaining strict manifest-tag and convention syntax validation.
- `apps/playground/napplets/shared-vite-config.ts` — applies the same independent convention validation at build time.
- `packages/nip/src/5d/index.test.ts` and `tests/unit/playground-gateway-guard.test.ts` — protect a `bookmark` routing role with `napplet:note/open` payload convention.
- `tests/unit/nip5d-conformance-guard.test.ts` and `RUNTIME-SPEC.md` — lock and explain the NAP-INTENT N:M authority alongside current #232 release facts.
- `.changeset/intent-authority-conformance.md` — remains a single `@kehto/nip` patch release entry.
- `.planning/debug/resolved/hyprgate-intent-authority.md` — retained resolved diagnostic record.

## Decisions Made

- Treat the exact NAP-INTENT authority as controlling over prior local equality guards: the routing role does not constrain the convention URI’s archetype token.
- Keep #232’s package/provenance state verbatim by rebasing on its merge and retaining only the #229 implementation diff.
- Do not make the requested GSD bookkeeping commit here. The root quick orchestrator owns the later PLAN/SUMMARY/VERIFICATION/STATE-only commit and second lease-protected push.

## Deviations from Plan

None - the rebase applied cleanly, so semantic overlap resolution was verified by the resulting diff and complete current package/provenance guards rather than by a conflict edit.

## Protected Debug Note

`.planning/debug/jsr-release-scope-auth.md` remained untracked and unstaged with SHA-256 `2756e205643d7e8c8388cb8bfb1d05d10d5348860bf7c3c19560b0ddf45aebaa` before rebase, after every gate, and at final inspection.

## Second-Head CI Handoff

The required first implementation-head observation is complete for `599f55cde23231a7ba14b6ccf0214b1d2b422e2c`. The root quick orchestrator must, after the independent verifier writes `260802-o1w-VERIFICATION.md`, update `STATE.md`, create one separate docs commit containing only the task PLAN, SUMMARY, VERIFICATION, and STATE paths, then:

1. Record `599f55cde23231a7ba14b6ccf0214b1d2b422e2c` as the explicit expected remote lease OID.
2. Push the GSD-artifact head with `--force-with-lease=refs/heads/fix/intent-authority-conformance:599f55cde23231a7ba14b6ccf0214b1d2b422e2c`.
3. Confirm PR #229 remains open on `fix/intent-authority-conformance`, and its `headRefOid` equals that docs-commit SHA.
4. Observe all checks actually attached to that new SHA through a successful terminal conclusion. The first-head CI above is not terminal evidence after this documentation-only commit.

## Known Stubs

None found in the implementation/test/docs paths changed by this task.

## Next Phase Readiness

PR #229 is open at the successfully verified implementation head and ready for the orchestrator’s independent verification and GSD-artifact closeout. Do not merge the PR as part of this task.

## Self-Check

PASSED — summary exists, rebased implementation commit `599f55c` exists in history, and the protected debug note remains byte-identical, untracked, and unstaged.
