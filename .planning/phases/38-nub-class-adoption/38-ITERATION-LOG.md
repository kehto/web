# Phase 38 Iteration Log — NUB-CLASS Adoption

**Phase:** 38-nub-class-adoption
**Baseline entering phase (v1.7 Phase 37 close):** 54 passed / 0 failed / 0 skipped
**Target at phase close (Plan 38-03):** 62 passed / 0 failed / 0 skipped (54 prior + 8 new class-invariant cases)

----

## Plan 38-01 — Incremental Type + Session Foundation

**Date:** 2026-04-24
**Scope:** CLASS-01, CLASS-02, CLASS-06 (types + session-entry wiring + breaking changeset)
**Gate:** `pnpm type-check` + `pnpm build` clean. NOT a full E2E run — Plan 38-01 is type-surface only; Plan 38-03 runs the full iteration loop.

### pnpm type-check

```
 Tasks:    10 successful, 10 total
Cached:    9 cached, 10 total
  Time:    833ms
```

### pnpm build

```
 Tasks:    24 successful, 24 total
Cached:    24 cached, 24 total
  Time:    44ms >>> FULL TURBO
```

### Grep self-check

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "class: NappletClass" packages/shell/src/types.ts` | >= 1 (onNip5dIframeCreate + SessionEntry) | 2 |
| `grep -c "class: NappletClass" packages/runtime/src/types.ts` | 1 (SessionEntry field) | 1 |
| `grep -c "export type NappletClass" packages/runtime/src/types.ts` | 1 (inline alias) | 1 |
| `grep -c "class: resolvedClass" packages/shell/src/shell-bridge.ts` | 1 (shell.init inline) | 1 |
| `grep -c "class: null" apps/demo/src/shell-host.ts` | >= 1 (registerSessionEntry) | 2 (comment + field) |
| `grep -rc "class\.assigned" packages/shell/src packages/runtime/src apps/demo/src` (non-zero) | all doc-comments only, no envelope impl | 2 occurrences in doc comments only (shell-bridge.ts C-01 prevention note + provisional-class.ts Phase 37 note) |

### Changeset

- File: `.changeset/class-01-breaking-hook.md`
- Bump: `@kehto/shell: minor`
- Reason: Breaking expansion of `onNip5dIframeCreate` return type (required `class: NappletClass`).

### Notes

- No runtime→shell import introduced (module boundary intact): `NappletClass` duplicated inline in `packages/runtime/src/types.ts`.
- No async class.assigned envelope (C-01 prevention): both `class.assigned` grep hits are doc comments explicitly documenting the anti-feature.
- Permissive default (class: null) for all 10 existing DEMO_NAPPLETS keeps Phase 37's 54/0/0 baseline intact — verified by `pnpm build` succeeding without UI or behavior changes.
- Additional SessionEntry literals fixed (deviation from plan's read_first list): `packages/runtime/src/test-utils.ts::createNip5dSessionEntry`, `packages/runtime/src/types.test.ts::makeEntry`, `packages/shell/src/keys-forwarder.test.ts::makeSessionEntry` — all updated with `class: null` to satisfy the required field. These were auto-discovered via type-check errors (Rule 1/3 auto-fix).
- Next plan (38-02): wire `enforce.ts` class pre-filter to read this session-entry class via `resolveIdentityByWindowId`.
