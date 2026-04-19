---
phase: 23-ci-cd-baseline-doc-trivia
plan: 02
subsystem: infra
tags: [github-actions, ci, pnpm, turbo, vitest, unit-tests]

# Dependency graph
requires:
  - phase: 22-iteration-loop-closure
    provides: green-bar baseline of v1.3 (existing Vitest suites pass cleanly on main)
  - phase: 23-ci-cd-baseline-doc-trivia
    provides: 23-01 created `.github/workflows/` directory and established the shared CI setup preamble pattern
provides:
  - Vitest unit-test CI workflow gating every push and pull_request
  - Concurrency cancellation for stale in-flight runs on the same ref
  - Reuses the pnpm 10 + Node 20 + frozen-lockfile install preamble proven in 23-01
affects: [23-03-e2e-tests-ci, 25-release-pipeline, future v1.4 phases (every PR now also gated by green Vitest)]

# Tech tracking
tech-stack:
  added: []  # actions and pnpm/node already added in 23-01; this plan reuses them verbatim
  patterns:
    - "Workflow header comment: `# Phase XX (vN.N): CI-NN requirement` for traceability (now consistent across build.yml + unit.yml)"
    - "Setup preamble reused verbatim from 23-01: checkout -> pnpm setup -> node setup (cache: pnpm) -> install --frozen-lockfile"
    - "Concurrency group: ${{ github.workflow }}-${{ github.ref }} with cancel-in-progress"
    - "Workflow invokes `pnpm test` -> `turbo run test` -> Vitest in each `@kehto/*` package; turbo's task graph handles any required upstream `build` deps transparently"

key-files:
  created:
    - .github/workflows/unit.yml
  modified: []

key-decisions:
  - "Workflow invokes `pnpm test` (not `pnpm test:unit`) — the root `test` script is `turbo run test` which delegates to per-package Vitest configs, matching the v1.3 baseline test entry point. `test:unit` (`vitest run` at root) is a developer escape hatch that does not exercise per-package configs."
  - "No explicit `pnpm build` step before `pnpm test` — Vitest runs against TypeScript sources via each package's vite config; if turbo's `test` task graph declares a `build` dependency, turbo handles it transparently. Adding a redundant build step would double-build and lengthen CI."
  - "pnpm version pinned to 10 (mirrors 23-01) to match root packageManager `pnpm@10.8.0`."
  - "No coverage upload step — out of scope for Phase 23 per CONTEXT.md."

patterns-established:
  - "Sibling CI workflow pattern proven: 23-01 build.yml and 23-02 unit.yml share the same trigger / concurrency / setup preamble, differing only in the trailing `run:` step(s). 23-03 e2e.yml will follow the same template plus a Playwright browser cache step."

requirements-completed: [CI-02]

# Metrics
duration: 44 sec
completed: 2026-04-19
---

# Phase 23 Plan 02: CI Unit-Test Workflow Summary

**GitHub Actions Unit Tests workflow on push and pull_request — pnpm 10 + Node 20, frozen-lockfile install, `pnpm test` invoking turbo's Vitest task graph across all `@kehto/*` packages, concurrency cancel-in-progress, ubuntu-latest runner.**

## Performance

- **Duration:** 44 sec
- **Started:** 2026-04-19T10:25:46Z
- **Completed:** 2026-04-19T10:26:30Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Created `.github/workflows/unit.yml` — the v1.4 unit-test green-bar floor workflow.
- Workflow triggers on `push` (any branch) and `pull_request` (any base).
- Test pipeline: checkout -> pnpm@10 setup -> Node 20 (cache: pnpm) -> `pnpm install --frozen-lockfile` -> `pnpm test`.
- `pnpm test` resolves to `turbo run test` which executes Vitest in every `@kehto/*` package (acl, runtime, shell, services) via each package's task definition.
- Concurrency configured: in-flight runs on the same ref are cancelled when a newer commit lands.
- Closes requirement CI-02.
- Boundary respected: workflow does NOT invoke `pnpm test:e2e` — Playwright is Plan 23-03 (CI-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .github/workflows/unit.yml** — `bf708dc` (feat)

**Plan metadata:** _committed after this summary is written_ (docs: complete CI unit-test workflow plan)

## Files Created/Modified

- `.github/workflows/unit.yml` — GitHub Actions Unit Tests workflow. 35 lines. Triggers: push, pull_request. Single job `unit` (Vitest) on `ubuntu-latest`. Steps: actions/checkout@v4, pnpm/action-setup@v3 (version 10), actions/setup-node@v4 (node 20, cache pnpm), install --frozen-lockfile, run pnpm test.

## Decisions Made

- **Invoke `pnpm test` (not `pnpm test:unit`):** Root `test` script is `turbo run test`, which delegates to each package's Vitest config and matches the v1.3 baseline test entry point. `test:unit` is a developer-local shortcut (`vitest run` from repo root) that bypasses turbo and does not exercise per-package configurations. Plan locked this choice; verified in package.json.
- **No explicit `pnpm build` step:** Vitest runs against TypeScript sources via each package's vite config — building tsup outputs first is unnecessary and would double work. If any per-package `test` task declares a `build` dependency in its turbo.json, turbo's task graph will pick it up automatically.
- **pnpm version pinned to 10:** Matches root `packageManager: "pnpm@10.8.0"`. Mismatch with the lockfile schema would fail `--frozen-lockfile`.
- **No coverage / no upload-artifact:** Out of scope for Phase 23 (CI baseline only). Future phase can layer `@vitest/coverage-v8` (already a devDependency) onto this workflow.
- **Reuse 23-01's setup preamble verbatim:** Keeps the two CI workflows visually parallel, easing future maintenance and a possible later DRY refactor into a reusable workflow (deferred per CONTEXT.md).

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<action>` block specified the exact YAML verbatim and was written byte-for-byte. All 13 acceptance_criteria predicates passed on first verification (no fixups needed). YAML parsed cleanly with `python3 -c "import yaml; yaml.safe_load(...)"`. The plan's `<verify>` `<automated>` block returned PASS.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

The workflow will execute automatically once committed to a branch on GitHub. No secrets, env vars, or external accounts are referenced. Branch protection (which would make the unit-test job a *required* check before merge) is a separate one-click GitHub UI action by the repo admin and is intentionally out of phase scope per CONTEXT.md.

## Next Phase Readiness

- **CI-02 closed.** `.github/workflows/unit.yml` lands alongside `build.yml` (23-01) under `.github/workflows/`.
- **Ready for 23-03 (CI-03, e2e.yml):** Same preamble pattern (checkout -> pnpm@10 -> node 20 -> frozen-lockfile install) plus a Playwright browser cache step keyed on pnpm-lock.yaml hash.
- **Ready for 23-04 (DOCS-04 JSDoc refresh).**
- **Phase-level success-criterion 5** (green run on the merge commit closing Phase 23) will be verified at the phase level after all three workflows land and the closing PR merges — captured in the phase iteration log, not this plan.

## Self-Check: PASSED

- `[ -f .github/workflows/unit.yml ]` -> FOUND
- `git log --oneline --all | grep bf708dc` -> FOUND `bf708dc feat(23-02): add CI unit-test workflow (CI-02)`
- All 13 plan acceptance_criteria predicates verified (file header, name: Unit Tests, ubuntu-latest, frozen-lockfile, exact `run: pnpm test`, cancel-in-progress, push:, pull_request:, version: 10, node-version: '20', cache: 'pnpm', no `test:e2e` reference) and YAML parses with `yaml.safe_load`.
- Plan `<verify>` `<automated>` block: PASS.

---
*Phase: 23-ci-cd-baseline-doc-trivia*
*Completed: 2026-04-19*
