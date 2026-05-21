---
phase: 42-bug-fix-polish-rename-sweep
plan: 04
requirements-completed: [RENAME-02]
---

# Plan 42-04 Summary

**Phase:** 42 — Bug Fix + Polish + Rename Sweep
**Plan:** 04 — RENAME-02 soft-rename `bridge.injectEvent` identity topic
**Requirements:** RENAME-02
**Wave:** 2 (depends on Plan 42-03)

## What shipped

- `packages/shell/src/shell-bridge.ts` (lines 71-95 + 260-271):
  - JSDoc on `ShellBridge.injectEvent` rewritten with soft-rename note, `@deprecated` legacy topic, canonical new topic, migration window pointer to v1.9.
  - Factory impl extended from 1-line forward to 9-line dual-emit branch. When topic matches `'auth:identity-changed'` OR `'identity:changed'`, emits BOTH topics to `runtime.injectEvent` (OLD first, NEW second, fixed order regardless of input). All other topics forward unchanged.
  - Inline `RENAME-02 (v1.8 Phase 42)` + `remove this branch in v1.9` beacon comment — grep target for v1.9 deletion sweep.
- `packages/shell/src/shell-bridge.test.ts` — new top-level describe block `ShellBridge.injectEvent dual-emit (RENAME-02)` with 3 unit tests:
  - `dual-emits when called with the deprecated 'auth:identity-changed' topic` → asserts spy.mock.calls equals `[['auth:identity-changed', payload], ['identity:changed', payload]]`.
  - `dual-emits when called with the canonical 'identity:changed' topic` → same 2-call assertion (proves order is independent of input).
  - `forwards unrelated topics unchanged with no dual-emit` → asserts spy.mock.calls equals `[['test:topic', payload]]`.
- `.changeset/v1-8-rename-02-identity-changed-topic.md` (new) — `@kehto/shell: minor` (additive — new topic recognized, old still works) with migration prose + v1.9 removal date + beacon grep hint.
- `.planning/PROJECT.md` — Known Tech Debt section gained a RENAME-02 entry pointing at the v1.9 removal beacon and the Plan 42-04 reference.

## Verifications performed

- `pnpm --filter @kehto/shell type-check` → exit 0.
- `pnpm test:unit` → 523/523 passing (was 520; +3 from new dual-emit tests).
- `grep -F "remove this branch in v1.9" packages/shell/src/shell-bridge.ts` → 1 match (v1.9 removal beacon present).
- `grep -F "RENAME-02 (v1.8 Phase 42)" packages/shell/src/shell-bridge.ts` → 2 matches (JSDoc + inline comment).

## Asymmetry note vs RENAME-01

RENAME-01 (Plan 42-03) was **hard-rename** — `SessionEntry.identitySource` was internal-leaning; no soft-deprecation window. RENAME-02 (this plan) is **soft-rename with dual-emit** — `bridge.injectEvent` has live external subscribers (hyprgate and other host shells); a one-release dual-emit window protects them from breaking on the v1.8 upgrade. Per CONTEXT-locked decisions; the asymmetry is intentional.

## v1.9 deletion beacons (grep targets)

- `remove this branch in v1.9` — singular comment above the dual-emit branch in `packages/shell/src/shell-bridge.ts`.
- `RENAME-02 (v1.8 Phase 42)` — JSDoc + inline comment.
- PROJECT.md Known Tech Debt entry mentioning both above.

## Files modified

- `packages/shell/src/shell-bridge.ts` (interface JSDoc + factory impl)
- `packages/shell/src/shell-bridge.test.ts` (new top-level describe + 3 tests)
- `.planning/PROJECT.md` (new Known Tech Debt entry)
- `.changeset/v1-8-rename-02-identity-changed-topic.md` (new)
