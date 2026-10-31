---
quick_id: 261031-ia2
status: issues_found
blockers: 0
warnings: 4
checked: 2026-10-31
---

# Plan check: 261031-ia2 experimental NAPs on kehto

Authority: GOAL.md final revision (lines 96-155). Lines 1-95 are earlier pasted drafts and are superseded.

## Coverage (goal -> plan decision/task -> evidence)

| Item | Plan | Evidence | Status |
|---|---|---|---|
| D1 ShellAdapter.extensions, tri-state, resolveEnvironment | LD3, T3 | 35deda8c; VERIFICATION.md:63 | covered |
| D2 prelude bindings, provenance | LD3, T3 | 35deda8c; VERIFICATION.md:64 | covered |
| D3 x- ACL caps, no new bits | LD1, T1 | d21ccb33; VERIFICATION.md:65 | covered |
| D4 scoped extension push | LD2, T2 | dca060ff + fix 1a9088f9 (runtime.ts:473 routes all x- handler pushes through the scoped path) | covered after gap closure |
| D5 Paja extensions, states, parity, log | LD4, T4 | 975d08a3, 1c6fe588, 1a9088f9 (browser-host.ts:414 uses getUnexpectedAdvertisedDomains) | covered after gap closure |
| D6 playground + ACL panel | LD5, T5 | 6db7b225, caaaa5e6 | covered |
| D7 how-to + links | LD7, T7 | f6e9d25f | covered |
| D8 skill + byte-synced templates + shipping | LD8, T7 | 7cc66763, 30a03fab | covered |
| H1 no shadowing; accept+reject tests | LD1/LD3 | acl/extensions.test.ts, fixtures/experimental-nap/shadow-llm.js; built-in push forgery closed in 1a9088f9 | covered |
| H2 router security unchanged | LD2 | VERIFICATION.md:77 | covered |
| H3 no credentials/vault; regression | not explicit in plan | shell-extensions.test.ts; Paja context pin in tests/unit/experimental-nap.test.ts (1a9088f9) | covered (see W2) |
| H4 built-ins unchanged; originRegistry compat | LD3 | KEHTO_COMPAT_SHELL_ENV_OVERRIDE, docs/compatibility.md | covered |
| Spec check + refs + upstream draft | PLAN.md:12-19, LD7 | UPSTREAM-PROPOSAL-DRAFT.md | covered |
| A1 fixture + unit + Chromium e2e both hosts | LD6, T6 | tests/fixtures/experimental-nap/, tests/e2e/experimental-nap.spec.ts | covered |
| A2 skill checks + dry run | LD8 | tests/unit/experimental-nap-skill.test.ts; SUMMARY.md:19 | covered |
| A3 gates | T7 | VERIFICATION.md:148 (post-fix gates) | covered |
| A4 minor changesets | T7 | .changeset/experimental-naps-{acl,runtime,shell,paja,playground}.md | covered (services unchanged, correctly not bumped) |
| A5 branch + GSD flow | PLAN.md:4 | 14 commits on feat/experimental-naps | covered (see W3) |
| A6 open PR with refs/gaps/skill location | T7 | PR #363 OPEN | covered |

No requirement lacks a task or evidence. No blockers remain; the verifier's BLOCKER (gap 1) is fixed in 1a9088f9.

## Warnings

1. [task_completeness] PLAN.md:48-55. The seven tasks are one-line titles with no files, action, verify or done fields. The plan could not guard execution on its own; coverage was recovered by the verifier, not the plan. Fix: for future --full runs, give each task files, verify and done.
2. [requirement_coverage] PLAN.md:21-47. H3 (no credentials, signer secrets or Paja vault reach extensions) has no locked decision or task. That omission is how gap 2 (VERIFICATION.md:25-35) reached execution. Closed in 1a9088f9, but the plan never named it.
3. [plan/execution drift] PLAN.md:39 locks Paja config `extensions: string[]`. The executed shape is objects `{ module, settings }` (tests/unit/experimental-nap.test.ts:133; config-file.ts:32). That change is reasonable, since D7 needs a setting to move from unconfigured to supported, but PLAN.md was not updated. PLAN.md:4 also records a deviation: discuss and research ran inline, not as spawned agents.
4. [verification_derivation] PLAN.md has no must_haves. The verifier's 18 items (VERIFICATION.md:6) were derived after execution. Unrelated: GOAL.md is a corrupted paste of several drafts, so later readers should be pointed at lines 96-155.

## Recommendation

Execution matches the plan's locked decisions, apart from W3, and every GOAL.md deliverable, constraint and acceptance item has commit evidence. The warnings concern plan quality, not the delivered result. Status is issues_found only because those warnings exist. Proceeding to ship is reasonable.
