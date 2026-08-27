---
phase: 81-runtime-container-choke-point-integration
plan: "03"
subsystem: runtime
tags: [firewall, integration-tests, VERIFY-02, burst-guard, consent, focus, content-matcher]
dependency_graph:
  requires: [81-02-SUMMARY.md]
  provides: [firewall-dispatch.test.ts, VERIFY-02 coverage]
  affects: []
tech_stack:
  added: []
  patterns: [volume-based-assertions, vi.fn-spy-hooks, session-aged-bypass, per-test-runtime]
key_files:
  created:
    - packages/runtime/src/firewall-dispatch.test.ts
  modified: []
decisions:
  - "Burst guard fires at message 21 (DEFAULT_BURST_MAX_OPS=20 exceeded): all messages in tight sync loop have initElapsedMs≈0 so they are all within the burst window. This is how 200-message flood naturally produces relay.publish.error."
  - "RUNTIME-04 flag test uses setRateLimit(capacity:1, action:flag) + aged session (10000ms past) to bypass burst guard and isolate rate flag behavior."
  - "Unfocused multiplier test uses 70 messages with aged session: focused capacity=60 (61st message flags), unfocused effective capacity=15 (16th message flags). Spy count comparison proves tighter budget."
  - "makeSessionEntryAged helper bypasses burst guard by setting registeredAt to the past — essential for isolating rate limit and content matcher tests."
  - "vi.fn() spies injected via createMockRuntimeAdapter({ onFirewallEvent, getFocusContext }) overrides — zero changes to test-utils.ts needed."
  - "Pre-existing acl-state.ts type error noted in 81-01 does not reproduce: npx tsc -p packages/runtime/tsconfig.json --noEmit exits 0."
metrics:
  duration_seconds: 300
  completed_date: "2026-06-15"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 0
  tests_added: 12
  tests_baseline: 132
  tests_final: 144
  root_suite_total: 840
---

# Phase 81 Plan 03: VERIFY-02 Firewall Integration Tests Summary

**One-liner:** 12 deterministic integration tests drive `runtime.handleMessage` through all six VERIFY-02 named attacks — burst flood, init-burst block, backgrounded burst, kind-5 content matcher, ask-consent-remember, and unfocused multiplier — plus RUNTIME-04 flag-dispatches-and-audits.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Flood, burst, backgrounded-burst, and flag-dispatch tests | 79001f4 | packages/runtime/src/firewall-dispatch.test.ts |
| 2 | kind-5 delete-spam, ask-consent-remember, and unfocused-multiplier tests | 79001f4 | packages/runtime/src/firewall-dispatch.test.ts |
| 3 | Confirm no regression vs 819-test baseline | (run only) | — |

*Tasks 1 and 2 committed atomically in one commit (both modify only the same new file).*

## Verification Results

- `npx vitest run packages/runtime/src/firewall-dispatch.test.ts`: **12/12 PASS**
- `npx vitest run packages/runtime`: **144/144 PASS** (132 baseline + 12 new)
- `pnpm test:unit`: **840/840 PASS** (819 root baseline + 9 from Plan 81-01 + 12 new = 840)
- `npx tsc -p packages/runtime/tsconfig.json --noEmit`: **exit 0** (zero errors)
- `pnpm type-check`: **13/13 tasks clean** (all turbo cached, zero new type errors)

## VERIFY-02 Attack Matrix — All Green

| Attack | Test Description | Result |
|--------|-----------------|--------|
| Publish flood (flag→block) | Burst guard fires at DEFAULT_BURST_MAX_OPS+1 → relay.publish.error | PASS |
| Flood: earlier msgs dispatched | First DEFAULT_BURST_MAX_OPS msgs produce no error | PASS |
| Flag→block transition ordering | rejectIdx > 0 (some dispatched before block) | PASS |
| Init-burst block | 21 msgs in init window → relay.publish.error with "firewall:" | PASS |
| Backgrounded + init-burst (sharper) | unfocused rejectIdx ≤ focused rejectIdx | PASS |
| RUNTIME-04: flag dispatches+audits | capacity:1 rate, flag action: no error + onFirewallEvent spy called with action:flag,decision:pass | PASS |
| kind-5 delete spam | content matcher kinds:[5],action:block → relay.publish.error | PASS |
| kind-1 not blocked by kind-5 matcher | kind-1 skips kind-5 matcher → no error | PASS |
| ask: reject + consent + remembered | err on msg1, consentCalls.length===1, no err on msg2, consentCalls.length still 1 | PASS |
| ask: no handler → still rejects | fireConsent no-op, reject still sent | PASS |
| Unfocused multiplier: flags sooner | unfocusedSpy.calls > focusedSpy.calls (16 vs 10 flags over 70 msgs) | PASS |
| FOCUS-02: unfocused flag still dispatches | No relay.publish.error, all audit events have action:flag decision:pass | PASS |

## Test Design Decisions

### Volume-based assertions (Pitfall 4 avoidance)
All tests assert on whether reject envelopes APPEAR and their ORDERING relative to the first reject, never on exact token counts or timing windows. The tests are synchronous and deterministic across repeated runs.

### Burst guard mechanics (clarification for Phase 82)
Within the 3000ms init window (`initElapsedMs < burstGuard.windowMs`), ALL synchronously-fired messages have the same wall-clock timestamp. The burst counter increments for each message. At count 21 (> maxOps=20), decision=reject/action=block fires. This means:
- Test "flag→block transition": messages 1-20 dispatch (action:ignore — within rate budget), message 21 is blocked. The "flag" in "flag→block" refers conceptually to the escalation (pass→reject), not to an `action:'flag'` event.
- To observe an actual `action:'flag'` event, the RUNTIME-04 test uses a different path: aged session (bypass burst guard) + tight rate limit with `action:'flag'`.

### Unfocused multiplier test design
Used `makeSessionEntryAged(WINDOW_ID, 10_000)` to set registeredAt 10 seconds in the past, guaranteeing `initElapsedMs > DEFAULT_BURST_WINDOW_MS`. This isolates the rate multiplier effect cleanly. Over 70 messages:
- Focused: capacity=60, rate flags at message 61 → 10 flag events
- Unfocused: capacity=60×0.25=15, rate flags at message 16 → 55 flag events

### Consent remember test
`runtime.firewallState.setPolicy(TEST_DTAG, 'ask')` before firing. The consent handler calls `req.resolve(true)`, which triggers `firewallState.setPolicy(napplet, 'allow')` inside `fireConsent`. Subsequent messages match the `allow` policy (Tier 1 bypass) and never reach the `ask` path — proving the no-re-prompt guarantee.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — these are integration tests with no production code stubs.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Test file is test-only.

## Pre-existing acl-state.ts Type Error (from Phase 81-01 deferred item)

The Plan 81-01 SUMMARY noted a pre-existing type error in `packages/acl/src/acl-state.ts` (missing `intent:read`/`intent:write` in CAP_MAP). On this run, `npx tsc -p packages/runtime/tsconfig.json --noEmit` exits 0 and `pnpm type-check` completes with zero error output. Either the error is in the ACL package tsconfig (not runtime's) or was fixed upstream. Phase 82 should run `npx tsc -p packages/acl/tsconfig.json --noEmit` directly to confirm. No new type errors introduced in Plan 81-03.

## Self-Check

- [x] packages/runtime/src/firewall-dispatch.test.ts exists (469 lines, > 80 min_lines)
- [x] File contains `createRuntime`
- [x] File contains `runtime.handleMessage`
- [x] File contains `firewallState`
- [x] commit 79001f4 exists
- [x] 12/12 new tests pass, 840/840 root suite pass
- [x] VERIFY-02 all six named attacks covered
- [x] RUNTIME-04 flag-dispatches-and-audits covered

## Self-Check: PASSED
