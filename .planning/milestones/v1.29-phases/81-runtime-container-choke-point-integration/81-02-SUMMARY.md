---
phase: 81-runtime-container-choke-point-integration
plan: "02"
subsystem: runtime
tags: [firewall, choke-point, gate, consent-hoist, focus, policy]
dependency_graph:
  requires: [81-01-SUMMARY.md]
  provides: [firewallGate, buildObservation, createFirewallGate, fireConsent, consentHandlerRef]
  affects: [packages/runtime/src/runtime.ts]
tech_stack:
  added: []
  patterns: [injected-gate-closure, consent-handler-hoist, module-level-helpers, shared-ref-bridge]
key_files:
  created: []
  modified:
    - packages/runtime/src/runtime.ts
decisions:
  - "utf8ByteLength replaces TextEncoder — ES2022 tsconfig lib does not include DOM types; mirrors state-handler.ts existing helper"
  - "createFirewallGate takes a config object (not flat params) — mirrors createEnforceGate / createNubEnforceGate factory pattern"
  - "Tasks 1+2 committed in a single atomic commit — both modify only runtime.ts and form one logical unit"
  - "consentHandlerRef bridges createRuntime outer scope and registerConsentHandler inner scope via { current } mutable cell"
  - "reject and prompt both send error envelope first, then prompt fires fireConsent — matching POLICY-02 reject-now-prompt-async semantics"
metrics:
  duration_seconds: 360
  completed_date: "2026-06-15"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 1
  tests_added: 0
  tests_baseline: 132
  tests_final: 132
---

# Phase 81 Plan 02: Firewall Choke-Point Wiring Summary

**One-liner:** Firewall gate inserted into `createMessageHandler` after ACL success and before dispatch — `buildObservation`/`createFirewallGate` extracted as module-level helpers, consent handler hoisted via shared ref, `runtime.firewallState` getter exposed.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1+2 | Module-level helpers + container wiring + consent hoist | bad9a22 | packages/runtime/src/runtime.ts |
| 3 | aislop structural-complexity gate check | (no change) | runtime.ts clean — no aislop findings |

## Implementation Notes

### Gate insertion point

`createMessageHandler` now has the gate immediately after the ACL success block (`if (caps.senderCap)` check at :297-308), before `dispatchNubEnvelope`:

```typescript
const verdict = firewallGate(windowId, envelope, caps.senderCap);
if (verdict === 'drop') return;
dispatchNubEnvelope(windowId, envelope);
```

This is the two-liner the plan required. All decision logic lives in `createFirewallGate` (module-level helper).

### Consent hoist mechanism

The problem: `consentHandler` was stored in `createRuntimeInstance` scope (`let consentHandler = null; void consentHandler;`) but `firewallGate` is built in `createRuntime` outer scope — different closures.

The fix: a `{ current: ConsentHandler | null }` ref is allocated in `createRuntime` scope, passed into `RuntimeInstanceContext`, and `registerConsentHandler` sets `consentHandlerRef.current = handler`. The gate's `fireConsent` closure captures the ref by reference, so when `registerConsentHandler` is called after construction, `fireConsent` sees the updated value immediately.

### Decision → action mapping

| evaluate() decision | action | Runtime behavior |
|--------------------|--------|-----------------|
| `'reject'` | any | error envelope + drop (no dispatch) |
| `'prompt'` | any | error envelope + fireConsent + drop |
| `'pass'` | `'flag'` | onFirewallEvent audit + dispatch |
| `'pass'` | `'ignore'`/`'allow'` | dispatch only |

### POLICY-02 persistence (no re-prompt)

`fireConsent`'s `resolve` callback:
```typescript
resolve: (allowed) => {
  firewallState.setPolicy(napplet, allowed ? 'allow' : 'deny');
  firewallState.persist();
}
```
After resolution, subsequent messages from the same napplet match the persisted policy (`'allow'` or `'deny'`) — never re-prompting (T-81-04).

### Focus contract (FOCUS-01, T-81-FOCUS)

```typescript
const focus = getFocusContext?.(windowId) ?? { focused: true };
```
`getFocusContext` absent → `{ focused: true }` (safe relax-only default — a host without a WM never tightens budgets). Napplet self-reported focus is never read.

### TextEncoder deviation

The `extractKindSize` helper originally used `new TextEncoder().encode(JSON.stringify(ev)).length`. The runtime tsconfig uses `lib: ["ES2022"]` which does not include DOM types, so `TextEncoder` is not defined. Rule 3 fix: replaced with the same `utf8ByteLength` function that `state-handler.ts` already uses (ES2022-safe manual UTF-8 counter). No behavior difference for valid UTF-8 strings.

## Verification Results

- `npx vitest run packages/runtime`: 132/132 PASS (no regressions; same baseline as Plan 01)
- `npx tsc -p packages/runtime/tsconfig.json --noEmit`: zero new errors (pre-existing `acl-state.ts` intent:read/write error unchanged — deferred per Plan 01)
- `npx aislop scan`: runtime.ts produces zero warnings; createMessageHandler is a lean 2-line gate; all aislop findings are pre-existing (packages/firewall/src/ from Phase 80, types.ts file-too-large pre-existing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TextEncoder not available in ES2022 lib**
- **Found during:** Task 1 (first tsc run)
- **Issue:** `extractKindSize` used `new TextEncoder()` which is a DOM API not available in `lib: ["ES2022"]` tsconfig
- **Fix:** Replaced with `utf8ByteLength(str)` — identical algorithm already used in `state-handler.ts` to avoid DOM types
- **Files modified:** packages/runtime/src/runtime.ts
- **Commit:** bad9a22 (same commit — fix applied before committing)

## Known Stubs

None — all decision paths are fully wired. The `fireConsent` no-ops when `consentHandlerRef.current` is null (host has not registered a consent handler), which is the correct behavior for hosts that choose not to handle firewall prompts.

## Threat Surface Scan

No new network endpoints or auth paths introduced. The gate operates inside the existing `createMessageHandler` which is the established trust boundary for napplet messages. Error envelopes carry only `firewall: <reason>` — no config internals, no counter state (T-81-03 mitigated). Focus sourced exclusively via shell hook (T-81-FOCUS mitigated). Consent persist-on-resolve prevents re-prompting spam (T-81-04 mitigated).

## Self-Check

- [x] packages/runtime/src/runtime.ts modified
- [x] `function buildObservation` exists
- [x] `createFirewallGate` exists
- [x] `getFocusContext?.(windowId) ?? { focused: true }` present (FOCUS-01)
- [x] `const firewallState = createFirewallState` in createRuntime
- [x] `firewallGate(windowId, envelope, caps.senderCap)` in createMessageHandler
- [x] `consentHandlerRef.current = handler` in registerConsentHandler
- [x] `void consentHandler` dead-end removed
- [x] `get firewallState()` getter on runtime instance
- [x] `firewallState.persist()` in destroy()
- [x] commit bad9a22 exists
- [x] 132/132 tests green

## Self-Check: PASSED
