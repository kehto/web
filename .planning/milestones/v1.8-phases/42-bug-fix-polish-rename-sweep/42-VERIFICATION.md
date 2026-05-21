---
phase: 42-bug-fix-polish-rename-sweep
verified_at: 2026-05-20
status: passed
score: 5/5
---

# Phase 42: Bug Fix + Polish + Rename Sweep — Verification Report

**Verified:** 2026-05-20
**Verifier:** Claude (gsd-verifier)
**Re-verification:** No — initial verification

## Goal Restatement

Clear five small, mutually-independent v1.7 carryover items (BUG-01, BUG-02, POLISH-01, RENAME-01, RENAME-02) so v1.8 opens on a clean tree with topology connector lines rendering correctly in `pnpm preview` from the first commit. Five concrete success criteria from ROADMAP Phase 42 (vendored leader-line + new E2E regression spec, port label fix, two API renames with consumer-facing changesets, canonical iteration loop closing at 73/0/0).

## Per-Criterion Verdicts

### SC-1: BUG-01 + BUG-02 — Vendored leader-line + topology regression spec — PASS

**Evidence:**
- `apps/playground/index.html:462` → `<script src="/vendor/leader-line.min.js"></script>` (single match; UMD reference intact from commit `4f02c1e`).
- `apps/playground/public/vendor/leader-line.min.js` → present, 100176 bytes (matches expected payload size).
- `tests/e2e/topology-lines.spec.ts` → exists; uses `test.use({ baseURL: 'http://localhost:4174' })` against built preview; asserts `window.LeaderLine !== undefined` (UMD loaded) via `expect.poll`; asserts `document.querySelectorAll('svg.leader-line').length ≥ 1` via `expect.poll`. Loose count assertion (`toBeGreaterThanOrEqual(1)`) survives napplet-count growth in later v1.8 phases.
- Commit `ff4009f` — `feat(42-01): add topology-lines.spec.ts regression spec for BUG-02`.
- Evidence-already-gathered: `pnpm test:e2e` reported 73 passed (29.1s) — includes new topology-lines spec.

### SC-2: POLISH-01 — Resource-demo port label `:5174` → `:4174` — PASS

**Evidence:**
- `apps/playground/napplets/resource-demo/index.html:61` → `<h2>granted fetch (localhost:4174)</h2>` (verified by reading file).
- `grep -n "5174" apps/playground/napplets/resource-demo/index.html` → 0 matches (stale reference fully gone).
- Commit `002598f` — `fix(42-02): correct resource-demo h2 port label :5174 → :4174 (POLISH-01)`.
- Changeset `.changeset/v1-8-resource-demo-port-label.md` present.

### SC-3: RENAME-01 — SessionEntry.identitySource → provenance — PASS

**Evidence:**
- `packages/shell/src/types.ts:61` → `provenance: 'nip-5d' | 'legacy-auth';` (canonical SessionEntry definition).
- `packages/runtime/src/types.ts:464` → identical `provenance: 'nip-5d' | 'legacy-auth';` (runtime's duplicate SessionEntry, caught during execution).
- Both files carry JSDoc pointer to changeset (`Renamed from identitySource: 'auth' | 'source' in v1.8; see .changeset/v1-8-rename-01-session-provenance.md`).
- `grep -rn "identitySource" packages/ apps/ tests/ --include="*.ts" --include="*.tsx"` (excluding dist/) → **0 matches** (zero-reference acceptance criterion honored across entire source surface).
- Changeset `.changeset/v1-8-rename-01-session-provenance.md` — `@kehto/shell: minor` + `@kehto/runtime: minor`, contains explicit migration prose with old→new mapping (`'source'` → `'nip-5d'`, `'auth'` → `'legacy-auth'`) and notes hard-rename intent.
- Commit `597dbdb` — `refactor(42-03): rename SessionEntry.identitySource → provenance (RENAME-01)`.

### SC-4: RENAME-02 — bridge.injectEvent identity topic soft-rename — PASS

**Evidence:**
- `packages/shell/src/shell-bridge.ts:270-273` → dual-emit branch present with `OLD_IDENTITY_TOPIC = 'auth:identity-changed'`, `NEW_IDENTITY_TOPIC = 'identity:changed'`, and `remove this branch in v1.9` beacon comment for future deletion sweep.
- JSDoc (lines 76-90) documents soft-rename window, `@deprecated` legacy topic, canonical new topic, migration window pointer.
- Changeset `.changeset/v1-8-rename-02-identity-changed-topic.md` — `@kehto/shell: minor`, documents soft-rename with dual-emit, OLD-then-NEW emit order, hard-removal scheduled for v1.9, deletion grep beacon hint.
- Evidence-already-gathered: `pnpm test:unit` reported 523/523 passing (up from 520) — +3 new dual-emit assertions in `shell-bridge.test.ts`.
- Commit `e3cc899` — `feat(42-04): soft-rename bridge.injectEvent identity topic with dual-emit (RENAME-02)`.

### SC-5: Canonical iteration loop closes at 73/0/0 — PASS

**Evidence (from <evidence_already_gathered>):**
- `pnpm build` → 26/26 tasks (20 cached).
- `pnpm test:e2e` → 73 passed (29.1s). Baseline of 72 + 1 new topology-lines spec = 73.
- `pnpm test:unit` → 523/523 across 31 files (520 baseline + 3 new dual-emit tests).
- `pnpm --filter @kehto/shell type-check` → exit 0.
- `pnpm --filter @kehto/runtime type-check` → exit 0.

## Must-Haves Audit (5 REQ-IDs)

| REQ-ID | Source Plan | Description | Status | Evidence |
|--------|------------|-------------|--------|----------|
| BUG-01 | 42-01 | Vendored `/vendor/leader-line.min.js` in `apps/playground/index.html` | VERIFIED | `index.html:462` + 100176-byte vendor asset; pre-kickoff commit `4f02c1e` |
| BUG-02 | 42-01 | Playwright regression spec against built preview | VERIFIED | `tests/e2e/topology-lines.spec.ts` exists; spec passes (E2E 73/0/0); commit `ff4009f` |
| POLISH-01 | 42-02 | `:4174` label in resource-demo h2 | VERIFIED | `index.html:61` reads `:4174`; zero `:5174` matches; commit `002598f` |
| RENAME-01 | 42-03 | SessionEntry discriminant renamed with changeset migration note | VERIFIED | shell+runtime `provenance` field; zero `identitySource` source refs; changeset present; commit `597dbdb` |
| RENAME-02 | 42-04 | `bridge.injectEvent` topic renamed with changeset migration note | VERIFIED | Dual-emit branch with v1.9 removal beacon; changeset present; commit `e3cc899` |

All 5 requirement checkboxes in `.planning/REQUIREMENTS.md` flipped to `[x]`; traceability table rows all read `Complete`; footer updated to `5/27 requirements complete`.

## Spot-Checks Summary

| Check | Result | Source |
|-------|--------|--------|
| `pnpm build` exit | 26/26 tasks (20 cached), success | evidence-already-gathered |
| `pnpm test:e2e` count | 73 passed (was 72 baseline + 1 new spec) | evidence-already-gathered |
| `pnpm test:unit` count | 523/523 (was 520 + 3 new dual-emit tests) | evidence-already-gathered |
| `pnpm --filter @kehto/shell type-check` | exit 0 | evidence-already-gathered |
| `pnpm --filter @kehto/runtime type-check` | exit 0 | evidence-already-gathered |
| `grep -rn identitySource packages/ apps/ tests/ --include=*.ts --include=*.tsx` (excluding dist) | 0 matches | this verification |
| `grep "remove this branch in v1.9" packages/shell/src/shell-bridge.ts` | 1 match (v1.9 deletion beacon) | this verification |
| `grep "5174" apps/playground/napplets/resource-demo/index.html` | 0 matches (stale port gone) | this verification |
| All 4 changesets present | `.changeset/v1-8-{topology-lines-spec,resource-demo-port-label,rename-01-session-provenance,rename-02-identity-changed-topic}.md` | this verification |

## Data-Flow Trace (Level 4)

N/A for this phase — Phase 42 is plumbing (bug fix in vendored asset path, cosmetic label fix, two type/topic renames, one E2E spec addition). No dynamic data-rendering artifacts introduced. Data-flow correctness for the renamed fields is exercised by:
- `pnpm test:unit` 523/523 (RENAME-01 consumers and RENAME-02 dual-emit branch).
- `pnpm test:e2e` 73/0/0 (RENAME-01 producers in `harness.ts:218` and `shell-host.ts:1246`; topology rendering via `topology-lines.spec.ts`).

## Anti-Pattern Check

| Pattern | Result | Notes |
|---------|--------|-------|
| Skipped/disabled tests | None | E2E count 73 = baseline 72 + 1 new; unit count 523 = baseline 520 + 3 new. No subtractions. |
| Silent try/catch added | None | Plan 42-01 SUMMARY explicitly states existing `topology.ts:235-253` silent try/catch deliberately NOT modified (protects against future UMD-missing regressions per CONTEXT). |
| TODO/FIXME/XXX in modified files | Not introduced | The "remove this branch in v1.9" beacon in `shell-bridge.ts` is an intentional, documented v1.9 deletion sweep marker tied to PROJECT.md Known Tech Debt — this is a scheduled-cleanup beacon, not unreferenced debt. |
| Stub returns / hardcoded empties | N/A | No new dynamic data-rendering surfaces introduced. |
| Hard-rename consistency | Verified | Zero `identitySource` references in source (excluding `.changeset/` migration prose, `.planning/`, `dist/`, `node_modules/`). |
| Soft-rename completeness | Verified | RENAME-02 dual-emit branch covers both topic inputs with fixed OLD-then-NEW emit order; 3 unit tests cover both inputs + unrelated-topic forward path. |
| Changesets present and document migration | Verified | All 4 changesets contain proper frontmatter (`@kehto/shell: minor`, `@kehto/runtime: minor`, `@kehto/playground: patch`) and explicit migration prose for the two renames. |

## Final Verdict

**PASSED — 5/5 success criteria verified.**

All 5 plans landed in expected commits (`ff4009f` → `002598f` → `597dbdb` → `e3cc899` → `c5053c0`), all 5 REQ-IDs flipped to `[x]` in REQUIREMENTS.md, all 4 changesets present with proper migration prose for the renames, hard-rename achieves zero-reference acceptance across the entire source surface, soft-rename includes correctly-ordered dual-emit with a v1.9 deletion beacon, and the canonical iteration loop closes at 73/0/0 (E2E) + 523/523 (unit). The asymmetric handling of RENAME-01 (hard) vs RENAME-02 (soft) is intentional per CONTEXT-locked decisions and is documented in both SUMMARY files and both changesets.

**Recommendation:** Ready to proceed to Phase 43 (Nyquist Retroactive Validation).

---

_Verified: 2026-05-20_
_Verifier: Claude (gsd-verifier)_
