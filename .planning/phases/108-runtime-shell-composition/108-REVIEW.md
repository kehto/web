---
phase: 108-runtime-shell-composition
reviewed: 2026-08-20T13:26:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - packages/shell-ipc/src/index.ts
  - packages/shell-ipc/src/ipc-shell.ts
  - packages/shell-ipc/src/runtime-shell.test.ts
  - packages/shell-ipc/src/types.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 108: Code Review Report

**Reviewed:** 2026-08-20T13:26:00Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The shared composition correctly uses one public runtime, transport-frozen registrations, per-endpoint targeted peer state, and runtime-produced NAP-INC survivor delivery. Focused IPC/runtime/NAP-INC tests, build, and type-check pass; no runtime, browser-shell, or Phase 109 source files changed. The NAP-SHELL/NAP-INC invariants were checked against `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; IPC topology remains an explicit spec gap.

The resolved frozen-registration fix remains sound. One blocking reentrancy defect remains in the new public explicit-unregister lifecycle: it loses an in-flight endpoint record before resource cleanup settles, so a concurrent `unregisterEndpoint()` falsely reports success.

## Resolved Issues

### CR-01: Runtime binding used mutable caller registration rather than the frozen endpoint registration

**Classification:** BLOCKER — resolved

**File:** `packages/shell-ipc/src/ipc-shell.ts:218`

**Issue:** `createIpcShellProjection()` had stored `options.registration` directly and used that mutable object for connection teardown identity checks, `isDomainAllowed`, session registration, and the `shell.init` payload. A caller retaining its input object could mutate `dTag`, `aggregateHash`, `windowId`, `capabilities.domains`, or `services` after factory resolution but before `shell.ready`, violating BIND-01/BIND-03 and NAP-SHELL's creation-time host-assignment requirement.

**Resolution:** `8048e08` registers the caller's input with the transport, captures its `endpoint.registration` snapshot after transport validation/freeze, and makes every projection closure use that snapshot. The ingress hook additionally checks callback registration by object identity against that endpoint snapshot.

**Regression evidence:** `runtime-shell.test.ts` now mutates all host identity fields, removes the granted `keys` domain, and changes services after factory resolution but before raw `shell.ready`. It proves the original frozen identity creates the session, `shell.init` retains the original capabilities/services, and a `keys.forward` is still admitted. Verification: `pnpm --filter @kehto/shell-ipc type-check`, `pnpm --filter @kehto/shell-ipc test:unit -- --runInBand` (78 passing), and `pnpm --filter @kehto/shell-ipc build`.

## Critical Issues

### CR-02: Explicit unregister resolves before an in-flight endpoint close has released its resources

**Classification:** BLOCKER

**File:** `packages/shell-ipc/src/ipc-shell.ts:289-299`

**Issue:** `closeRecord()` removes its record from `records` synchronously at line 293, before `await record.endpoint.close()` finishes. If a host calls `endpoint.close()` and, while that promise is still pending, calls `composition.unregisterEndpoint(windowId)`, lines 358-361 no longer find the record and resolve immediately. This contradicts the public contract in `IpcShellComposition.unregisterEndpoint()` that its promise resolves after matching lifecycle cleanup. The host can then attempt to re-register the same `windowId` after a successfully resolved unregister and receive `ENDPOINT_EXISTS`, because the underlying transport endpoint has not yet been removed. It also makes the explicit-unregister cleanup guarantee observably racy.

**Fix:** Keep a lookup for retiring records until their endpoint-close promise settles (for example a `closingRecords` map keyed by `windowId`, or a `closing` state retained in `records`). Both `endpoint.close()` and `unregisterEndpoint()` must return the same cleanup promise; only remove the record after the transport endpoint has closed. Add a regression that starts `endpoint.close()` without awaiting it, immediately awaits `composition.unregisterEndpoint(windowId)`, then proves the path is gone and a same-window registration succeeds.

---

_Reviewed: 2026-08-20T13:26:00Z; CR-01 resolved: 2026-08-20T13:08:15Z_
_Reviewer: gsd-code-reviewer_
_Depth: deep_
