---
phase: 108-runtime-shell-composition
reviewed: 2026-08-20T13:28:09Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - packages/shell-ipc/src/index.ts
  - packages/shell-ipc/src/ipc-shell.ts
  - packages/shell-ipc/src/runtime-shell.test.ts
  - packages/shell-ipc/src/types.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 108: Code Review Report

**Reviewed:** 2026-08-20T13:28:09Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** clean

## Summary

The shared composition correctly uses one public runtime, transport-frozen registrations, per-endpoint targeted peer state, and runtime-produced NAP-INC survivor delivery. Focused IPC/runtime/NAP-INC tests, build, and type-check pass; no runtime, browser-shell, or Phase 109 source files changed. The NAP-SHELL/NAP-INC invariants were checked against `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; IPC topology remains an explicit spec gap.

The frozen-registration and explicit-unregister lifecycle fixes are sound. A retiring endpoint remains reachable only to lifecycle callers until carrier cleanup settles; its peer has already been retired, so it cannot receive runtime egress or ingress. Endpoint close, explicit unregister, and composition shutdown now join the same idempotent cleanup promise, and a same-window registration can begin after awaited unregister.

## Resolved Issues

### CR-01: Runtime binding used mutable caller registration rather than the frozen endpoint registration

**Classification:** BLOCKER — resolved

**File:** `packages/shell-ipc/src/ipc-shell.ts:218`

**Issue:** `createIpcShellProjection()` had stored `options.registration` directly and used that mutable object for connection teardown identity checks, `isDomainAllowed`, session registration, and the `shell.init` payload. A caller retaining its input object could mutate `dTag`, `aggregateHash`, `windowId`, `capabilities.domains`, or `services` after factory resolution but before `shell.ready`, violating BIND-01/BIND-03 and NAP-SHELL's creation-time host-assignment requirement.

**Resolution:** `8048e08` registers the caller's input with the transport, captures its `endpoint.registration` snapshot after transport validation/freeze, and makes every projection closure use that snapshot. The ingress hook additionally checks callback registration by object identity against that endpoint snapshot.

**Regression evidence:** `runtime-shell.test.ts` now mutates all host identity fields, removes the granted `keys` domain, and changes services after factory resolution but before raw `shell.ready`. It proves the original frozen identity creates the session, `shell.init` retains the original capabilities/services, and a `keys.forward` is still admitted. Verification: `pnpm --filter @kehto/shell-ipc type-check`, `pnpm --filter @kehto/shell-ipc test:unit -- --runInBand` (78 passing), and `pnpm --filter @kehto/shell-ipc build`.

### CR-02: Explicit unregister joined no in-flight endpoint close

**Classification:** BLOCKER — resolved

**File:** `packages/shell-ipc/src/ipc-shell.ts:289-299`

**Issue:** `closeRecord()` removed its record from `records` before `await record.endpoint.close()` completed. A concurrent `unregisterEndpoint()` therefore missed the in-flight cleanup and could resolve before the transport released its same-window reservation.

**Resolution:** `81a1a11` keeps a retiring record in `records` until `endpoint.close()` settles, while retiring its active peer before `destroyWindow()` and session unregister. `closeRecord()` now returns the record's exact idempotent promise to endpoint, unregister, and shutdown callers, and removes the record by identity only after carrier cleanup. The retained record has no active connection, so targeted egress and decoded ingress remain inert throughout cleanup.

**Regression evidence:** `runtime-shell.test.ts` concurrently starts endpoint close and explicit unregister, awaits unregister, then proves the path has gone and immediate same-window registration succeeds. It also races the replacement endpoint's close with composition shutdown. Verification: `pnpm --filter @kehto/shell-ipc type-check`, `pnpm --filter @kehto/shell-ipc test:unit` (81 passing), and `pnpm --filter @kehto/shell-ipc build`.

---

_Reviewed: 2026-08-20T13:28:09Z; CR-01 resolved: 2026-08-20T13:08:15Z; CR-02 resolved: 2026-08-20T13:28:09Z_
_Reviewer: gsd-code-reviewer_
_Depth: deep_
