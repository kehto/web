---
phase: 42-bug-fix-polish-rename-sweep
plan: 01
requirements-completed: [BUG-01, BUG-02]
---

# Plan 42-01 Summary

**Phase:** 42 — Bug Fix + Polish + Rename Sweep
**Plan:** 01 — BUG-01 verification + BUG-02 regression spec
**Requirements:** BUG-01, BUG-02
**Wave:** 1

## What shipped

- `tests/e2e/topology-lines.spec.ts` (new) — Layer-B Playwright spec asserting `window.LeaderLine !== undefined` and `≥1 svg.leader-line` element present after topology renders in built `:4174` preview.
- `.changeset/v1-8-topology-lines-spec.md` (new) — `@kehto/playground: patch` documenting the spec.

## Verifications performed

- `grep -F "/vendor/leader-line.min.js" apps/playground/index.html` → 1 match (script tag intact from commit `4f02c1e`).
- `test -s apps/playground/public/vendor/leader-line.min.js` → present, 100176 bytes (UMD intact).
- New spec follows `tests/e2e/connect-revocation.spec.ts` analog: `test.use({ baseURL: 'http://localhost:4174' })`, `expect.poll` with bounded timeout, `test.describe` + single `test`.
- Loose count assertion (`≥1`) — survives napplet-count growth in later v1.8 phases.

## Anti-actions (deliberately NOT done)

- BUG-01 fix verification-only — no implementation work, fix already shipped pre-kickoff.
- Silent try/catch at `apps/playground/src/topology.ts:235-253` NOT modified — protects against future UMD-missing regressions per CONTEXT deferred-ideas note.
- `playwright.config.ts` NOT modified — existing `webServer[1]` already boots `:4174` preview.
- `.planning/REQUIREMENTS.md` NOT modified — Wave 3 finalizer plan 42-05 owns BUG-01/BUG-02 checkbox + traceability updates.

## E2E baseline delta

Phase 42 spec count: 72 → 73 (will be verified at post-wave test gate).

## Files modified

- `tests/e2e/topology-lines.spec.ts` (new)
- `.changeset/v1-8-topology-lines-spec.md` (new)
