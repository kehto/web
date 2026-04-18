---
phase: 22-docs-refresh-release-rehearsal
plan: 3
subsystem: docs
tags: [readme, docs, migrations, archive, typedoc, nip-5d, v1.3]

requires:
  - phase: 22-docs-refresh-release-rehearsal-01
    provides: typedoc + pnpm docs:api infrastructure (entryPointStrategy packages, docs/api output)
provides:
  - Root README rewritten as the v1.3 reference-integration narrative (apps/demo + 4 @kehto packages + quick integration example)
  - Legacy `docs/*-MIGRATION.md`, `docs/GAP-ANALYSIS.md`, `docs/v1.2-NIP-5D-AUDIT.md` archived under `docs/migrations/` with terminal-state headers
  - `docs/migrations/README.md` index tabulating each archived file's scope and capture date
  - `docs/` directory cleaned — only `api/` (typedoc output) and `migrations/` (archive) remain
affects: [phase-22-docs-refresh-release-rehearsal, v1.3-release-rehearsal]

tech-stack:
  added: []
  patterns:
    - "Root README as v1.3 reference-integration narrative (not a migration tracker)"
    - "docs/migrations/ as a history archive with terminal-state blockquote headers — reader immediately knows the doc is not live guidance"
    - "Cross-links: root README → apps/demo, docs/api/, each per-package README; migrations index → root README, packages/, docs/api/"

key-files:
  created:
    - docs/migrations/README.md
  modified:
    - README.md
    - docs/migrations/ACL-MIGRATION.md (moved from docs/ACL-MIGRATION.md + header prepended)
    - docs/migrations/RUNTIME-MIGRATION.md (moved from docs/RUNTIME-MIGRATION.md + header prepended)
    - docs/migrations/SERVICES-MIGRATION.md (moved from docs/SERVICES-MIGRATION.md + header prepended)
    - docs/migrations/SHELL-MIGRATION.md (moved from docs/SHELL-MIGRATION.md + header prepended)
    - docs/migrations/GAP-ANALYSIS.md (moved from docs/GAP-ANALYSIS.md + header prepended)
    - docs/migrations/v1.2-NIP-5D-AUDIT.md (moved from docs/v1.2-NIP-5D-AUDIT.md + header prepended)

key-decisions:
  - "Adopted D-03 option (a): archive 6 legacy docs under docs/migrations/ with terminal-state blockquote headers, rather than rewriting them for v1.3 — those docs describe historical transitions already shipped"
  - "Used git mv (not rm+add) for all 6 moves so git log --follow preserves pre-plan authoring history"
  - "Root README references apps/demo/src/shell-host.ts as the canonical integration example (createDemoHooks is an internal function in shell-host.ts, not a separate file — plan's reference to apps/demo/src/createDemoHooks.ts was adjusted to avoid broken link)"
  - "Terminal-state header is a 4-line blockquote followed by a horizontal rule so archived content remains verbatim below but readers see archive status immediately above the fold"

patterns-established:
  - "Root README structure for protocol runtimes: milestone banner → package table → quick integration → spec → API reference → build/test → architecture notes → history"
  - "Archive directory pattern: dedicated subdir + index README + per-file terminal-state header → history preserved without polluting the live doc surface"

requirements-completed: [DOCS-03]

duration: 2min
completed: 2026-04-18
---

# Phase 22 Plan 3: Docs Refresh — Root README + Migration Archive Summary

**Rewrote root README as the v1.3 reference-integration narrative (apps/demo + 4 @kehto packages + quick integration example) and archived 6 legacy docs/ migration snapshots under docs/migrations/ with terminal-state headers; operationalizes DOCS-03.**

## Performance

- **Duration:** 2min
- **Started:** 2026-04-18T11:29:47Z
- **Completed:** 2026-04-18T11:31:47Z
- **Tasks:** 2
- **Files modified:** 8 (1 README rewrite, 6 archive moves with header prepend, 1 new index README)

## Accomplishments

- Root `README.md` expanded from a 31-line v1.0/v1.1 stub to a 101-line v1.3 reference-integration narrative with Quick Integration code block and full cross-links to `apps/demo`, `docs/api`, and all 4 per-package READMEs.
- All 6 legacy docs moved to `docs/migrations/` with git history preserved via `git mv` (visible via `git log --follow`).
- Each archived doc now has a 4-line terminal-state blockquote header pointing readers at current canonical docs (root README, per-package READMEs, `docs/api/`).
- New `docs/migrations/README.md` index tabulates scope + capture date for each archived file so the archive is self-describing.
- `docs/` root directory now cleanly contains only `api/` (typedoc output) and `migrations/` (archive) — no stray `*-MIGRATION.md` at top level.
- `pnpm docs:api` still exits 0 after the reshuffle (only the pre-existing `PendingUpdate` warning from Plan 22-02 follow-up remains — unchanged).

## Task Commits

1. **Task 1: Rewrite root README for v1.3 reference integration** — `48f731b` (docs)
2. **Task 2: Archive 6 legacy migration docs + create index README** — `8e52b6e` (docs)

## Files Created/Modified

- `README.md` — Completely rewritten as v1.3 narrative: milestone banner + package table + quick integration code block + NIP-5D spec section + docs/api reference + build/test + architecture notes + history → docs/migrations/. 101 lines.
- `docs/migrations/ACL-MIGRATION.md` — moved from `docs/`, terminal-state header prepended.
- `docs/migrations/RUNTIME-MIGRATION.md` — moved from `docs/`, terminal-state header prepended.
- `docs/migrations/SERVICES-MIGRATION.md` — moved from `docs/`, terminal-state header prepended.
- `docs/migrations/SHELL-MIGRATION.md` — moved from `docs/`, terminal-state header prepended.
- `docs/migrations/GAP-ANALYSIS.md` — moved from `docs/`, terminal-state header prepended.
- `docs/migrations/v1.2-NIP-5D-AUDIT.md` — moved from `docs/`, terminal-state header prepended.
- `docs/migrations/README.md` — NEW: archive index with per-file table (scope + capture date) and pointers to current canonical docs.

## Git-Move History Preservation

Spot-checked two files — history is fully preserved by `git log --follow`:

**`docs/migrations/ACL-MIGRATION.md`:**
```
8e52b6e docs(22-03): archive 6 legacy migration docs under docs/migrations/
03704af fix(docs): fix CAP_SIGN_EVENT scope and pseudocode in ACL-MIGRATION.md
a93d859 docs(02-01): add ACL-MIGRATION.md section 3 (persisted data migration strategy)
7f28cfc docs(02-01): add ACL-MIGRATION.md sections 1-2 (identity schema + capability mapping)
```

**`docs/migrations/GAP-ANALYSIS.md`:**
```
8e52b6e docs(22-03): archive 6 legacy migration docs under docs/migrations/
2a1826f fix(docs): fix pubkey field name in GAP-ANALYSIS.md section 5.4
5877949 feat(01-02): complete GAP-ANALYSIS.md with sections 4 and 5
c73a592 feat(01-gap-analysis-01): create GAP-ANALYSIS.md sections 1-3
```

All 6 files render as `R` (rename) in git, not `D`+`A`, confirming history preservation.

## typedoc Verification

`pnpm docs:api` after reshuffle:

```
[info] Converting project at ./packages/acl
[info] Converting project at ./packages/runtime
[info] Converting project at ./packages/shell
[warning] PendingUpdate, defined in @kehto/shell/src/session-registry.ts, is referenced by nappKeyRegistry.__type.getPendingUpdate but not included in the documentation
[info] Converting project at ./packages/services
[info] Merging converted projects
[info] html generated at ./docs/api
[warning] Found 0 errors and 1 warnings
```

Exit 0. The single `PendingUpdate` warning is pre-existing (documented in STATE.md as a Plan 22-02 follow-up) — the doc archive reshuffle did not introduce any new warnings.

## Decisions Made

- **Followed D-03 option (a):** Archived 6 legacy docs under `docs/migrations/` with terminal-state headers, rather than rewriting them for v1.3. Those docs describe historical transitions (RUNTIME-SPEC v2.0.0 → NIP-5D, v1.1 → v1.2 conformance) that have already shipped — rewriting would turn them into duplicates of the per-package READMEs or the root README narrative.
- **Used `git mv` for all 6 moves** so pre-plan commits remain reachable via `git log --follow`. Confirmed post-commit: renames show as `R 98%-99%` similarity scores.
- **Header format:** 4-line blockquote + blank line + horizontal rule + blank line + original content. Blockquote ensures the archive notice is visually distinct from the archived body; horizontal rule keeps the archive body verbatim below.
- **createDemoHooks reference adjustment:** Plan's suggested README referenced `apps/demo/src/createDemoHooks.ts` as a separate file. `createDemoHooks` is actually a local function inside `apps/demo/src/shell-host.ts`, not a standalone file. Rewrote the README's canonical-example pointer to reference `apps/demo/src/shell-host.ts` only (with inline note that it contains the `createDemoHooks()` adapter factory). This prevents a broken link and still surfaces the right file to integrators.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed reference to non-existent `apps/demo/src/createDemoHooks.ts` in root README**
- **Found during:** Task 1 (pre-write, while checking `apps/demo/src/` file listing for link correctness)
- **Issue:** Plan's README template listed `[apps/demo/src/createDemoHooks.ts](./apps/demo/src)` as a canonical example pointer. `createDemoHooks` is a local function inside `apps/demo/src/shell-host.ts`, not a separate file — linking to a non-existent file would ship a broken doc link.
- **Fix:** Replaced the bullet with a single link to `apps/demo/src/shell-host.ts` with an inline note clarifying that the file contains the `createDemoHooks()` adapter factory and per-domain service registration. `shell-host.ts` was already the primary canonical link, so this removes a redundant second link that pointed at a broken path.
- **Files modified:** `README.md`
- **Verification:** `grep -rn 'function createDemoHooks' apps/demo/src/` returns `apps/demo/src/shell-host.ts` only (one hit); `ls apps/demo/src/` confirms no `createDemoHooks.ts` file. All hardcoded `shell-host.ts` / `apps/demo/src/shell-host.ts` references in README resolve correctly.
- **Committed in:** `48f731b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — reference to non-existent file)
**Impact on plan:** Minimal. DOCS-03 intent preserved (README still points at the canonical integration example); deviation prevented a broken link from shipping. No scope creep.

## Issues Encountered

None — both tasks executed exactly as written; the one README adjustment was pre-emptive link-correctness enforcement, not a problem encountered during execution.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- DOCS-03 complete. All three DOCS requirements from Phase 22 are now operationalized:
  - DOCS-01 (typedoc + `pnpm docs:api`) — Plan 22-01 (complete).
  - DOCS-02 (per-package READMEs) — Plan 22-02 (in parallel wave 1 with this plan).
  - DOCS-03 (root README + migration archive) — this plan, complete.
- Phase 22 release-rehearsal half (REL-01..04, E2E-10, E2E-11 closure) is the next wave (Plan 22-04 and beyond).
- No blockers introduced. Archive is stable — future phases should not need to touch `docs/migrations/` except to add further terminal-state snapshots.

---
*Phase: 22-docs-refresh-release-rehearsal*
*Completed: 2026-04-18*

## Self-Check: PASSED

- All 9 key files on disk (1 created: `docs/migrations/README.md`; 8 modified/created-by-move).
- Both task commits reachable (`48f731b`, `8e52b6e`).
- All 6 legacy docs absent from `docs/` root (only `api/` + `migrations/` remain).
- `pnpm docs:api` exits 0 post-reshuffle.
