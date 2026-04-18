---
phase: 21-fixture-napplets-layer-a-specs
plan: "04"
subsystem: e2e-specs
tags: [playwright, layer-a, stub-scope, keys, media, e2e-09]
dependency_graph:
  requires: [21-01, 21-02]
  provides: [nub-keys-layer-a-spec, nub-media-layer-a-spec]
  affects: [21-05]
tech_stack:
  added: []
  patterns: [stub-service-capture, __registerService__, __injectEnvelope__, STUB-SCOPE-NOTICE]
key_files:
  created:
    - tests/e2e/nub-keys.spec.ts
    - tests/e2e/nub-media.spec.ts
  modified: []
decisions:
  - "handler.descriptor required: runtime.registerService() accesses handler.descriptor.name at registration time (runtime.ts:1181) — handler objects passed to __registerService__ MUST include descriptor field"
  - "Possibility A verified for both domains: keys.registerAction emits keys.registerAction.result fallback (runtime.ts:982); media.session.create emits media.session.create.result fallback (runtime.ts:939)"
  - "__registerService__ capture chosen over runtime fallback for both: provides predictable assertion target + tests the service-routing path (runtime.ts:950/930 routes to registered service first)"
metrics:
  duration: 703s
  completed_date: "2026-04-18"
  tasks_completed: 1
  files_modified: 2
---

# Phase 21 Plan 04: Stub-Scope Layer-A Specs (nub-keys, nub-media) Summary

Two stub-scope Layer-A specs created for the keys and media NUB domains, each documenting stub scope explicitly and asserting the runtime's stub response shape via the `__registerService__` capture pattern.

## Objective Achieved

Created `tests/e2e/nub-keys.spec.ts` and `tests/e2e/nub-media.spec.ts` — E2E-09 Phase 21 stub-scope specs that:
- Document stub scope via mandatory STUB SCOPE NOTICE header (citing CONTEXT D-05 + v1.4 deferral)
- Use `__injectEnvelope__` to dispatch keys.registerAction / media.session.create envelopes
- Install stub services via `__registerService__` to capture messages and emit canonical result envelopes
- Assert envelope dispatch via `__getNubMessage__` (envelopeLog verification)
- Assert service capture via window-scoped globals (`window.__lastKeysReq`, `window.__lastMediaReq`)
- Both pass against built harness preview (2 passed / 3.2s)

## Runtime Behavior Verified

### keys.registerAction (runtime.ts:982) — POSSIBILITY A
The runtime emits a fallback `keys.registerAction.result` envelope when NO 'keys' service is registered. Fallback shape: `{ type: 'keys.registerAction.result', id, actionId: m.action?.id ?? '', binding?: m.action?.defaultKey }`.

When a 'keys' service IS registered (as our spec does), the runtime routes to the service first (runtime.ts:950-954) — our stub handler intercepts and captures the message.

### media.session.create (runtime.ts:939) — POSSIBILITY A
The runtime emits a fallback `media.session.create.result` envelope when NO 'media' service is registered. Fallback shape: `{ type: 'media.session.create.result', id, sessionId: m.sessionId ?? '' }` — note: sessionId is empty string when the request does not include a sessionId field.

When a 'media' service IS registered (as our spec does), the runtime routes to the service first (runtime.ts:930-934) — our stub handler intercepts and emits a predictable `sessionId: 'stub-session-spec'` for strong assertion.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Create nub-keys + nub-media stub specs | 0187f45 | tests/e2e/nub-keys.spec.ts, tests/e2e/nub-media.spec.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] handler.descriptor required by runtime.registerService()**
- **Found during:** Task 1 verification (first test run)
- **Issue:** The plan's example handler scripts used `{ name: 'keys', version: '1.0-stub', handleMessage: ... }` shape — but `runtime.registerService()` at line 1181 accesses `handler.descriptor.name`. Without `descriptor`, `registerService()` throws TypeError, caught by `__registerService__`'s try-catch, returning `false`.
- **Fix:** Added `descriptor: { name, version, description }` field to both handler objects. Also added `onWindowDestroyed: function() {}` for interface completeness.
- **Files modified:** tests/e2e/nub-keys.spec.ts, tests/e2e/nub-media.spec.ts
- **Commit:** 0187f45 (included in task commit)

**2. [Rule 2 - Missing] harness.ts session registration for NIP-5D napplets**
- **Found during:** Task 1 first test run (waitForNappletReady timeout)
- **Issue:** This was a pre-existing issue from Plan 21-03 work (harness.ts was already modified with the fix in the working tree but not committed). The harness needs `sessionRegistry.register()` for NIP-5D napplets since the old AUTH handshake no longer exists.
- **Status:** Already fixed in harness.ts (uncommitted Plan 21-03 work). NOT modified by Plan 21-04. Both specs rely on this fix being present.
- **Out-of-scope for Plan 21-04:** The harness.ts modification is Plan 21-03 work.

## Test Results

```
Running 2 tests using 2 workers

  ✓  1 [chromium] › tests/e2e/nub-keys.spec.ts:46:1 › nub-keys: keys.registerAction envelope dispatchable + runtime stub response captured (248ms)
  ✓  2 [chromium] › tests/e2e/nub-media.spec.ts:48:1 › nub-media: media.session.create envelope dispatchable + runtime stub response captured (257ms)

  2 passed (3.2s)
```

## Known Stubs

Both spec files ARE themselves stub-scope by design — that is the explicit intent of Plan 21-04 per CONTEXT D-05. These stubs are documented in the spec headers and deferred to v1.4 for graduation to fixture-backed specs when real backends ship.

No unintentional stubs were introduced.

## Layer-A Spec Count

After Plan 21-04: **8 Layer-A specs** total (6 active from Plan 21-03 + 2 stub from Plan 21-04), completing the E2E-09 Phase 21 Layer-A coverage requirement.

## Self-Check: PASSED

Files verified:
- FOUND: tests/e2e/nub-keys.spec.ts
- FOUND: tests/e2e/nub-media.spec.ts
- NOT FOUND: tests/fixtures/napplets/nub-keys (correct — must not exist)
- NOT FOUND: tests/fixtures/napplets/nub-media (correct — must not exist)
- Commit 0187f45 exists: CONFIRMED
