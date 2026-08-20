---
phase: 108-runtime-shell-composition
reviewed: 2026-08-20T13:05:32Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - packages/shell-ipc/package.json
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

**Reviewed:** 2026-08-20T13:05:32Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** clean

## Summary

The projection correctly keeps the IPC carrier private, routes runtime egress through an opaque peer handle, and leaves `packages/runtime/src` and `packages/shell/src` unchanged. The NAP-SHELL/NAP-INC invariants were checked against `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; IPC-specific carrier policy remains an explicit spec gap.

The blocking identity/capability binding defect was fixed in `8048e08`. The projection now registers the caller input only with the transport, then captures `endpoint.registration`—the transport-validated, cloned, recursively frozen snapshot—as the sole registration used by runtime identity, capability gates, session registration, diagnostics, teardown, and `shell.init`.

## Resolved Issues

### CR-01: Runtime binding used mutable caller registration rather than the frozen endpoint registration

**Classification:** BLOCKER — resolved

**File:** `packages/shell-ipc/src/ipc-shell.ts:218`

**Issue:** `createIpcShellProjection()` had stored `options.registration` directly and used that mutable object for connection teardown identity checks, `isDomainAllowed`, session registration, and the `shell.init` payload. A caller retaining its input object could mutate `dTag`, `aggregateHash`, `windowId`, `capabilities.domains`, or `services` after factory resolution but before `shell.ready`, violating BIND-01/BIND-03 and NAP-SHELL's creation-time host-assignment requirement.

**Resolution:** `8048e08` registers the caller's input with the transport, captures its `endpoint.registration` snapshot after transport validation/freeze, and makes every projection closure use that snapshot. The ingress hook additionally checks callback registration by object identity against that endpoint snapshot.

**Regression evidence:** `runtime-shell.test.ts` now mutates all host identity fields, removes the granted `keys` domain, and changes services after factory resolution but before raw `shell.ready`. It proves the original frozen identity creates the session, `shell.init` retains the original capabilities/services, and a `keys.forward` is still admitted. Verification: `pnpm --filter @kehto/shell-ipc type-check`, `pnpm --filter @kehto/shell-ipc test:unit -- --runInBand` (78 passing), and `pnpm --filter @kehto/shell-ipc build`.

---

_Reviewed: 2026-08-20T13:05:32Z; resolved: 2026-08-20T13:08:15Z_
_Reviewer: gsd-code-reviewer_
_Depth: deep_
