---
phase: 22-docs-refresh-release-rehearsal
plan: 6
subsystem: release
tags: [changesets, release-rehearsal, traceability, requirements, rel-04]

# Dependency graph
requires:
  - phase: 22-docs-refresh-release-rehearsal
    provides: Plan 22-05 REL-03 iteration-log scaffolding (changeset CLI verified, v1-2 changesets untouched)
provides:
  - 4 staged v1.3 changeset files (.changeset/v1-3-{acl,runtime,shell,services}.md)
  - REL-04 evidence section appended to 22-ITERATION-LOG.md (B2 blocker fix)
  - REL-04 requirement marked Complete in REQUIREMENTS.md
affects:
  - 22-08 (wrap-up Summary Table claim of REL-04 CLOSED now backed by iteration-log evidence)
  - Future changeset version run (will consume both v1-2-*.md + v1-3-*.md into single CHANGELOG entries)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "v1.3 patch-bump changeset convention (no protocol changes, consume-and-showcase)"
    - "Requirement-ID citation pattern in changeset bodies (DEMO-/NAP-/E2E-/DOCS- prefixes)"
    - "W5 quoting convention: single-quoted or bare legacy API terms in changeset bodies; backticks reserved for live v1.2 identifiers"

key-files:
  created:
    - .changeset/v1-3-acl.md
    - .changeset/v1-3-runtime.md
    - .changeset/v1-3-shell.md
    - .changeset/v1-3-services.md
  modified:
    - .planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md

key-decisions:
  - "Bump type `patch` for all 4 v1.3 changesets per D-06 default — no new public API in v1.3"
  - "Changeset CLI aggregates v1-2 minor + v1-3 patch → minor at the package level (minor wins); this is expected and documented in the REL-04 iteration-log evidence"
  - "REL-04 evidence section appended (not duplicated) after REL-03 with idempotency guard"

patterns-established:
  - "Per-package v1.3 scope summarization: acl (consume-and-showcase) / runtime (session-registry + shim routing + JSDoc) / shell (publishTheme + PendingUpdate re-export) / services (notify.* canonical + identity.getPublicKey contract)"
  - "Requirement-ID citation in every changeset body (min 3 citations; max 6 in v1-3-services.md)"
  - "Anti-term grep gate: `grep -E '`window\\.nostr`|`signer-service`|`signer\\.sign`|`BusKind`|kind 2900[12]'` must return no matches against .changeset/v1-3-*.md"

requirements-completed:
  - REL-04

# Metrics
duration: 3min
completed: 2026-04-18
---

# Phase 22 Plan 6: v1.3 Changesets Staged Summary

**4 v1.3 `patch`-bump changeset files authored for @kehto/{acl,runtime,shell,services}, each citing the DEMO-/NAP-/E2E-/DOCS- requirement IDs its package work covers; REL-04 evidence appended to 22-ITERATION-LOG.md with file paths, ls -la, line counts, frontmatter heads, citation counts, and anti-term grep proof.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-18T13:17:58Z (post-22-05 completion)
- **Completed:** 2026-04-18T13:21:08Z
- **Tasks:** 3
- **Files created:** 4 (all .changeset/v1-3-*.md)
- **Files modified:** 1 (22-ITERATION-LOG.md)

## Accomplishments

- 4 changeset files staged at `.changeset/v1-3-{acl,runtime,shell,services}.md`, each with valid YAML frontmatter declaring `@kehto/<pkg>: patch`.
- Per-changeset bodies cite DEMO-/NAP-/E2E-/DOCS- requirement IDs per D-06 traceability (3-6 citations each).
- Anti-term hygiene clean: `grep` for backticked `window.nostr` / `signer-service` / `signer.sign` / `BusKind` / `kind 29001/29002` returns no matches across all 4 files (W5 quoting convention respected).
- `pnpm changeset status` parses all 4 v1-3-*.md alongside existing 4 v1-2-*.md (8 staged changesets total).
- `pnpm build` clean (20/20 turbo cached) — changeset authoring does not touch source.
- REL-04 evidence section appended to 22-ITERATION-LOG.md with File paths / ls -la / Line counts / Frontmatter heads / Citation counts / Anti-term hygiene / CLI validation / v1-2 regression check / Build hygiene / CLOSED status sub-blocks (B2 blocker fix).

## Task Commits

Each task committed atomically:

1. **Task 1: Create .changeset/v1-3-acl.md + v1-3-runtime.md** — `97b7bc8` (chore)
2. **Task 2: Create .changeset/v1-3-shell.md + v1-3-services.md** — `41b12b9` (chore)
3. **Task 3: Append REL-04 evidence section to 22-ITERATION-LOG.md** — `7d25a29` (docs)

## Files Created/Modified

### Per-changeset line counts + bump types

| File | Bump | Lines | Scope |
|---|---|---|---|
| `.changeset/v1-3-acl.md` | patch | 14 | Consume-and-showcase (DEMO-03 ACL panel + E2E-08 capability-matrix + DOCS-01/02) |
| `.changeset/v1-3-runtime.md` | patch | 20 | session-registry.register in loadNapplet (Phase 19) + shim identity.*.error routing (Phase 21) + 8-file @example JSDoc |
| `.changeset/v1-3-shell.md` | patch | 17 | publishTheme fan-out via getAllWindowIds (Phase 20) + PendingUpdate re-export (22-02) |
| `.changeset/v1-3-services.md` | patch | 19 | notify.* canonical envelope handling (Phase 17/19) + dual-register notifications/notify (Phase 19) + identity-service getPublicKey always-returns-result contract (Phase 20) |

Total: 70 lines across 4 changeset files; all exceed `min_lines: 8` must_have threshold.

### Requirement-ID coverage per changeset

| Changeset | Citations | Requirement IDs covered |
|---|---|---|
| v1-3-acl.md | 3 | DEMO-03, E2E-08, DOCS-01, DOCS-02 |
| v1-3-runtime.md | 5 | NAP-01, NAP-02, NAP-03..09, E2E-07, E2E-09, DOCS-01, DOCS-02 |
| v1-3-shell.md | 4 | DEMO-02, NAP-08, E2E-07, DOCS-01, DOCS-02 |
| v1-3-services.md | 6 | DEMO-05, DEMO-07, NAP-05, NAP-07, E2E-07, DOCS-01, DOCS-02 |

Each body cites ≥1 DEMO-/NAP-/E2E-/DOCS- requirement ID per the `key_links` acceptance criterion.

### Modified

- `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md` — appended `## REL-04 — v1.3 Changesets Staged` section (~115 lines) with 9 evidence sub-blocks + CLOSED status marker.

## Confirmations

- **`pnpm changeset status`** lists 8 pending changesets (4 v1.2 minor + 4 v1.3 patch). Aggregated bump-type report shows `minor` for all 4 @kehto/* packages because changeset aggregates to the highest bump per package (minor wins over patch). This is expected behavior and documented in the iteration log.
- **Anti-term grep** (`grep -E '`window\.nostr`|`signer-service`|`signer\.sign`|`BusKind`|kind 2900[12]' .changeset/v1-3-*.md`) returns no matches.
- **22-ITERATION-LOG.md** contains exactly one `## REL-04 — v1.3 Changesets Staged` section (not duplicated — idempotency guard fired once per execution).
- **v1-2-*.md changesets** all 4 still present (`ls .changeset/v1-2-*.md | wc -l` = 4) — no regression.
- **`pnpm build`** clean (20/20 turbo cached) post-stage — changeset authoring does not touch source.

## Decisions Made

- **Patch bump for all 4 packages.** Per D-06 default: v1.3 is consume-and-showcase with no new public API. The `PendingUpdate` re-export in @kehto/shell is additive but classified as a type re-export (not a new capability), so it qualifies for `patch` rather than `minor`.
- **Changeset CLI aggregation is expected.** `pnpm changeset status` reports `minor` for all 4 @kehto/* packages because v1-2-*.md declares minor and v1-3-*.md declares patch; changeset takes the max per package. When `changeset version` eventually runs, both bodies concatenate under a single 0.1.0 → 0.2.0 minor transition CHANGELOG entry.
- **W5 quoting convention respected.** Legacy API references in prose use bare words (e.g., "no host-injected 'nostr' object") or single quotes, never backticks. Backticks in v1-3-*.md bodies are only around live v1.2 identifiers (`relay.publish`, `sessionRegistry.register()`, `originRegistry.getAllWindowIds()`, `notify.create`, `identity.getPublicKey`, `notifications`, `notify`, `@example`, method/function names). The anti-term grep passes.

## Deviations from Plan

None — plan executed exactly as written. Changeset body content came from the plan's templated EXACT content for each file; no deviations from the specified text. Iteration-log append followed the plan's structure precisely.

## Issues Encountered

None. Task 1 and Task 2 verification commands all passed on first attempt. `pnpm changeset status` parsed all 4 files without errors. Build stayed cached (20/20 full turbo). The only non-blocking observation worth recording: `pnpm changeset status` aggregates to `minor` at the package level because the existing v1-2-*.md changesets declare minor — this is expected behavior per the changeset tool's spec and does not affect REL-04 closure.

## User Setup Required

None — no external service configuration required. Changeset files are local repository metadata.

## Next Phase Readiness

- **REL-04 CLOSED.** All 4 v1.3 changesets staged; iteration-log evidence captured; REQUIREMENTS.md line 151 updated to Complete.
- **Phase 22 gap closure progressing.** Remaining incomplete plans: 22-07 (E2E-10 full green gate) and 22-08 (wrap-up / Summary Table). 22-08's Summary Table claim of REL-04 CLOSED is now backed by the iteration-log evidence this plan produced (B2 blocker fix).
- **Ready for future `changeset version` run.** When `@napplet/core` unblocks on npm, the 4 v1.2 minor + 4 v1.3 patch changesets will fold into a single 0.1.0 → 0.2.0 minor CHANGELOG entry per @kehto/* package.

## Self-Check: PASSED

- `.changeset/v1-3-acl.md` — FOUND
- `.changeset/v1-3-runtime.md` — FOUND
- `.changeset/v1-3-shell.md` — FOUND
- `.changeset/v1-3-services.md` — FOUND
- `.planning/phases/22-docs-refresh-release-rehearsal/22-ITERATION-LOG.md` REL-04 section — FOUND
- Commit `97b7bc8` (Task 1) — FOUND
- Commit `41b12b9` (Task 2) — FOUND
- Commit `7d25a29` (Task 3) — FOUND

---
*Phase: 22-docs-refresh-release-rehearsal*
*Completed: 2026-04-18*
