---
phase: 23-ci-cd-baseline-doc-trivia
plan: 03
subsystem: infra
tags: [github-actions, ci, pnpm, playwright, browser-cache, e2e]

# Dependency graph
requires:
  - phase: 22-iteration-loop-closure
    provides: green-bar baseline of v1.3 (47 Playwright specs / 0 skipped passing on main)
  - phase: 23-ci-cd-baseline-doc-trivia
    provides: setup preamble pattern from 23-01 (build.yml) and 23-02 (unit.yml) — pnpm@10, Node 20, frozen-lockfile install, concurrency cancel-in-progress
provides:
  - Playwright E2E CI workflow gating every push and pull_request
  - Cache strategy for `~/.cache/ms-playwright` keyed on OS + installed Playwright version + pnpm-lock.yaml hash, with 2-tier restore-keys ladder
  - Cache-hit / cache-miss branching pattern (install-deps vs install --with-deps)
  - Pattern: resolve installed package version AFTER `pnpm install` (not from lockfile parsing) for cache key composition
affects: [25-release-pipeline, future v1.4 phases (every PR now gated by green E2E suite), any plan that adds Playwright specs]

# Tech tracking
tech-stack:
  added: [actions/cache@v4]
  patterns:
    - "Resolve installed Playwright version via `node -p require('./node_modules/@playwright/test/package.json').version` AFTER `pnpm install` to feed the cache key"
    - "3-component cache key: `${{ runner.os }}-playwright-${{ steps.pw-version.outputs.version }}-${{ hashFiles('pnpm-lock.yaml') }}`"
    - "2-tier restore-keys ladder: first fall back to OS+version (lockfile hash differs), then OS only (Playwright version differs)"
    - "Cache-hit branch installs only system libs via `playwright install-deps chromium`; cache-miss branch installs binaries + system libs via `playwright install --with-deps chromium`"
    - "Single browser pinned (chromium) — matches CLAUDE.md note that this codebase targets Chromium"
    - "Build is invoked transitively by `pnpm test:e2e` (which runs `pnpm test:build` then `npx playwright test`) — no separate build step needed"

key-files:
  created:
    - .github/workflows/e2e.yml
  modified: []

key-decisions:
  - "Cache key resolves Playwright version AFTER `pnpm install` from the actually-installed `node_modules/@playwright/test/package.json` rather than parsing pnpm-lock.yaml — guarantees the key tracks the binary version that will be installed, not a stale lockfile entry"
  - "3-component cache key (OS + Playwright version + pnpm-lock hash) per CONTEXT.md decision — restore-keys fallback ladder allows partial cache reuse when only the lockfile hash changes"
  - "Cache-hit path still runs `playwright install-deps chromium` because cached browser binaries do not include the system libs (libnss3, libgtk-3, etc.) — only the binaries live under `~/.cache/ms-playwright`"
  - "Pin to chromium-only — CLAUDE.md notes this system uses Chromium via pacman; ubuntu-latest matches"
  - "Do NOT add a separate `pnpm build` step — `pnpm test:e2e` already invokes `pnpm test:build` (which is `pnpm build`) before running Playwright"
  - "No report upload step (e.g., `actions/upload-artifact` for HTML report) — out of scope for CI-03 baseline; can be added in a later v1.4 plan if needed"

patterns-established:
  - "Playwright cache key composition: `<os>-playwright-<installed-version>-<lockfile-hash>` with restore-keys ladder dropping the lockfile hash, then the version, in that order"
  - "Conditional steps using `if: steps.<id>.outputs.cache-hit == 'true'` (and its inverse) to branch install behavior between cache-hit and cache-miss paths"
  - "Use `pnpm exec playwright …` (not `npx playwright …`) inside CI steps so the binary resolution honors the pnpm workspace's hoisted node_modules"

requirements-completed: [CI-03]

# Metrics
duration: 1 min
completed: 2026-04-19
---

# Phase 23 Plan 03: CI E2E Workflow Summary

**GitHub Actions Playwright E2E workflow on push and pull_request — pnpm 10 + Node 20, frozen-lockfile install, browser cache keyed on OS + installed Playwright version + pnpm-lock.yaml hash with 2-tier restore-keys ladder, cache-hit/miss branching for system deps vs full install, then `pnpm test:e2e`.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-19T10:29:24Z
- **Completed:** 2026-04-19T10:30:08Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Created `.github/workflows/e2e.yml` (59 lines) — the v1.4 Playwright E2E green-bar floor.
- Workflow triggers on `push` (any branch) and `pull_request` (any base).
- Single job `e2e` (Playwright) on `ubuntu-latest`.
- Pipeline: checkout → pnpm@10 setup → Node 20 (cache: pnpm) → `pnpm install --frozen-lockfile` → resolve installed `@playwright/test` version into a step output → restore `~/.cache/ms-playwright` from a 3-component key with 2-tier restore-keys fallback → cache-miss installs browsers + system deps, cache-hit installs only system deps → `pnpm test:e2e`.
- Concurrency configured: in-flight runs on the same ref are cancelled when a newer commit lands.
- Closes requirement CI-03.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .github/workflows/e2e.yml** — `0989ac9` (feat)

**Plan metadata:** _committed after this summary is written_ (docs: complete CI E2E workflow plan)

## Files Created/Modified

- `.github/workflows/e2e.yml` — GitHub Actions E2E workflow (59 lines). Triggers: `push`, `pull_request`. Single job `e2e` (Playwright) on `ubuntu-latest`. Steps: actions/checkout@v4 → pnpm/action-setup@v3 (version 10) → actions/setup-node@v4 (node 20, cache pnpm) → `pnpm install --frozen-lockfile` → resolve Playwright version from installed package → actions/cache@v4 keyed on `${{ runner.os }}-playwright-${{ steps.pw-version.outputs.version }}-${{ hashFiles('pnpm-lock.yaml') }}` with restore-keys `<os>-playwright-<version>-` and `<os>-playwright-` → conditional install branches (cache-miss: `pnpm exec playwright install --with-deps chromium`; cache-hit: `pnpm exec playwright install-deps chromium`) → `pnpm test:e2e`.

## Decisions Made

- **Resolve installed Playwright version after `pnpm install`, not from lockfile parsing.** A separate `Resolve Playwright version` step runs `node -p "require('./node_modules/@playwright/test/package.json').version"` and writes it to `$GITHUB_OUTPUT`. The cache key then references `${{ steps.pw-version.outputs.version }}`. This guarantees the key tracks the binary version that will actually be installed, not whatever a stale or partially-resolved lockfile entry suggests.
- **3-component cache key (OS + Playwright version + pnpm-lock hash)** per CONTEXT.md decision. The restore-keys fallback ladder is intentional: the first fallback drops the lockfile hash (allows partial reuse when only the lockfile changed but the Playwright version is identical — same browser binaries can be reused, but the cache won't be exact); the second fallback drops the version (a last-ditch fallback that may not produce a usable hit but at least prevents a hard miss).
- **Cache-hit branch still installs system deps.** Cached browser binaries under `~/.cache/ms-playwright` do not include system libraries (libnss3, libgtk-3, libxkbcommon, etc.). On cache hit, `pnpm exec playwright install-deps chromium` installs only those system libs. On cache miss, `pnpm exec playwright install --with-deps chromium` installs both binaries and system libs in one step.
- **Pin to chromium-only.** CLAUDE.md notes this codebase targets Chromium (pacman-installed locally; same on `ubuntu-latest`). Skipping firefox + webkit halves install + cache size.
- **No separate `pnpm build` step.** `pnpm test:e2e` is defined in root `package.json` as `pnpm test:build && npx playwright test`, where `test:build` is `pnpm build` (full turbo build). Adding a redundant `pnpm build` step would only waste CI minutes. The Playwright config spawns `pnpm preview` web servers (`:4173` harness, `:4174` demo) against the built artifacts.
- **No HTML report upload.** `actions/upload-artifact` for the Playwright HTML report is out of scope for CI-03; can be added later if PR debugging needs it.
- **Use `pnpm exec playwright`, not `npx playwright`.** `pnpm exec` resolves binaries through pnpm's workspace-aware node_modules hoisting, which is more reliable than `npx`'s lookup behavior in monorepos.

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<action>` block specified the exact YAML verbatim and was written byte-for-byte (59 lines including the trailing newline). All 18 acceptance_criteria predicates passed on first verification with no fixups. YAML parsed cleanly with `python3 -c "import yaml; yaml.safe_load(...)"`. The plan's `<verify><automated>` block — an 11-clause `&&`-chained shell expression — succeeded (`AUTOMATED VERIFY: PASS`).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

The workflow will execute automatically once committed to a branch on GitHub. No secrets, env vars, or external accounts are referenced. Branch protection (which would make the E2E job a *required* check before merge) is a separate one-click GitHub UI action by the repo admin and is intentionally out of phase scope per CONTEXT.md. Phase-level success criterion (a green run on the closing PR merge commit) is verified at the phase iteration log level.

## Next Phase Readiness

- **CI-03 closed.** `.github/workflows/e2e.yml` joins `build.yml` (CI-01, plan 23-01) and `unit.yml` (CI-02, plan 23-02) — the v1.4 green-bar floor is now complete.
- **Ready for 23-04 (DOCS-04, JSDoc trivia refresh):** Final plan in Phase 23. Two single-line edits in `tests/e2e/harness/harness.ts` and `tests/e2e/helpers/wait-for-napplet-ready.ts` to replace `auth-napplet` references with extant `nub-identity`.
- **Phase-level success-criterion 5** (green run on the merge commit closing Phase 23) will be verified at phase wrap-up after all four plans land and the closing PR merges — captured in the phase iteration log, not this plan.
- **No blockers.** Sibling workflows already proved the setup preamble works on this codebase; this plan added the Playwright-specific cache + install branching on top of that proven foundation.

## Self-Check: PASSED

- `[ -f .github/workflows/e2e.yml ]` → FOUND (59 lines)
- `git log --oneline --all | grep 0989ac9` → FOUND `0989ac9 feat(23-03): add CI Playwright E2E workflow with browser cache (CI-03)`
- All 18 plan acceptance_criteria predicates verified individually:
  - Header line 1 = `# Phase 23 (v1.4): CI-03 requirement` ✓
  - `name: E2E` (1 occurrence) ✓
  - `ubuntu-latest` (1 occurrence) ✓
  - `pnpm install --frozen-lockfile` (1 occurrence) ✓
  - `run: pnpm test:e2e` line (1 occurrence) ✓
  - `cancel-in-progress: true` (1 occurrence) ✓
  - `actions/cache@v4` (1 occurrence) ✓
  - `~/.cache/ms-playwright` (1 occurrence) ✓
  - `hashFiles('pnpm-lock.yaml')` present ✓
  - `steps.pw-version.outputs.version` present ✓
  - `pnpm exec playwright install --with-deps chromium` present ✓
  - `pnpm exec playwright install-deps chromium` present ✓
  - `restore-keys:` present ✓
  - `pull_request:` line ✓
  - `push:` line ✓
  - `version: 10` ✓
  - `node-version: '20'` ✓
  - YAML parses cleanly via `yaml.safe_load` ✓
  - No forbidden top-level `pnpm build` step ✓
- Plan `<verify><automated>` 11-clause `&&` chain → `AUTOMATED VERIFY: PASS`

---
*Phase: 23-ci-cd-baseline-doc-trivia*
*Completed: 2026-04-19*
