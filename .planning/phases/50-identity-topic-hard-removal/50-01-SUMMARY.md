---
phase: 50-identity-topic-hard-removal
plan: 01
status: completed
completed_at: 2026-05-22T12:54:00+02:00
requirements_completed:
  - RENAME-HARD-01
  - RENAME-HARD-02
---

# Phase 50 — Plan 01 Summary

## Result

Phase 50 hard-removed the identity-topic soft-rename branch from `ShellBridge.injectEvent()`. The bridge now forwards every supplied topic exactly once, including canonical `identity:changed` and deprecated literal `auth:identity-changed`.

## Changes Made

- Rewrote `ShellBridge.injectEvent()` JSDoc to describe the v1.10 single-topic behavior and canonical `identity:changed` topic.
- Deleted the `OLD_IDENTITY_TOPIC` / `NEW_IDENTITY_TOPIC` dual-emit branch from `packages/shell/src/shell-bridge.ts`.
- Replaced the shell bridge dual-emit unit tests with single-forwarding assertions:
  - `identity:changed` emits only `identity:changed`.
  - `auth:identity-changed` emits only that literal deprecated topic and no longer fans out.
  - Unrelated topics still forward unchanged.
- Updated `RUNTIME-SPEC.md` to list `identity:changed` as the shell-originated identity-change event.
- Added `.changeset/v1-10-identity-topic-hard-removal.md` documenting the closed compatibility window.
- Regenerated API docs with `pnpm docs:api` and verified the generated `ShellBridge` page now shows `identity:changed` in the example. `docs/api/` is gitignored, so the tracked source of truth is the updated JSDoc.

## Verification Evidence

- `pnpm exec vitest run packages/shell/src/shell-bridge.test.ts` -> exit 0; 1 file passed, 6 tests passed.
- `pnpm --filter @kehto/shell type-check` -> exit 0.
- `pnpm docs:api` -> exit 0; TypeDoc generated `docs/api` with the repo's existing documentation warnings.
- `rg "remove this branch in v1\\.9" packages/shell/src/shell-bridge.ts packages/shell/src/shell-bridge.test.ts RUNTIME-SPEC.md .changeset/v1-10-identity-topic-hard-removal.md` -> no matches.
- Targeted doc grep confirmed `docs/api/interfaces/_kehto_shell.ShellBridge.html` uses the canonical `identity:changed` example after regeneration.

## Requirement Status

- RENAME-HARD-01: complete
- RENAME-HARD-02: complete

## Notes

Historical v1.8 changeset/archive prose still mentions the old soft-rename window as history. Phase 50 changed active source, current runtime spec, generated API output, and v1.10 release-note prose.
