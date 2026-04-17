---
phase: 15-milestone-validation-release-prep
plan: 01
subsystem: release-prep
tags: [changesets, release-notes, validation, milestone, vitest, turbo]

requires:
  - phase: 10-spec-conformance-audit
    provides: docs/v1.2-NIP-5D-AUDIT.md (drift table)
  - phase: 11-nub-peer-deps-type-imports
    provides: Peer-dep shape (all 4 packages) + DRIFT-CORE-06 core-compat shim
  - phase: 12-shell-conformance-seven-nub-coverage
    provides: 8-domain ACL + shell conformance + identity/keys/media/notify/relay/storage/ifc handlers
  - phase: 13-theme-nub-implementation
    provides: theme runtime + theme service + publishTheme shell broadcast
  - phase: 14-dispatch-refactor
    provides: createDispatch + 8 registerNub adapters (449 tests green)
provides:
  - Four @kehto/* minor-bump changesets ready for `pnpm changeset version` (next release step)
  - Deletion of legacy tests/unit/shell-runtime-integration.test.ts (19 skipped v1.1 signer/BusKind tests retired)
  - Green validation gate for v1.2 (pnpm build + pnpm type-check + pnpm -r test all exit 0)
  - DEPS-02 + DEPS-03 flipped to [x] — milestone v1.2 REQUIREMENTS.md is fully satisfied
affects: [v1.2 release, future changeset version runs, v1.3 milestone kickoff]

tech-stack:
  added: []
  patterns:
    - "Release-prep plan: changesets land as .changeset/vX-Y-<pkg>.md, never as version bumps in this phase (changeset version is a separate release step)"
    - "Milestone validation gate: pnpm build + pnpm type-check + pnpm -r test executed in sequence — build first so type emission is verified, type-check second so noEmit tsc confirms the broader graph, tests last as the behavioral seal"
    - "Legacy-test deletion pattern: use git rm inside a task so the deletion is staged atomically alongside other task edits; migration rationale duplicated in release-notes (services changeset body) for downstream auditability"

key-files:
  created:
    - .changeset/v1-2-acl.md
    - .changeset/v1-2-runtime.md
    - .changeset/v1-2-shell.md
    - .changeset/v1-2-services.md
  modified:
    - .planning/REQUIREMENTS.md (DEPS-02, DEPS-03 flipped [ ] → [x])
  deleted:
    - tests/unit/shell-runtime-integration.test.ts (19 it.skip'd v1.1 tests; rationale in .changeset/v1-2-services.md)

key-decisions:
  - "4 changesets at minor bump — one per @kehto/* package; 0.1.0 → 0.2.0 semver within 0.x signals breaking potential (D-01 from 15-CONTEXT.md)"
  - "Each changeset body cites @napplet/core ^0.2.0 peer-dep bump and all 8 @napplet/nub-* peer deps (D-02 from 15-CONTEXT.md)"
  - "Delete legacy shell-runtime-integration.test.ts rather than migrate — ≥80% of assertions would need rewriting, effectively creating new tests not migrating existing ones; equivalent coverage already lives in Phases 12-03/04/08/09 (D-03 from 15-CONTEXT.md)"
  - "Do NOT run `pnpm changeset version` or `pnpm changeset publish` in this phase — those are release steps deferred until @napplet/core ships to npm (D-04 from 15-CONTEXT.md)"
  - "Preserve packages/runtime/src/core-compat.ts — DRIFT-CORE-06 shim stays until @napplet/core restores legacy exports (D-05 from 15-CONTEXT.md); runtime changeset body calls this out explicitly"

patterns-established:
  - "Release-notes provenance: when a test is deleted (not migrated), the deletion rationale lives in both the commit message AND the relevant changeset body so release-notes readers don't lose context"
  - "Changeset frontmatter convention: `---` 3-dash delimiters with `\"@kehto/<pkg>\": <bump>` on its own line — no internal YAML list structure; @changesets/cli consumes on next version run"
  - "Milestone validation gate sequence: build → type-check → tests, with each step required to exit 0 before proceeding; any failure stops the phase before REQUIREMENTS.md flips"

requirements-completed: [DEPS-02, DEPS-03]

duration: 3 min
completed: 2026-04-17
---

# Phase 15 Plan 1: Milestone Validation & Release Prep Summary

**v1.2 milestone sealed — 4 minor-bump changesets staged, legacy signer/BusKind integration test retired, full validation gate (build + type-check + test) green, REQUIREMENTS.md fully checked off.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-17T21:35:12Z
- **Completed:** 2026-04-17T21:39:01Z
- **Tasks:** 3 (1 create, 1 delete, 1 verify)
- **Files modified:** 4 created + 1 modified + 1 deleted = 6

## Accomplishments

- Four `@kehto/*` package changesets created under `.changeset/v1-2-<pkg>.md`, each declaring a `minor` bump and citing both the `@napplet/core` peer-dep bump (>=0.1.0 → ^0.2.0) and the 8 new `@napplet/nub-*` peer deps (all ^0.2.0).
- Legacy `tests/unit/shell-runtime-integration.test.ts` removed via `git rm` — its 19 `it.skip`'d tests imported @napplet/core v0.2.0-removed symbols and asserted Phase-12-deleted `signer.*` surface; deletion rationale preserved in commit history AND in `.changeset/v1-2-services.md` release notes for downstream auditability.
- Full validation gate run and passed:
  - `pnpm build` — 11 successful tasks (4 @kehto/* packages + demo + harness + dependents), FULL TURBO cache hit path verified
  - `pnpm type-check` — 8 successful tasks, tsc --noEmit clean across the workspace
  - `pnpm -r test` — exit 0 across all 11 scoped workspace projects
  - `pnpm test:unit` (the direct vitest invocation) — **449 passed / 0 skipped** across **30 test files** (was 449 passed + 19 skipped prior; the 19 skipped tests lived inside the deleted file's top-level `describe.skip`)
- `docs/v1.2-NIP-5D-AUDIT.md` intact: 32 rows with Target Phase=12 in the drift table, every one carrying a `Resolved in Phase 12` / `Resolved in Plan 12-NN` / `Resolved in Phase 13` annotation (0 unresolved).
- `packages/runtime/src/core-compat.ts` untouched, DRIFT-CORE-06 header preserved per D-05 — called out explicitly in `.changeset/v1-2-runtime.md` "Known carry-over" section.
- REQUIREMENTS.md: **DEPS-02** and **DEPS-03** flipped from `[ ]` to `[x]`; zero unchecked v1.2 requirements remain outside `## Future Requirements` and `## Out of Scope`.

## Task Commits

1. **Task 1: Create 4 changeset files** — `226cdca` (chore)
2. **Task 2: Delete legacy shell-runtime-integration test** — `e61d0b2` (chore)
3. **Task 3: Run full validation gate** — verification-only, no files modified, no commit

**Plan metadata commit** — added after SUMMARY/STATE/ROADMAP/REQUIREMENTS update (appended to history post-self-check).

## Files Created / Modified / Deleted

**Created:**
- `.changeset/v1-2-acl.md` — @kehto/acl minor bump release notes: 8-domain ACL coverage, signer removed, new capability constants
- `.changeset/v1-2-runtime.md` — @kehto/runtime minor bump release notes: createDispatch/registerNub adoption, 8-case switch removed, publishEncrypted routing, theme dispatch, core-compat shim retained (DRIFT-CORE-06)
- `.changeset/v1-2-shell.md` — @kehto/shell minor bump release notes: window.nostr injection REMOVED (BREAKING), `perm:` namespace, per-domain proxies, keys-forwarder, publishTheme broadcast API
- `.changeset/v1-2-services.md` — @kehto/services minor bump release notes: signer-service deleted (BREAKING), identity/keys/media/notify/theme services added; records shell-runtime-integration.test.ts deletion rationale

**Modified:**
- `.planning/REQUIREMENTS.md` — DEPS-02 and DEPS-03 flipped `[ ]` → `[x]`; v1.2 milestone is now 26/26 complete

**Deleted:**
- `tests/unit/shell-runtime-integration.test.ts` — 19 legacy it.skip'd tests importing v0.2.0-removed @napplet/core symbols (BusKind, ALL_CAPABILITIES, DESTRUCTIVE_KINDS, REPLAY_WINDOW_SECONDS, TOPICS, AUTH_KIND, Capability, BusKindValue, TopicKey, TopicValue) and asserting Phase-12-deleted signer.* surface

## Decisions Made

All decisions were pre-locked in `.planning/phases/15-milestone-validation-release-prep/15-CONTEXT.md` (D-01 through D-05) and executed as specified:

- **D-01: Minor bump × 4 changesets.** Each @kehto/* package bumps 0.1.0 → 0.2.0; consumers are expected to read release notes at 0.x minor bumps, and a major bump to 1.0.0 was deferred per CONTEXT.md "Deferred Ideas".
- **D-02: Peer-dep citation in every changeset body.** All four bodies list the @napplet/core bump plus the 8 @napplet/nub-* adds so release-notes readers get the dependency reality in one view.
- **D-03: Delete, don't migrate, the legacy test.** Migration would rewrite ≥80% of assertions — net result is new tests. Equivalent coverage already exists in Phases 12-03 (identity), 12-04 (ifc), 12-08 (relay publishEncrypted), and 12-09 (storage).
- **D-04: Do NOT run `changeset version` / `changeset publish`.** Those are release steps outside this milestone; publishing is blocked upstream on @napplet/core reaching npm.
- **D-05: Preserve core-compat.ts.** DRIFT-CORE-06 shim stays; its fate is tied to upstream @napplet/core restoring legacy exports.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's Phase-12 DRIFT row grep pattern is malformed against the actual audit-doc table**
- **Found during:** Task 3 (Step 4 — audit doc row count)
- **Issue:** The plan's `<verify>` automated check and Step 4 use `grep -cE "^\| DRIFT-.*Phase 12 \|"` against `docs/v1.2-NIP-5D-AUDIT.md`. That pattern matches zero rows because the drift table stores the phase as a bare integer column (`| DRIFT-XXX-NN | ... | 12 |`), not `| Phase 12 |`. The literal plan grep returns `0`, which would falsely suggest the audit doc lost its content.
- **Fix:** Ran the corrected grep `grep -cE '^\| DRIFT-.*\| 12 \|'` which matches the actual table shape. Result: 32 Phase-12 DRIFT rows present; additionally verified every one carries a `Resolved` annotation (`grep -E '^\| DRIFT-.*\| 12 \|' docs/v1.2-NIP-5D-AUDIT.md | grep -cv "Resolved"` → `0`). The audit doc's own `## Summary` section at line 170 also states "Phase 12: 26 rows — ✅ resolved" (the 26 vs 32 discrepancy is pre-existing in the doc's own accounting and predates this phase).
- **Files modified:** None — this is a verification-script correctness issue, not a repo-state issue. The underlying acceptance criterion ("audit doc still shows Phase-12 drift rows annotated as resolved") is satisfied: 32 rows, all with resolution annotations.
- **Verification:** `grep -cE '^\| DRIFT-.*\| 12 \|' docs/v1.2-NIP-5D-AUDIT.md` → `32`; same grep filtered for non-"Resolved" → `0`.
- **Committed in:** N/A (no code change — deviation is script-semantics clarification recorded here for downstream verifier)

---

**Total deviations:** 1 auto-fixed (1 blocking — plan-grep-vs-doc-format mismatch, substance correct)
**Impact on plan:** Zero. All acceptance criteria met in substance. The incorrect grep in the plan is a script-writing issue that did not affect which files were created or deleted; the audit doc content requirement is satisfied.

## Issues Encountered

- **Turbo cache masks `pnpm -r test` output.** Because no `test` script triggered source changes that invalidate the turbo graph, `pnpm -r test` printed only `Scope: 11 of 12 workspace projects` and exited 0 from cached replay. Real test counts were captured via the direct `pnpm test:unit` (vitest) invocation to confirm 449 passed / 0 skipped / 30 files. Both exit 0; no behavioral concern.
- **Submodule drift for `napplet/` gitlink** shows in `git status` (pre-existing `06f26ec → 3a6d160`). Left untouched — out of scope for this plan and for v1.2's milestone scope (napplet submodule state is managed by the upstream dev cycle, not by kehto release prep).

## User Setup Required

None — no external service configuration required. Publishing to npm is deferred per D-04 and blocked upstream on @napplet/core.

## Next Phase Readiness

**v1.2 milestone is provably shippable.**

- All 26 v1.2 requirements are checked off in `.planning/REQUIREMENTS.md`.
- All four `@kehto/*` packages have changeset entries ready for `pnpm changeset version` on the next release cadence.
- Full validation gate is green (build + type-check + test).
- `docs/v1.2-NIP-5D-AUDIT.md` shows Phase-12 drift rows resolved end-to-end; only the two Phase-14 DRIFT-CORE-01/-02 rows remain, and both are explicitly resolved by Phase 14 Plan 14-01 (see phase 14 SUMMARY.md).

**Deferred (non-blocking for v1.2 shippability):**
- `pnpm changeset version` → bumps 0.1.0 → 0.2.0 across all 4 packages and writes CHANGELOG.md entries from the 4 staged changesets. Run at the start of the release step, not this phase.
- `pnpm changeset publish` → blocked upstream until `@napplet/core` publishes to npm. When upstream ships, run this to push `@kehto/*` to the registry.
- `packages/runtime/src/core-compat.ts` (DRIFT-CORE-06) removal → parked until `@napplet/core` restores its legacy exports OR all consumers migrate off them; the shim is safe and narrow.

---
*Phase: 15-milestone-validation-release-prep*
*Completed: 2026-04-17*

## Self-Check: PASSED

- `.changeset/v1-2-acl.md` — FOUND
- `.changeset/v1-2-runtime.md` — FOUND
- `.changeset/v1-2-shell.md` — FOUND
- `.changeset/v1-2-services.md` — FOUND
- `.planning/REQUIREMENTS.md` (DEPS-02/03 flipped [x]) — FOUND
- `tests/unit/shell-runtime-integration.test.ts` — DELETED (confirmed absent on disk)
- Commit 226cdca (Task 1 — 4 changesets) — FOUND in git log
- Commit e61d0b2 (Task 2 — legacy test deletion) — FOUND in git log
- `.planning/phases/15-milestone-validation-release-prep/15-01-SUMMARY.md` — FOUND
