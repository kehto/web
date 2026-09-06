---
phase: 106
slug: active-surface-conformance-and-release
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-27
---

# Phase 106 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 and Playwright 1.54.0 |
| **Config file** | `vitest.config.ts` and `playwright.config.ts` |
| **Quick run command** | `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts tests/unit/sdk-migration-guard.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/napplet-package-alignment.test.ts tests/unit/published-napplet-contract.test.ts packages/shell/src/napplet-namespace.test.ts packages/shell/src/shell-supports-conformance.test.ts tests/unit/identity-theme-conformance-guard.test.ts tests/unit/nap-inc-conformance.test.ts` |
| **Full suite command** | `pnpm test:unit && pnpm test:e2e` |
| **Estimated runtime** | ~150 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused nine-file Vitest command above plus `git diff --check`
- **After every plan wave:** Run `pnpm test:unit` plus the Playwright files affected by that wave
- **Before `$gsd-verify-work`:** `pnpm build`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm docs:check`, the repository-pinned AI-slop scan, and `git diff --check` must be green
- **Max feedback latency:** 15 seconds for focused Vitest sampling

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 106-01-01 | 01 | 1 | VERIFY-06 | T-106-01 | Mutable upstream and registry authorities cannot drift without a recorded semantic verdict. | external integration | `node scripts/verify-napplet-authorities.mjs --check` | ✅ | ✅ green |
| 106-01-02 | 01 | 1 | BASE-03, VERIFY-02 | T-106-02 | Live sources reject obsolete shapes while classified historical evidence remains untouched. | unit/static | `pnpm exec vitest run tests/unit/sdk-migration-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/playground-gateway-guard.test.ts` | ✅ | ✅ green |
| 106-01-03 | 01 | 1 | VERIFY-01 | T-106-04 | Negative wire shapes, source/session isolation, sender spoofing, and query drift fail closed with one machine-verified evidence row per completed Phase 101-105 requirement. | unit/integration + evidence matrix verifier | `node scripts/verify-phase-106-conformance-matrix.mjs --check` | ✅ | ✅ green |
| 106-02-01 | 02 | 2 | VERIFY-03 | T-106-06 | Real Paja and playground paths preserve trusted startup, exact routing, resource mediation, and atomic theme delivery. | E2E | `pnpm test:e2e -- tests/e2e/napplet-auth.spec.ts tests/e2e/inc-roundtrip.spec.ts tests/e2e/nap-inc-playground.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts tests/e2e/playground-profile-intent.spec.ts tests/e2e/profile-open.spec.ts` | ✅ | ✅ green |
| 106-02-02 | 02 | 2 | VERIFY-03, VERIFY-04 | T-106-09 | Phase 105 visual risks receive the locked explicit non-blocking Kehto-maintainer follow-up disposition backed by desktop/mobile evidence. | static evidence + judgment review | positive checklist assertions for audit link, 12/24 score, owner, rationale, and PR/release boundary | ✅ | ✅ green |
| 106-03-01 | 03 | 3 | VERIFY-04, VERIFY-05 | T-106-05 | Only a fully gated branch with complete shipped-output changesets can reach PR readiness. | release gate | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e && pnpm docs:check && npx --yes aislop@0.12.0 scan -d && git diff --check && pnpm changeset status` | ✅ | ✅ green |
| 106-03-02 | 03 | 3 | VERIFY-05 | T-106-11, T-106-13 | The checklist records the validated pushed evidence SHA, and PR #204 records/checks the exact final head; merge/tag/publish remain outside execution. | external integration | exact branch/head/mergeability assertions plus `gh pr checks 204 --required` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/verify-napplet-authorities.mjs` — reproducible GitHub/npm/JSR authority and published-package drift report for VERIFY-06
- [x] `106-AUTHORITY-REVALIDATION.md` — immutable PR/package facts and clause-level semantic verdicts consumed by `--check`
- [x] `scripts/verify-phase-106-conformance-matrix.mjs` — row-by-row requirement, allowlisted test-file, exact-title, command, result, and focused-suite verifier for VERIFY-01
- [x] `106-CONFORMANCE-MATRIX.md` — one machine-verified focused-evidence row per completed Phase 101-105 requirement
- [x] `.planning/phases/106-active-surface-conformance-and-release/106-RELEASE-CHECKLIST.md` — exact command results, allowed E2E skip, changeset status, pushed SHA/CI evidence, and Phase 105 UI-risk disposition

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Semantic meaning of upstream NAP text matches Kehto behavior | VERIFY-06 | A text diff can identify changed clauses but cannot responsibly infer protocol equivalence. | Record each PR’s immutable ref and state, compare the changed NAP sections, and classify Kehto as conformant, repaired, deferred spec gap, or blocked. |
| Phase 105 UI warning wording | VERIFY-03, VERIFY-04 | The locked non-blocking disposition is judgment-tier transparency evidence and must not be restated as a visual pass. | Link `105-UI-REVIEW.md`, retain its 12/24 findings, and confirm the checklist/PR assign a separate post-merge follow-up to Kehto maintainers with protocol-conformance rationale. |
| Exact pushed commit and GitHub checks | VERIFY-05 | PR mergeability and CI status exist outside the local repository. | Push the branch, inspect PR #204 at each pushed SHA, record the validated evidence SHA/CI in the checklist, then record the exact final head and check URLs in the PR body without making another repository mutation. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated on 2026-07-27

## Validation Audit 2026-07-27

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Authority revalidation, the 47-requirement conformance matrix (9 files / 97
tests), the full release gate, exact-head hosted checks, and the user-accepted
judgment-tier UI-debt disposition cover every Phase 106 task and requirement.
