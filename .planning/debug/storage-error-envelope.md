---
slug: storage-error-envelope
status: resolved
trigger: "GitHub issue #14 — storage NUB error responses use non-canonical `storage.*.error` envelope — conformant napplets hang until timeout"
created: 2026-06-04
updated: 2026-06-04
---

# Debug: Storage NUB Non-Canonical Error Envelope (issue #14)

## Symptoms

**Expected:** Storage failures returned as `{ type: 'storage.<action>.result', id, error }` — the canonical `@napplet/nub/storage` `*.result` envelope with an optional `error?` field, which conformant shims handle (they reject the pending promise when `msg.error` is set).

**Actual:** `@kehto/runtime` `handleStorageNub` returned failures as `{ type: 'storage.<action>.error', id, error }`. The canonical protocol defines no `*.error` type, so conformant shims (which only listen for `*.result`) silently dropped the message and the napplet's pending promise never settled — it hit the shim's 5s timeout surfacing as `Error: State request timed out`.

**Error messages:** `Error: State request timed out` (masking the real cause: `not registered`, `missing key`, `quota exceeded`, `unknown action`).

**Timeline:** Present in `@kehto/runtime@0.2.0`.

**Reproduction:** Trigger any storage error path (e.g. `storage.set` exceeding quota) from a conformant `@napplet/sdk` shim; observe the request times out rather than rejecting with the real error.

## Current Focus

hypothesis: CONFIRMED (validated against live source). `state-handler.ts:90-92` `sendErrorNub()` emits `${msg.type}.error`. The canonical `@napplet/nub/storage` union has only `*.result` messages, each with an optional `error?` field — no `*.error` type exists. Conformant shims drop `storage.*.error`.
test: Change `sendErrorNub` to emit `${msg.type}.result` with the `error` field set. Update `state-handler.test.ts` assertions (currently encode the buggy `.error` envelope) to expect `.result` envelopes carrying `error`. Clean break — no backwards compat for `.error`.
expecting: All storage error paths deliver `storage.<action>.result` with a populated `error` field; conformant shims reject the pending promise with the real cause instead of timing out.
next_action: COMPLETE — fix applied and verified.

## Evidence

- timestamp: 2026-06-04
  finding: `packages/runtime/src/state-handler.ts:90-92` — `sendErrorNub(error)` calls `sendToNapplet(windowId, { type: \`${msg.type}.error\`, id, error })`. Used for `not registered` (L96), `missing key` (L105/122/137), `quota exceeded` (L128), `clear not supported` (L151), `unknown action` (L164).
  confirms: All in-scope storage error paths emit the non-canonical `*.error` type.
- timestamp: 2026-06-04
  finding: `state-handler.test.ts:171-242` assert `storage.set.error`, `storage.clear.error`, `storage.bogus.error` envelopes (e.g. `lastOfType(tiny, 'storage.set.error')`). These tests encode the buggy behavior and must be updated to assert `.result` + `error`.
  confirms: Test suite currently locks in the non-canonical envelope; clean break requires updating it.
- timestamp: 2026-06-04
  finding: Doc comment at `state-handler.ts:50-53` already states results "emit … an `error` field on failure" — `sendErrorNub` contradicts the module's own contract.
  confirms: The canonical shape is `*.result` with `error?`; the `.error` emission is the defect.
- timestamp: 2026-06-04
  finding: `dispatch.test.ts:505-538` also asserted `storage.clear.error` and `storage.get.error` (unregistered-window path). Both are in-scope and updated to `.result` + `error`.
  confirms: All in-scope `.error` assertions eliminated.
- timestamp: 2026-06-04
  finding: ACL-denial path in `state-handler.test.ts:248-281` and `dispatch.test.ts` ACL enforcement block emit `storage.get.error` via the ACL/dispatch layer (not `handleStorageNub`). This is OUT OF SCOPE for issue #14 but is the same class of spec violation — the ACL layer's `*.error` envelope is also non-canonical. Flagged for orchestrator follow-up as a separate issue.
  confirms: Issue #14 scope boundary respected; ACL-denial tests left untouched.

## Eliminated

(pending — root cause confirmed by source inspection before session start)

## Resolution

root_cause: `sendErrorNub()` in `packages/runtime/src/state-handler.ts` emitted `{ type: \`${msg.type}.error\` }` envelopes for all storage error paths; the canonical `@napplet/nub/storage` protocol defines only `*.result` types (with an optional `error?` field), so conformant shims dropped the non-canonical messages and napplet promises timed out.

fix: Changed `sendErrorNub` (line 91) to emit `{ type: \`${msg.type}.result\`, id, error }` — a canonical `.result` envelope carrying the `error` field — instead of the non-canonical `.error` type. Updated test assertions in `state-handler.test.ts` (tests 3b, 6, 7) and `dispatch.test.ts` (storage.clear rejection and unregistered-window tests) to expect `.result` + `error`. Clean break: no backwards-compat shim for `.error`. ACL-denial tests (emitting `storage.get.error` from the dispatch layer) are out of scope and left unchanged.

verification: `pnpm exec vitest run packages/runtime/src/` — 105 tests, 6 test files, all pass. `pnpm --filter @kehto/runtime type-check` — clean.

files_changed:
  - packages/runtime/src/state-handler.ts (line 91: sendErrorNub emits .result instead of .error; JSDoc updated)
  - packages/runtime/src/state-handler.test.ts (tests 3b, 6, 7 updated to assert .result + error field)
  - packages/runtime/src/dispatch.test.ts (storage.clear rejection test and unregistered-window test updated)

followup: ACL-denial path in runtime dispatch emits `storage.*.error` (non-canonical for same reason). Out of scope for #14 — recommend a follow-up issue targeting the ACL/dispatch error-envelope layer.
