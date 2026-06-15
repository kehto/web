---
phase: 83-nap-ontology-alignment
plan: "02"
subsystem: runtime
tags: [nap-alignment, inc, ifc, dispatch, domain-aware, vocabulary]
dependency_graph:
  requires: [83-01]
  provides: [ALIGN-05]
  affects: [packages/runtime]
tech_stack:
  added: []
  patterns:
    - per-window domain vocabulary tracking (Map<windowId, 'ifc'|'inc'>)
    - domain-aware outgoing message prefix derivation
    - dual dispatch key registration for back-compat
key_files:
  modified:
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/ifc-handler.ts
    - packages/runtime/src/dispatch.test.ts
decisions:
  - "D4: registerNub('inc', adapt(handlers.ifc)) added immediately after 'ifc' registration — identical handler reference, no new RuntimeNubHandlers type entry"
  - "D6: IfcState.domainByWindow (Map<string, IfcDomain>) records each window's vocabulary on first message; domainOf() extracts prefix from msg.type; prefixFor() reads map with fallback; all 6 hardcoded ifc.* outgoing literal patterns replaced with computed prefix"
  - "Fallback for unknown recipients: use sender/emitter's domain — covers the case where a napplet has not yet sent any message to the handler"
  - "removeWindowChannels: uses destroyee's tracked domain as fallback for peer lookup, cleaned up after via destroyWindow deletion"
metrics:
  duration: 4m
  completed: "2026-06-15T16:09:24Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 83 Plan 02: INC/IFC Dispatch Rail Vocabulary Awareness Summary

**One-liner:** Dual dispatch key (inc/ifc) + per-window domain tracking so >=0.9.0 napplets (inc.*) and legacy napplets (ifc.*) each receive their own vocabulary prefix end-to-end.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Register ifc handler under inc dispatch key (D4) | 24aa267 | packages/runtime/src/runtime.ts |
| 2 | Domain-aware ifc handler + inc.* roundtrip tests (D6) | 96c8090 | packages/runtime/src/ifc-handler.ts, packages/runtime/src/dispatch.test.ts |

## What Was Built

### Task 1 — D4: Dual Dispatch Key Registration

In `createNubEnvelopeDispatcher` (`packages/runtime/src/runtime.ts`), immediately after the existing `nubDispatch.registerNub('ifc', adapt(handlers.ifc))` line, added:

```typescript
// D4: inc is the NAP rename of ifc; dual-routed during the back-compat window
// so >=0.9.0 napplets (which send inc.*) reach the same handler as legacy ifc.*
nubDispatch.registerNub('inc', adapt(handlers.ifc));
```

Both keys share the same `handlers.ifc` reference. No new `RuntimeNubHandlers` type key was added. Legacy `ifc.*` routing is byte-for-byte unchanged.

### Task 2 — D6: Domain-Aware IFC Handler

#### IfcState changes

Added `domainByWindow: Map<string, IfcDomain>` to `IfcState` where `IfcDomain = 'ifc' | 'inc'`. Entries are:
- Set on the **first message** a window sends to the handler (one napplet speaks exactly one vocabulary)
- Deleted in `destroyWindow` and `clear()`

#### Helper functions

- `domainOf(type: string): IfcDomain` — slices before the first `.` to extract vocabulary
- `prefixFor(state, windowId, fallback): IfcDomain` — reads `domainByWindow` with fallback

#### Outgoing prefix rules (D6)

**Direct responses** (requester → requester): echo the incoming request's domain
- `subscribe.result`, `channel.open.result`, `channel.list.result`, `channel.closed` (to closer)

**Push events** (to other napplets): use recipient's tracked domain, fall back to sender's domain
- `*.event` (emit → subscribers)
- `*.channel.event` (channel.emit / channel.broadcast → peer)
- `*.channel.closed` (channel.close → peer; removeWindowChannels → peer)

#### Zero hardcoded literals

All 6 previously hardcoded `ifc.*` outgoing type patterns replaced with computed prefix:
- `'ifc.event'` → `\`${prefix}.event\``
- `'ifc.subscribe.result'` → `\`${incomingDomain}.subscribe.result\``
- `'ifc.channel.open.result'` → `\`${incomingDomain}.channel.open.result\``
- `'ifc.channel.event'` → `\`${prefix}.channel.event\``
- `'ifc.channel.list.result'` → `\`${incomingDomain}.channel.list.result\``
- `'ifc.channel.closed'` → `\`${closerDomain}.channel.closed\`` (closer) / `\`${peerPrefix}.channel.closed\`` (peer)

#### dispatch.test.ts additions

Three new test cases added in the IFC Handler describe block and a new `mixed-vocabulary delivery` describe block:

1. `inc.subscribe produces inc.subscribe.result` — direct response echoes requester prefix
2. `inc.subscribe + inc.emit delivers inc.event to inc subscriber` — all-inc roundtrip
3. `mixed-vocabulary: ifc subscriber receives ifc.event and inc subscriber receives inc.event` — cross-contamination guard asserts neither wrong type is delivered

## Verification

### Type-check

```
pnpm --filter @kehto/runtime type-check
> tsc --noEmit
(exits 0 — no output)
```

Root-level `pnpm type-check` (turbo): **11 tasks successful, 11 total**.

Pre-existing errors in `acl-state.ts`/`enforce.ts` (`intent:read`/`intent:write` missing from Capability type) were present before this plan and not caused by it — confirmed by stash test.

### Unit tests

```
pnpm vitest run
Test Files  55 passed (55)
Tests       796 passed (796)
```

Runtime package tests (11 test files, 132 tests): all pass.
- dispatch.test.ts: 63 tests pass (including 5 new inc.* + mixed tests)
- runtime.test.ts: 14 channel tests pass byte-for-byte unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All wired behavior is functional.

## Threat Flags

None. Domain prefix derivation is message-type formatting only; it does not affect ACL identity (keyed by windowId/session). T-83-02 accepted per threat register.

## Self-Check: PASSED

Files exist:
- packages/runtime/src/runtime.ts: FOUND
- packages/runtime/src/ifc-handler.ts: FOUND
- packages/runtime/src/dispatch.test.ts: FOUND

Commits exist:
- 24aa267: feat(83-02): register ifc handler under inc dispatch key (D4): FOUND
- 96c8090: feat(83-02): domain-aware ifc handler + inc.* roundtrip tests (D6): FOUND

Zero hardcoded ifc.* outgoing literals in ifc-handler.ts: CONFIRMED (grep count = 0 for all 6 patterns)

All 796 unit tests green: CONFIRMED
