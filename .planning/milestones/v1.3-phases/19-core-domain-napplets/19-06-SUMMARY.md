---
phase: 19-core-domain-napplets
plan: "06"
subsystem: tests/e2e
tags: [e2e, acl, capability-matrix, playwright, demo, composer, preferences]
dependency_graph:
  requires: [19-04]
  provides: [E2E-08-acl-revoke-relay-write, E2E-08-acl-revoke-storage-write]
  affects: [19-07-iteration-loop]
tech_stack:
  added: []
  patterns:
    - Two-phase control+revoke assertion (Phase 1 success ground truth, Phase 2 denial)
    - Demo ACL panel UI click via button[title^="<cap>"] + data-enabled attribute assertion
    - frameLocator for in-iframe DOM sentinels (composer, preferences)
    - napplet-debugger toContainText for envelope type verification
key_files:
  created:
    - tests/e2e/acl-revoke-relay-write.spec.ts
    - tests/e2e/acl-revoke-storage-write.spec.ts
  modified: []
decisions:
  - "ACL panel button selector uses starts-with (title^=) not contains (title*=) to avoid matching superset cap names"
  - "Phase 1 control assertion for relay-write is permissive (accepts published: OR denied:) because demo stub relay pool may return no-pool message; Phase 1 for storage-write is strict (must be 'saved') because local storage always works"
  - "page.reload() mention in comments is documentation-only; no functional reload calls (Pitfall 5)"
  - "Other E2E-08 specs (acl-grant-revoke + acl-block-unblock) are NOT in scope for Phase 19 — already covered by harness-targeted acl-enforcement.spec.ts (Phase 16/17)"
metrics:
  duration: 95s
  completed_date: "2026-04-17"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 19 Plan 06: ACL Revoke Capability-Matrix Specs Summary

**One-liner:** Two E2E-08 Layer-B specs asserting relay:write and state:write denial paths via demo ACL panel UI clicks, with two-phase control+revoke assertion and envelope-level debugger verification.

## What Was Built

Created two new Playwright specs under `tests/e2e/` that close the E2E-08 capability-matrix requirements for ACL revocation on the composer and preferences napplets:

1. **`tests/e2e/acl-revoke-relay-write.spec.ts`** — Asserts that revoking `relay:write` on the composer napplet via the demo ACL panel causes the next publish to fail with `'denied:'` in `#composer-status` and `'relay.publish.error'` in the napplet-debugger.

2. **`tests/e2e/acl-revoke-storage-write.spec.ts`** — Asserts that revoking `state:write` on the preferences napplet via the demo ACL panel causes the next save to fail with `'denied:'` in `#preferences-status` and `'storage.set.error'` in the napplet-debugger.

## Key Patterns

### Selector Strategy
- ACL panel toggle buttons are selected via `button[title^="<cap>"]` (starts-with on the `title` attribute)
- This is more specific than `title*=` (contains) and avoids false matches on substring cap names
- The cap string (`relay:write`, `state:write`) is canonical from `@kehto/acl/types.ts` and won't drift

### Two-Phase Assertion
Both specs use the plan-specified two-phase approach:
- **Phase 1 (control):** Trigger the action before revocation to confirm the UI flow works end-to-end
  - relay-write: permissive match `/(published:|denied:)/` (stub relay may not return OK true)
  - storage-write: strict match `'saved'` (local storage always succeeds when granted)
- **Phase 2 (revoke + assert):** Click the ACL toggle, verify `data-enabled` flips to `'false'`, trigger action again, assert `'denied:'` in status and `.error` envelope in debugger

### Pitfall 5 Compliance
Neither spec calls `page.reload()`. The comment documenting the pitfall appears in the JSDoc header (documentation-only, not a functional call). `demoBeforeEach` uses `page.goto('/')` which is safe.

### Debugger Verification
Both specs assert the runtime emitted the canonical `.error` envelope type in the napplet-debugger:
- `'relay.publish.error'` — from `packages/runtime/src/runtime.ts` denial branch
- `'storage.set.error'` — from the same denial path for storage operations

## Scope Notes

These two specs close the **demo-UI-targeted** portion of E2E-08. The other E2E-08 specs (acl-grant-revoke + acl-block-unblock) are NOT in scope for Phase 19 — they are covered by the harness-targeted `tests/e2e/acl-enforcement.spec.ts` (Phase 16/17) which uses `__aclGrant__`/`__aclBlock__` globals that exist only in the harness at `:4173`, not the demo at `:4174`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | bfc30c2 | feat(19-06): add acl-revoke-relay-write spec (E2E-08 relay:write denial path) |
| 2 | aade385 | feat(19-06): add acl-revoke-storage-write spec (E2E-08 state:write denial path) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both specs are pure test files with no stub data sources.

## Self-Check: PASSED

- [x] `tests/e2e/acl-revoke-relay-write.spec.ts` exists
- [x] `tests/e2e/acl-revoke-storage-write.spec.ts` exists
- [x] Commit `bfc30c2` exists
- [x] Commit `aade385` exists
