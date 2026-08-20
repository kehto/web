---
status: awaiting_human_verify
trigger: "PR #236 Detect CI Scope fails when a newly added package is absent from the base commit"
created: 2026-08-20
updated: 2026-08-20
---

# Debug Session: CI guard new package base

## Symptoms

- expected_behavior: "The Napplet dependency direction guard accepts a newly added package after validating its head manifest, because no base version exists to decrease from."
- actual_behavior: "The CI detector fails closed while trying to read the new packages/shell-ipc/package.json from the PR base SHA."
- error_messages: "fatal: path 'packages/shell-ipc/package.json' exists on disk, but not in base; check-napplet-dependency-direction.mjs could not parse the base manifest."
- timeline: "Observed in PR #236 run 32385731666 after the complete v1.30 branch was pushed on 2026-08-20."
- reproduction: "Run scripts/check-napplet-dependency-direction.mjs with base f031d5d2264d047cd40e2524bf12b7f68c74caa6 and head 22e06375bc6dc34e01b1404d00f427f2b29e5dde."

## Current Focus

- hypothesis: "The guard enumerates package manifests from the head tree but unconditionally git-shows the same path from the base tree, conflating a missing new-package base manifest with an unreadable existing manifest."
- test: "Await a PR #236 CI rerun after the fix is committed and pushed."
- expecting: "The Detect CI Scope job passes the dependency-direction step for packages/shell-ipc/package.json."
- next_action: "Commit and push the scoped guard/test change, then confirm GitHub Actions run Detect CI Scope succeeds before marking this session resolved."
- reasoning_checkpoint:
    hypothesis: "The guard fails for new packages because main calls manifestAt(base, path) for every changed head manifest; a package absent from the base tree has no prior declaration to compare."
    confirming_evidence:
      - "The recorded PR base/head reproduction exits at git show base:packages/shell-ipc/package.json before range validation."
      - "An agent-authored temporary Git history with a head-only package reproduces the same exit-1 error; its test is red."
    falsification_test: "If the temporary test's base tree contains packages/new-package/package.json yet the guard fails identically, absence from the base tree is not the cause."
    fix_rationale: "Probe the valid base tree for the exact path and skip comparison only when it is absent, while still parsing the head manifest and preserving hard failures for present-but-invalid manifests or Git command errors."
    blind_spots: "The existing tests do not yet prove malformed JSON in a base manifest remains a failure; add that preserving test before accepting the fix."
    candidate_causes:
      - "code: main unconditionally loads a base manifest for paths enumerated from the head diff."
      - "data: a newly added package legitimately has no historical base manifest."
      - "environment: a shallow or invalid Git history could make a valid historical manifest unreadable, but the deterministic temporary repository reproduces without either condition."
    and_gate: "no — a missing base path alone deterministically produces the failure; new-package input is the trigger, not an independent defect."
- tdd_checkpoint: ""

## Evidence

- timestamp: "2026-08-20T15:22:37Z"
  source: "GitHub Actions run 32385731666"
  finding: "Detect CI Scope failed only in Reject Napplet dependency version decreases because packages/shell-ipc/package.json does not exist at the PR base SHA."

- timestamp: "2026-08-20T15:48:00Z"
  source: "local reproduction"
  finding: "Running the guard with --base f031d5d2264d047cd40e2524bf12b7f68c74caa6 and --head 22e06375bc6dc34e01b1404d00f427f2b29e5dde deterministically exits 1 at manifestAt(base, packages/shell-ipc/package.json), before validating dependency ranges."
  implication: "The reported CI failure is reproducible and is a deterministic Bohrbug in the guard's base-manifest handling, not a package dependency decrease."

- timestamp: "2026-08-20T15:48:00Z"
  source: "guard and focused-test inspection"
  finding: "changedManifestPaths derives paths from the head diff and main unconditionally calls manifestAt(base, path); existing tests cover only a manifest present in both commits."
  implication: "A head-only package test is the minimal regression and distinguishes absent historical manifests from malformed manifests that must still fail closed."

- timestamp: "2026-08-20T15:49:00Z"
  source: "agent-authored regression test"
  finding: "The focused Vitest run has four existing green tests and one red head-only-package test. The red test exits 1 with the same base-path-missing error seen in CI."
  implication: "The hypothesis is confirmed under a minimal, repeatable Git history; SBFL is skipped because there is one deterministic guard repro but no per-test coverage spectrum."

- timestamp: "2026-08-20T15:50:00Z"
  source: "agent-authored preservation test"
  finding: "The focused suite's new malformed-existing-base test is green under the original guard, while the added-package regression remains the sole failure."
  implication: "The intended change must distinguish base-tree absence from parse failure; swallowing every manifestAt error would weaken the guard and is ruled out."

- timestamp: "2026-08-20T15:51:00Z"
  source: "post-fix focused verification"
  finding: "All six dependency-direction guard tests pass, including head-only package acceptance and malformed existing-base failure. The exact PR base/head command now exits 0."
  implication: "The fix resolves the reported CI failure while preserving the guard's fail-closed parsing behavior for existing manifests."

- timestamp: "2026-08-20T15:53:00Z"
  source: "head-only manifest validation regression"
  finding: "The focused suite now proves that a valid new package passes, while malformed JSON in either a base-present or head-only package fails closed."
  implication: "The guard validates every changed head manifest and skips only the comparison for a path absent from the valid base tree."

- timestamp: "2026-08-20T15:53:00Z"
  source: "fix-acceptance guardrail"
  finding: "Target and adjacent tests passed (11 tests in dependency-direction and CI-release suites); no Stryker configuration exists; the diff adds a base-tree probe and regression cases without deleting behavior; temporarily reverting only the script made the new-package regression fail, and reapplying restored passing tests plus the recorded PR base/head command."
  implication: "All applicable acceptance signals pass, with mutation testing explicitly skipped because this repository has no configured mutation runner."

## Eliminated

- hypothesis: "The shell-ipc manifest contains a dependency decrease."
  evidence: "The guard fails before comparing dependency values; the base path itself is absent because shell-ipc is new in this PR."

## Resolution

- root_cause: "The CI guard derived changed package paths from the head tree and unconditionally parsed their base-tree manifests, so a legitimately new package was treated as an unreadable base manifest."
- fix: "Parse each changed head manifest, inspect the base tree with git ls-tree, and skip comparison only when the exact base path is absent; retain fail-closed parsing for base paths that exist."
- verification:
  target_test:
    result: pass
    suite: "pnpm exec vitest run tests/unit/napplet-dependency-direction-guard.test.ts"
    detail: "7 tests pass, including valid and malformed head-only package cases."
  mutation_check:
    result: skipped
    reason_if_skipped: "No Stryker configuration or dependency is present in the repository."
  no_op_deletion:
    result: pass
    detail: "The scoped diff adds an explicit base-tree existence probe and tests; it removes no guard behavior or assertions."
  adjacent_tests:
    result: pass
    suites_run:
      - "tests/unit/napplet-dependency-direction-guard.test.ts"
      - "tests/unit/ci-release-gate.test.ts"
    detail: "11 tests pass."
  revert_and_reconfirm:
    result: pass
    bug_returned_on_revert: true
    fixed_on_reapply: true
    detail: "Reverting only the script made the head-only-package test fail; reapplying made both focused suites and the exact PR base/head command pass."
  guardrail_verdict: accepted
- files_changed:
  - "scripts/check-napplet-dependency-direction.mjs"
  - "tests/unit/napplet-dependency-direction-guard.test.ts"
