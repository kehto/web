# Phase 23: CI/CD Baseline & Doc Trivia - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Mode:** Infrastructure-only (smart-discuss skipped per workflow heuristic)

<domain>
## Phase Boundary

Every push and PR is gated by GitHub Actions running build, type-check, unit tests, and the full Playwright suite — so subsequent v1.4 phases land on a green-bar floor. Cosmetic JSDoc `@example` blocks in `tests/e2e/harness/harness.ts:10` + `tests/e2e/helpers/wait-for-napplet-ready.ts:21` updated to cite extant `nub-*` fixtures (stop referencing deleted `auth-napplet`).

In scope:
- `.github/workflows/build.yml` (CI-01)
- `.github/workflows/unit.yml` (CI-02)
- `.github/workflows/e2e.yml` (CI-03)
- JSDoc refresh in 2 test-helper files (DOCS-04)

Out of scope:
- `.github/workflows/release.yml` — Phase 25 (depends on REL-05 publication working)
- Branch protection rules — set up via GH UI by repo admin; this phase verifies workflow files exist and runs are visible, not that branch protection is enforced
- Multi-OS matrix — `ubuntu-latest` only per REQUIREMENTS.md "Out of Scope"

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (standard CI conventions)

All implementation choices follow standard GitHub Actions + pnpm + Node.js conventions:

- **Runner OS:** `ubuntu-latest` (only OS in v1.4 scope per REQUIREMENTS).
- **Node version:** Match `.nvmrc` if it exists; otherwise pin to `20.x` (LTS at v1.4 development time, January 2026).
- **pnpm version:** Match `packageManager` field in root `package.json`; otherwise pin to `9.x`.
- **pnpm store cache:** Use `actions/setup-node` with `cache: 'pnpm'` (built-in pnpm store caching).
- **Playwright browser cache:** Use `actions/cache` with key derived from `pnpm-lock.yaml` hash + Playwright version (e.g., `${{ runner.os }}-playwright-${{ hashFiles('pnpm-lock.yaml') }}`); restore-keys fallback to OS-only key.
- **Concurrency:** `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` on each workflow — cancels in-flight runs when a new commit lands on the same ref.
- **Triggers:** `on: [push, pull_request]` for all 3 workflows. No `paths-ignore` filter — all workflows run on every change to keep the green-bar simple (cost is acceptable; v1.3 baseline runs in ~15-30s for build + ~20s for E2E).
- **Workflow file headers:** Include a one-line `# Phase 23 (v1.4): CI-XX requirement` comment at the top of each .yml for traceability.
- **JSDoc refresh (DOCS-04):** Replace `auth-napplet` fixture references with `nub-identity` (closest semantic match — both are AUTH-flow fixtures, and `nub-identity` is currently shipped). One-line edits per file.

### Branch Protection (out of phase scope, surfaced for user awareness)

REQUIREMENTS.md says "a failing run blocks merge" — strictly speaking that requires GitHub branch protection rules pointing at the workflow check names. Phase 23 ships the workflows (which surface as required-check candidates); the actual branch-protection toggle is a one-click GH UI action by the repo admin. Plan 23 will note this in the phase iteration log and link the GH settings URL.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `package.json` root scripts: `pnpm build`, `pnpm type-check`, `pnpm test`, `pnpm test:e2e` — all already exist and work. Workflows just invoke them.
- `pnpm-lock.yaml` exists at repo root.
- `tests/e2e/harness/harness.ts` and `tests/e2e/helpers/wait-for-napplet-ready.ts` exist (single-file edits each for DOCS-04).

### Established Patterns

- Monorepo uses `pnpm` (declared in `packageManager` field of root `package.json`).
- Turbo orchestrates per-package builds; `pnpm build` calls `turbo build`.
- Playwright runs against built artifacts via `pnpm preview` web servers (per CLAUDE.md).
- `pnpm test:e2e` writes browser cache to `~/.cache/ms-playwright` (Playwright default).

### Integration Points

- New: `.github/` directory created at repo root.
- New: `.github/workflows/build.yml`, `unit.yml`, `e2e.yml`.
- Modified: `tests/e2e/harness/harness.ts` (1 line in JSDoc).
- Modified: `tests/e2e/helpers/wait-for-napplet-ready.ts` (1 line in JSDoc).
- Verified post-Phase 23: a green run on a merge commit (URL captured in iteration log).

</code_context>

<specifics>
## Specific Ideas

- **CI workflow naming convention:** `<concern>.yml` (`build.yml`, `unit.yml`, `e2e.yml`) — matches REQUIREMENTS.md.
- **Workflow check display name:** Match the file name in `name:` field at the top of each .yml (`name: Build`, `name: Unit Tests`, `name: E2E`).
- **Setup steps shared pattern:** `actions/checkout@v4` → `pnpm/action-setup@v3` → `actions/setup-node@v4 (cache: pnpm)` → `pnpm install --frozen-lockfile`. Each workflow shares this preamble.

</specifics>

<deferred>
## Deferred Ideas

- **Branch protection rule automation** — beyond v1.4 scope; a follow-up GH UI step for repo admin.
- **Workflow status badges** in README — DOCS-06 (Phase 28) covers READMEs; could include here but kept separate to respect REQ-ID boundaries.
- **Reusable workflow extraction** — once 3 workflows share the setup preamble, `.github/workflows/_setup.yml` reusable workflow could DRY it. Defer until pattern is proven over multiple v1.4 commits.

</deferred>
