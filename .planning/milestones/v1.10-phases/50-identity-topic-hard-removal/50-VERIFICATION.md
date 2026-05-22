---
phase: 50-identity-topic-hard-removal
verified_at: 2026-05-22T12:54:00+02:00
status: passed
score: 2/2
---

# Phase 50 — Identity Topic Hard Removal — Verification

## Goal Restatement

Remove the one-release identity-topic compatibility branch so canonical `identity:changed` injection emits once and deprecated `auth:identity-changed` receives no special fan-out handling.

## Per-Criterion Verdicts

### RENAME-HARD-01: Canonical identity topic emits once

**Verdict:** PASS

**Evidence:** `packages/shell/src/shell-bridge.ts` now calls `runtime.injectEvent(topic, payload)` unconditionally. The focused unit test `forwards the canonical 'identity:changed' topic exactly once` asserts the runtime spy receives only `['identity:changed', payload]`.

### RENAME-HARD-02: Deprecated topic has no compatibility branch

**Verdict:** PASS

**Evidence:** The dual-topic constants and branch were removed from `ShellBridge.injectEvent()`. The focused unit test `forwards the deprecated 'auth:identity-changed' topic literally with no fan-out` asserts only `['auth:identity-changed', payload]` is emitted. The removal beacon grep for `remove this branch in v1.9` returns no active source matches.

## Success Criteria

- `ShellBridge.injectEvent()` no longer contains `OLD_IDENTITY_TOPIC`, `NEW_IDENTITY_TOPIC`, or the v1.9 removal beacon.
- Canonical `identity:changed` injection sends exactly one runtime event.
- Deprecated `auth:identity-changed` input emits only its supplied literal topic.
- Tests, source docs, runtime spec, generated API output, and v1.10 changeset prose describe the current canonical behavior.

## Validation Commands

- `pnpm exec vitest run packages/shell/src/shell-bridge.test.ts` -> exit 0; 6 tests passed.
- `pnpm --filter @kehto/shell type-check` -> exit 0.
- `pnpm docs:api` -> exit 0; existing TypeDoc warnings only.

## Final Verdict

**VERIFICATION PASSED** (2/2). Phase 50 is complete. Phase 51 is next.
