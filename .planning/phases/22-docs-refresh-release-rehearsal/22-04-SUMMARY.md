---
phase: 22-docs-refresh-release-rehearsal
plan: 4
subsystem: release-rehearsal
tags: [publint, arethetypeswrong, attw, esm-only, package-json, dlx, publish-readiness]

# Dependency graph
requires:
  - phase: 22-docs-refresh-release-rehearsal
    provides: "Existing canonical ESM-only package.json shape on all 4 @kehto/* packages (type:module, exports map with types before import, files:[dist], sideEffects:false, publishConfig.access:public)"
provides:
  - "REL-01 gap closed — `pnpm dlx publint packages/<pkg>` clean (exit 0, 'All good!') on acl / runtime / shell / services"
  - "REL-02 gap closed — `pnpm dlx @arethetypeswrong/cli --profile esm-only --pack packages/<pkg>` clean (exit 0) on all 4 packages; node16 (from ESM), bundler, node10 all 🟢"
  - "22-ITERATION-LOG.md scaffold — new file at phase root with REL-01 + REL-02 sections, verbatim tool output per package, combined for-loop exit verification, findings notes, and CLOSED status markers. Ready for REL-03/REL-04/E2E-10 plans to append sections."
  - "Publish-readiness evidence — @kehto/* packages verified ESM-only-correct by two independent tools; no package.json changes required"
affects: [22-05-changeset-version-dry-run, 22-06-v1-3-changesets, 22-08-phase-close]

# Tech tracking
tech-stack:
  added: ["publint (via pnpm dlx, not installed)", "@arethetypeswrong/cli (via pnpm dlx, not installed)"]
  patterns: ["pnpm dlx for manual rehearsal tools (no permanent install, no turbo task) per D-04", "ESM-only publish profile verified via attw --profile esm-only --pack flag combination"]

key-files:
  created:
    - ".planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md"
    - ".planning/phases/22-docs-refresh-release-rehearsal/22-04-SUMMARY.md"
  modified: []

key-decisions:
  - "REL-01 + REL-02 both closed on first pass with zero package.json fixes — canonical ESM-only shape established in prior phases is publint-clean and attw-clean without remediation."
  - "attw --pack flag kept (Claude's-discretion per W1) — mirrors real-publish semantics by running npm pack and inspecting the packed tarball instead of the raw source directory."
  - "node16-from-CJS (ignored) ⚠️ ESM dynamic-import-only is expected/correct for ESM-only packages; --profile esm-only explicitly suppresses that resolution as out-of-contract."

patterns-established:
  - "Iteration log scaffold: header + REL-section template with per-package verbatim stdout, exit code, combined for-loop verification, Findings subsection, and CLOSED status marker. Reusable for REL-03 (changeset dry-run) and REL-04 (changeset stage)."
  - "Idempotency check protocol: `grep -q '^## REL-0X — tool'` before appending each section — enables safe re-execution of the plan."

requirements-completed: [REL-01, REL-02]

# Metrics
duration: 3min
completed: 2026-04-18
---

# Phase 22 Plan 04: publint + attw Release Rehearsal Summary

**Ran `pnpm dlx publint` and `pnpm dlx @arethetypeswrong/cli --profile esm-only --pack` against all 4 @kehto/* packages; both tools reported clean on first pass — zero package.json fixes required, REL-01 and REL-02 closed.**

## Performance

- **Duration:** 3 min (178 s)
- **Started:** 2026-04-18T12:21:58Z
- **Completed:** 2026-04-18T12:24:56Z
- **Tasks:** 2
- **Files modified:** 1 created (22-ITERATION-LOG.md); 0 package.json changes

## Accomplishments

- REL-01 closed — `pnpm dlx publint packages/<pkg>` exits 0 with "All good!" on all 4 @kehto/* packages (acl, runtime, shell, services); verbatim output captured in 22-ITERATION-LOG.md.
- REL-02 closed — `pnpm dlx @arethetypeswrong/cli --profile esm-only --pack packages/<pkg>` exits 0 on all 4 packages; node16 (from ESM) 🟢, bundler 🟢, node10 (ignored) 🟢; verbatim output + exit codes captured.
- 22-ITERATION-LOG.md created — new phase-level log at `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md` (246 lines) providing the audit-trail scaffold REL-03/REL-04/E2E-10 plans will extend.
- Publish-readiness confirmed — two independent tools (publint + attw) validate the canonical ESM-only shape end-to-end; packages are publish-ready pending only upstream @napplet/core npm unblock.

## Task Commits

Each task was committed atomically:

1. **Task 1: publint — REL-01** — `de1a798` (feat)
2. **Task 2: attw --profile esm-only --pack — REL-02** — `238d784` (feat)

**Plan metadata:** pending (next — after STATE.md + ROADMAP.md updates)

## publint Exit Codes

| Package | Exit | Output |
| ------- | ---- | ------ |
| @kehto/acl | 0 | All good! |
| @kehto/runtime | 0 | All good! |
| @kehto/shell | 0 | All good! |
| @kehto/services | 0 | All good! |

## attw (--profile esm-only --pack) Exit Codes

| Package | Exit | node16 (ESM) | bundler | node10 (ignored) | node16 (CJS, ignored) |
| ------- | ---- | ------------ | ------- | ---------------- | --------------------- |
| @kehto/acl | 0 | 🟢 ESM | 🟢 | 🟢 | ⚠️ ESM dynamic import only (expected) |
| @kehto/runtime | 0 | 🟢 ESM | 🟢 | 🟢 | ⚠️ ESM dynamic import only (expected) |
| @kehto/shell | 0 | 🟢 ESM | 🟢 | 🟢 | ⚠️ ESM dynamic import only (expected) |
| @kehto/services | 0 | 🟢 ESM | 🟢 | 🟢 | ⚠️ ESM dynamic import only (expected) |

## package.json Fixes Applied

**None.** All 4 @kehto/* package.json files already conform to the canonical ESM-only shape documented in the plan:

- `"type": "module"` ✓
- `"main": "./dist/index.js"` + `"module": "./dist/index.js"` + `"types": "./dist/index.d.ts"` (all aligned) ✓
- `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }` — types condition first ✓
- `"files": ["dist"]` ✓
- `"sideEffects": false` ✓
- `"publishConfig": { "access": "public" }` ✓
- `"repository"` (type + url + directory), `"keywords"`, `"license": "MIT"` ✓

The canonical shape was established in prior milestones and carried intact through v1.3. Neither publint nor attw found a gap worth remediating.

## Files Created/Modified

- `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md` (created, 246 lines) — Phase 22 iteration log scaffold with REL-01 + REL-02 sections (verbatim tool output, exit codes, combined for-loop verification, Findings, CLOSED status markers). Future plans (22-05, 22-06, 22-07/08) will append REL-03/REL-04/E2E-10/E2E-11 sections to this file.
- `.planning/phases/22-docs-refresh-release-rehearsal/22-04-SUMMARY.md` (this file)

## Decisions Made

- **Idempotency check protocol established:** Before appending each REL section, check `grep -q '^## REL-0X — tool' <log>` and skip if already present. Pattern applies to REL-03/REL-04 plans that will append to the same log file.
- **attw `--pack` flag retained** (Claude's-discretion per W1): runs `npm pack` on each package and inspects the packed tarball contents, mirroring real-publish semantics rather than relying on source-directory-only resolution. Trade-off: slower (pack step ~1-2s/package) but higher fidelity. D-04 only mandates `--profile esm-only`; `--pack` is the safer default for release rehearsal.
- **ESM-only-by-design reaffirmed:** `node16 (from CJS)` warning of "ESM (dynamic import only)" is expected behavior — it documents that CJS consumers must use `await import()` — and `--profile esm-only` suppresses this row as out-of-contract. Not a finding, not a fix.

## Deviations from Plan

None — plan executed exactly as written. Both tools reported clean on first pass, so no package.json modifications were needed, and the Rule-1/2/3 auto-fix paths were never exercised.

## Issues Encountered

None. `pnpm build` was a no-op (cached from Phase 22-03), publint downloaded fresh on first invocation then was cached for subsequent calls, attw downloaded its 54-package dep graph once and was cached thereafter.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **22-ITERATION-LOG.md scaffold ready** — Plans 22-05, 22-06, 22-07, 22-08 can append their sections (REL-03, REL-04, E2E-10, E2E-11) using the same idempotency + verbatim-output pattern established here.
- **REL-01 + REL-02 require no further work** — packages are publint-clean and attw-ESM-clean; if a future plan re-runs these tools as a regression check (e.g., after a package.json refactor in a later milestone), the CLOSED markers will be re-verified by grep.
- **REQUIREMENTS.md update needed** — 22-04's frontmatter declares `requirements: [REL-01, REL-02]`; the post-plan state-update step will mark both complete.
- **Phase 22 continuing:** Plans 22-05..22-08 (changeset dry-run, v1.3 changesets, E2E-10 resolution, phase close) remain in the gap-closure serialized chain.

---
*Phase: 22-docs-refresh-release-rehearsal*
*Completed: 2026-04-18*

## Self-Check: PASSED

- FOUND: `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md`
- FOUND: `.planning/phases/22-docs-refresh-release-rehearsal/22-04-SUMMARY.md`
- FOUND: commit `de1a798` (Task 1 — REL-01 publint)
- FOUND: commit `238d784` (Task 2 — REL-02 attw)
- FOUND: `## REL-01 — publint` section in iteration log
- FOUND: `## REL-02 — attw (@arethetypeswrong/cli --profile esm-only)` section in iteration log
- CONFIRMED: 8 `### @kehto/*` subsections (4 per REL section, as expected)
- CONFIRMED: 2 `CLOSED` status markers (one per REL section)
