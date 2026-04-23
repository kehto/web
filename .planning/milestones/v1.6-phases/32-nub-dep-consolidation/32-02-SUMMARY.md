---
phase: 32-nub-dep-consolidation
plan: 02
subsystem: infra
tags: [changesets, pnpm, iteration-loop, playwright, dep-consolidation, nub, subpath-imports, v1.6]

# Dependency graph
requires:
  - phase: 31-e2e-coverage-milestone-iteration-loop
    provides: 53/0/0 Playwright baseline entering v1.6 (v1.5 close)
  - plan: 32-01
    provides: atomic peer-dep + import migration (DEP-01..03) + pnpm.overrides for upstream @napplet/nub publish bug
provides:
  - 4 @kehto/* changesets (v1-6-dep-{acl,runtime,shell,services}.md) with minor bump + pnpm.overrides advisory for downstream consumers
  - 32-ITERATION-LOG.md evidence log (53/0/0 fresh-install smoke, grep proofs, lockfile delta, dual-instance scan)
  - Rule 1 auto-fix: media-controller subpath variant corrected (/media → /media/sdk) to avoid registerNub side-effect collision with @napplet/shim
affects: [phase-33-cache-service, phase-34-reserved-chord, phase-35-nip66, phase-36-wm-skeleton, phase-37-milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subpath-variant selection rule: use /<domain>/sdk for non-type imports when @napplet/shim is present (avoids double registerNub); use /<domain>/types for type-only; root /<domain> only when shim is NOT loaded (standalone SDK consumer)"
    - "v9 pnpm-lock quoted-key grep form: `grep -c \"'@napplet/nub@0.2.1':\" pnpm-lock.yaml` (NOT the v6 `/@napplet/nub@0.2.1` leading-slash form)"
    - "Importer-block scoped awk for lockfile anti-term checks: `awk '/^importers:/,/^packages:/' pnpm-lock.yaml | grep -c '@napplet/nub-'` excludes upstream transitive residue"
    - "Changeset prose pattern: cite REQ-IDs + upstream issue + include pnpm.overrides workaround inline for downstream consumers (not just a TODO)"

key-files:
  created:
    - .changeset/v1-6-dep-acl.md
    - .changeset/v1-6-dep-runtime.md
    - .changeset/v1-6-dep-shell.md
    - .changeset/v1-6-dep-services.md
    - .planning/phases/32-nub-dep-consolidation/32-ITERATION-LOG.md
  modified:
    - apps/demo/napplets/media-controller/src/main.ts

key-decisions:
  - "Changeset bump = minor (DEP-04 mandates — public peer-dep surface changed). Not patch."
  - "One file per package (not a combined 4-mapping file) — matches v1.2 precedent and keeps per-package CHANGELOG entries clean."
  - "Changeset prose includes the pnpm.overrides advisory inline so downstream consumers hitting the upstream @napplet/nub@0.2.1 workspace:* publish bug have a documented workaround without having to discover it themselves."
  - "Turbo cache purged before the evidenced build (`rm -rf .turbo packages/*/.turbo apps/demo/.turbo ...`) — forces every task to execute cold so cached replays don't hide a real regression. Resulted in `Cached: 0 cached, 22 total`."
  - "media-controller subpath variant selection was wrong in Plan 32-01 (root /media has registerNub side effect — collides with @napplet/shim). Rule 1 auto-fix to /media/sdk (no side effects, same helper re-exports)."

patterns-established:
  - "Fresh-install iteration loop form for phases without a root clean script: explicit `rm -rf node_modules packages/*/dist packages/*/node_modules apps/demo/dist apps/demo/node_modules apps/demo/napplets/*/dist apps/demo/napplets/*/node_modules tests/harness/dist tests/harness/node_modules` preamble"
  - "E2E iteration loop catches runtime migration errors that pnpm build + type-check + unit tests don't (module-init side effects only fire inside a real iframe boot)"

requirements-completed: [DEP-04, DEP-05]

# Metrics
duration: ~25min
completed: 2026-04-23
files_modified: 6
tests_passed: "53/53 Playwright specs (18.3s); 22/22 turbo build uncached; 0 dual-instance warnings"
---

# Phase 32 Plan 02: Changesets + Iteration Loop Smoke Summary

**4 @kehto/* changesets authored with minor bump + pnpm.overrides downstream advisory; canonical fresh-install iteration loop green at 53/0/0 against the consolidated @napplet/nub subpath surface; one Rule 1 auto-fix (media-controller /media → /media/sdk) surfaced and closed by the E2E pass**

## Performance

- **Duration:** ~25 min (end-to-end, across 2 task commits + this summary)
- **Started:** 2026-04-23T~09:40Z (Task 1 author changesets)
- **Completed:** 2026-04-23T~10:05Z (Task 2 iteration loop + fix commit)
- **Tasks:** 2 of 2
- **Files modified:** 6 (4 changesets created + 1 iteration log + 1 napplet source fix)

## Accomplishments

### Task 1: 4 @kehto/* Changesets

- `.changeset/v1-6-dep-acl.md` — frontmatter `'@kehto/acl': minor`
- `.changeset/v1-6-dep-runtime.md` — frontmatter `'@kehto/runtime': minor`
- `.changeset/v1-6-dep-shell.md` — frontmatter `'@kehto/shell': minor`
- `.changeset/v1-6-dep-services.md` — frontmatter `'@kehto/services': minor`
- All 4 bodies cite DEP-01..05 REQ-IDs + kehto#4 (hyprgate v2.0 gap analysis) + explain the dual-instance elimination
- All 4 bodies include the pnpm.overrides workaround (`@napplet/nub>@napplet/core: ^0.2.1`) inline as a downstream consumer advisory, so shells pulling the new @kehto/*@0.3.0 releases don't rediscover the upstream @napplet/nub@0.2.1 workspace:* publish bug
- Follows v1.2 precedent (`.changeset/v1-2-{acl,runtime,shell,services}.md` — one file per package)
- Does NOT include `@kehto/demo-media-controller` (private workspace — `"private": true` — not publishable)

### Task 2: Canonical Fresh-Install Iteration Loop + Evidence Log

- Executed the full `rm -rf` preamble (node_modules, dists, turbo caches at every workspace scope) + `pnpm install` + `pnpm build` + `pnpm test:e2e` against the built `:4174` demo
- **Result: 53 passed / 0 failed / 0 skipped (18.3s)** — exact match to v1.5 close baseline; DEP-05 acceptance met
- Build: 22/22 turbo tasks executed uncached (`Cached: 0 cached, 22 total`, 5.606s) — forced cold to ensure no cache replay hid a regression
- No dual-instance warnings in either `/tmp/kehto-32-build.log` or `/tmp/kehto-32-e2e.log` (grep `multiple versions|duplicate|loaded twice|dual instance` returned empty)
- `.planning/phases/32-nub-dep-consolidation/32-ITERATION-LOG.md` (244 lines) captures:
  - Full build and E2E output tails
  - Grep proofs table (5 commands) with expected vs actual
  - Lockfile delta (v1.5 → 32-02: −69 lines total, −33 importer-block split-dep entries, +2 consolidated v9 keys)
  - Dual-instance warning scan (empty)
  - v1.6 anti-term sweep for the new `@napplet/nub-` entry (0 matches in source, 5 intentional CHANGELOG residue per 32-01 Deviation 3)
  - Deviation record for the Rule 1 auto-fix

## Task Commits

Each task committed atomically:

1. **Task 1: Author 4 changesets** — `5adeb52` (feat)
   - `.changeset/v1-6-dep-{acl,runtime,services,shell}.md` (4 files, +84 lines)

2. **Task 2: Iteration loop + evidence log + Rule 1 auto-fix** — `a4d0652` (feat)
   - `.planning/phases/32-nub-dep-consolidation/32-ITERATION-LOG.md` (+244 lines)
   - `apps/demo/napplets/media-controller/src/main.ts` (−3/+13: import subpath corrected /media → /media/sdk; JSDoc explains subpath-variant rule)

**Plan metadata commit:** (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md — follows)

## Files Created/Modified

### Created
- `.changeset/v1-6-dep-acl.md` — minor bump changeset for `@kehto/acl` (NUB consolidation)
- `.changeset/v1-6-dep-runtime.md` — minor bump changeset for `@kehto/runtime` (NUB consolidation)
- `.changeset/v1-6-dep-shell.md` — minor bump changeset for `@kehto/shell` (NUB consolidation)
- `.changeset/v1-6-dep-services.md` — minor bump changeset for `@kehto/services` (NUB consolidation)
- `.planning/phases/32-nub-dep-consolidation/32-ITERATION-LOG.md` — DEP-05 evidence log (iteration loop + grep proofs + lockfile delta + dual-instance scan + Rule 1 deviation record)

### Modified
- `apps/demo/napplets/media-controller/src/main.ts` — import changed from `@napplet/nub/media` (had registerNub side effect) to `@napplet/nub/media/sdk` (pure re-exports, no side effects); added JSDoc explaining subpath-variant rule for future migrations

## Decisions Made

- **Changeset bump = minor** (DEP-04 mandate). Public peer-dep surface changed; not a patch-level fix.
- **One changeset file per package** (4 files, not 1 combined). Matches v1.2 precedent; per-package files produce cleaner CHANGELOG entries on `pnpm changeset version`.
- **Inline pnpm.overrides advisory in changeset body.** Downstream consumers pulling @kehto/*@0.3.0 will hit the same upstream @napplet/nub@0.2.1 workspace:* publish bug Plan 32-01 hit. Documenting the workaround inline means they don't have to discover it the hard way.
- **Forced-uncached build** (turbo cache purged before the evidenced build). Guards against the failure mode where turbo replays a cached task and hides a new regression.
- **Scope: no `pnpm changeset version` or `pnpm changeset publish` run in this plan.** Version + publish belong to the milestone-close phase (Phase 37). This plan authors the changesets only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] media-controller napplet stalled at `connecting...` on first E2E run**

- **Found during:** Task 2, first `pnpm test:e2e` pass of the iteration loop
- **Issue:** Plan 32-01's import rewrite table entry #15 selected the wrong subpath variant for the migration's only non-type import. `apps/demo/napplets/media-controller/src/main.ts:29` was rewritten to `from '@napplet/nub/media'` (root subpath). That module has a `registerNub(DOMAIN, ...)` call at module-init time. `@napplet/shim` also registers the `"media"` domain during its own boot. The second `registerNub` call throws `NUB domain "media" is already registered` per @napplet/core's throw-on-dupe guard, which crashes the napplet's `init()` promise chain. 3 E2E specs failed: `demo-concurrent-boot.spec.ts` (9/10 authenticated instead of 10), `media-controller.spec.ts` (session-ready never fires), `shell-ui-state-surfaces.spec.ts:110` (ACL matrix shows 9 rows instead of 10).
- **Why 32-01 didn't catch it:** Plan 32-01's evidence was `pnpm build` + `pnpm type-check` + `pnpm test:unit` (480/480 green). The side-effect collision only manifests when the napplet actually boots inside an iframe with `@napplet/shim` loaded — a runtime behavior unit tests don't exercise. This is precisely why 32-02 owns the E2E iteration-loop evidence.
- **Fix:** Changed the import to the `/sdk` subpath:
  ```ts
  import { mediaCreateSession, mediaReportState, mediaOnCommand } from '@napplet/nub/media/sdk';
  ```
  `/media/sdk` re-exports the same helpers without the `registerNub` side effect — it's the subpath designed for SDK consumers that rely on `@napplet/shim` for domain registration. Verified by inspecting `node_modules/.pnpm/@napplet+nub@0.2.1/node_modules/@napplet/nub/dist/media/sdk.js`.
- **Files modified:** `apps/demo/napplets/media-controller/src/main.ts` (lines 6, 19, 21-26 JSDoc; line 29 import)
- **Verification:** Rebuilt napplet bundle's `g(X, e=>{})` registration-callsite count went from 8 (7 shim + 1 duplicate media) to 7 (shim-only). Re-ran `pnpm test:e2e` → 53/0/0 (18.3s).
- **Committed in:** `a4d0652` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Rule 1 auto-fix was essential for DEP-05 acceptance. Surfaces a new subpath-variant selection rule (use `/sdk` for non-type imports when `@napplet/shim` is loaded; root subpath only for standalone SDK consumers). Captured in `patterns-established` frontmatter so future migrations don't hit the same trap. No scope creep.

## Authentication Gates

None. Pure local file-edit + `pnpm install` + build + Playwright run. No network auth required beyond anonymous npm registry read for `@napplet/nub@0.2.1`.

## Issues Encountered

- Upstream @napplet/nub@0.2.1 publish bug (workspace:* unresolved specifier) was already handled in Plan 32-01 via `pnpm.overrides` at workspace root. `pnpm install` during this plan's fresh-install clean completed clean with no `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` — the override persisted correctly through the `rm -rf node_modules` cycle.
- First E2E pass of the iteration loop failed 3 specs due to the subpath-variant bug documented above. Rule 1 auto-fix + rerun closed the issue.

## Deferred Issues

- **Transitive `@napplet/nub-*` residue in `pnpm-lock.yaml`'s `packages:` section** (35 lines from @napplet/sdk + @napplet/shim runtime deps): out of kehto scope per Plan 32-01; tracked against @napplet upstream.
- **Upstream @napplet/nub re-publish** to fix the `workspace:*` specifier: tracked against @napplet repo. When upstream ships a corrected publish, the `pnpm.overrides` entry in root `package.json` can be removed (and the inline advisory paragraph dropped from the 4 changesets).
- **CHANGELOG.md residue** (5 `@napplet/nub-*` substring matches across 4 historical CHANGELOGs): intentionally preserved per Plan 32-01 Deviation 3 — rewriting historical release notes would falsify package history.

## Known Stubs

None. Pure infrastructure plan — no new UI, no new service handlers, no placeholders.

## Self-Check

Verified programmatically after writing this SUMMARY:

- ✓ `ls .changeset/v1-6-dep-*.md | wc -l` returns **4**
- ✓ All 4 changeset files declare `minor` bump (grep `"': minor"` matches 4 files)
- ✓ All 4 changeset files cite DEP-01..05 REQ-IDs (grep `-lE 'DEP-0[1-5]'` returns 4)
- ✓ All 4 changeset files reference kehto#4 (grep `-l 'kehto#4'` returns 4)
- ✓ No changeset declares `patch` bump (grep `-lE "': patch"` returns 0)
- ✓ No changeset references `@kehto/demo-media-controller` (grep returns 0)
- ✓ `grep -c "'@napplet/nub@0.2.1':" pnpm-lock.yaml` returns **2** (≥ 1 required)
- ✓ `awk '/^importers:/,/^packages:/' pnpm-lock.yaml | grep -c '@napplet/nub-'` returns **0**
- ✓ `grep -rn '@napplet/nub-' packages/ apps/ tests/ | grep -v /dist/ | grep -v /node_modules/ | grep -v '\.d\.ts' | grep -v CHANGELOG.md | wc -l` returns **0** (CHANGELOG-excluded anti-term sweep clean)
- ✓ `grep -c '53 passed' .planning/phases/32-nub-dep-consolidation/32-ITERATION-LOG.md` returns **6** (≥ 1 required)
- ✓ `pnpm ls @napplet/nub -r --depth 0` shows single resolved version `0.2.1` across all 5 kehto importers
- ✓ Task 1 commit `5adeb52` exists in git log
- ✓ Task 2 commit `a4d0652` exists in git log
- ✓ `.changeset/v1-6-dep-acl.md` exists
- ✓ `.changeset/v1-6-dep-runtime.md` exists
- ✓ `.changeset/v1-6-dep-shell.md` exists
- ✓ `.changeset/v1-6-dep-services.md` exists
- ✓ `.planning/phases/32-nub-dep-consolidation/32-ITERATION-LOG.md` exists

## Next Phase Readiness

**Phase 32 closes on:**

- DEP-01 (manifest consolidation) ✓ (32-01)
- DEP-02 (import rewrite to subpaths) ✓ (32-01 + this plan's Rule 1 fix)
- DEP-03 (lockfile importer-block cleanup + single resolved version) ✓ (32-01, verified fresh-install here)
- DEP-04 (4 @kehto/* changesets, minor bump) ✓ (this plan, Task 1)
- DEP-05 (fresh-install smoke at 53/0/0 with no dual-instance warnings) ✓ (this plan, Task 2)

**Ready for Phase 33 (Cache Service + HostCacheBridge, CACHE-01..05).** Phases 33–36 can now plan concurrently on the consolidated `@napplet/nub` subpath surface. The 53-spec baseline holds; the new subpath-variant selection rule is captured for future migrations.

## Self-Check: PASSED

---
*Phase: 32-nub-dep-consolidation*
*Completed: 2026-04-23*
