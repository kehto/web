---
phase: 42-bug-fix-polish-rename-sweep
plan: 03
requirements-completed: [RENAME-01]
---

# Plan 42-03 Summary

**Phase:** 42 — Bug Fix + Polish + Rename Sweep
**Plan:** 03 — RENAME-01 hard-rename SessionEntry.identitySource → provenance
**Requirements:** RENAME-01
**Wave:** 1

## What shipped

Renamed across **both** SessionEntry interfaces (shell + runtime — plan-checker missed runtime's duplicate):

- `packages/shell/src/types.ts` — field `identitySource: 'auth' | 'source'` → `provenance: 'nip-5d' | 'legacy-auth'`; JSDoc rewritten with RENAME-01 / v1.8 Phase 42 pointer; @example block updated.
- `packages/runtime/src/types.ts` — same field/JSDoc rename (line 444 SessionEntry duplicate identified during execution).
- `packages/shell/src/keys-forwarder.test.ts:28` — `identitySource: 'source'` → `provenance: 'nip-5d'`.
- `packages/shell/src/shell-bridge.test.ts:95` — same.
- `packages/runtime/src/test-utils.ts:256` — same.
- `packages/runtime/src/types.test.ts` — full rewrite: parameterized `describe('SessionEntry.provenance')`, every literal flipped (`'source' → 'nip-5d'`, `'auth' → 'legacy-auth'`), file-level JSDoc, test names, accessors.
- `apps/playground/src/shell-host.ts:1246` — production playground (caught during execution sweep — not in plan's files_modified).
- `tests/e2e/harness/harness.ts:218` — E2E harness (caught during execution sweep).
- `.changeset/v1-8-rename-01-session-provenance.md` (new) — `@kehto/shell: minor` + `@kehto/runtime: minor` with migration prose.

## Plan-checker gaps caught at execution time

Two consumers were missed by both the planner and plan-checker:
1. `packages/runtime/src/types.ts` has its OWN `SessionEntry` interface (lines 438-473), duplicating shell's. Both renamed in lockstep.
2. `apps/playground/src/shell-host.ts:1246` and `tests/e2e/harness/harness.ts:218` produced `identitySource: 'source'` literals at runtime.

Net effect: same atomic hard-rename, broader file reach than the plan declared. RENAME-01 acceptance criterion ("zero `identitySource` references remaining") was honored across the **entire monorepo source surface**, not just the 5 files in the original plan.

## Verifications performed

- `grep -rF "identitySource" --include="*.ts" --include="*.tsx" packages/ apps/ tests/` (excluding dist) → 0 matches.
- `pnpm --filter @kehto/runtime build` → `ESM Build success in 16ms; DTS Build success in 450ms`.
- `pnpm --filter @kehto/shell type-check` → exit 0.
- `pnpm --filter @kehto/runtime type-check` → exit 0.
- `pnpm test:unit` (vitest) → 520/520 tests passing across 31 test files.

## Variant mapping applied

- `'source'` (NIP-5D originRegistry) → `'nip-5d'`
- `'auth'` (legacy AUTH handshake) → `'legacy-auth'`

## Anti-actions

- No dual-field / deprecated alias / soft-rename shim — hard-rename per CONTEXT decision.
- `packages/shell/dist/` and `packages/runtime/dist/` regenerated via `tsup` build, not hand-edited.
- `.planning/REQUIREMENTS.md` NOT modified — Wave 3 finalizer plan 42-05 owns the checkbox + traceability update.

## Asymmetry note for Plan 42-04

RENAME-01 (this plan) is **hard-rename** — the type discriminant is internal-leaning, no soft-deprecation window. RENAME-02 (Plan 42-04, in Wave 2) is **soft-rename with dual-emit** — the `bridge.injectEvent` topic has external consumers and gets a one-release dual-emit window. The asymmetry is intentional per CONTEXT-locked decisions.

## Files modified

| File | Action |
|------|--------|
| `packages/shell/src/types.ts` | rename + JSDoc rewrite |
| `packages/runtime/src/types.ts` | rename + JSDoc rewrite (duplicate SessionEntry) |
| `packages/shell/src/keys-forwarder.test.ts` | literal rename |
| `packages/shell/src/shell-bridge.test.ts` | literal rename (line 95 only) |
| `packages/runtime/src/test-utils.ts` | literal rename (factory default) |
| `packages/runtime/src/types.test.ts` | full rewrite — parameterized tests, file JSDoc, test names |
| `apps/playground/src/shell-host.ts` | literal rename (registry seed) |
| `tests/e2e/harness/harness.ts` | literal rename (registry seed) |
| `.changeset/v1-8-rename-01-session-provenance.md` | new — `@kehto/shell: minor` + `@kehto/runtime: minor` |
