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
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 108: Code Review Report

**Reviewed:** 2026-08-20T13:05:32Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

The projection correctly keeps the IPC carrier private, routes runtime egress through an opaque peer handle, and leaves `packages/runtime/src` and `packages/shell/src` unchanged. The NAP-SHELL/NAP-INC invariants were checked against `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; IPC-specific carrier policy remains an explicit spec gap.

One blocking identity/capability binding defect remains: the projection's runtime lifecycle reads the caller-owned mutable registration instead of the transport's recursively frozen copy. This breaks the phase's host-attested registration boundary after the socket has started listening.

## Critical Issues

### CR-01: Runtime binding uses mutable caller registration rather than the frozen endpoint registration

**Classification:** BLOCKER

**File:** `packages/shell-ipc/src/ipc-shell.ts:218`

**Issue:** `createIpcShellProjection()` stores `options.registration` directly and later uses that mutable object for connection teardown identity checks, `isDomainAllowed`, session registration, and the `shell.init` payload (lines 233, 245-250, 273, 277-287, and 315-331). `createIpcTransport().registerEndpoint()` does clone and recursively freeze the registration, but that frozen copy is only exposed as `endpoint.registration` at line 293 and is not the object used by the projection's runtime closures. A caller retaining its input object can mutate `dTag`, `aggregateHash`, `windowId`, `capabilities.domains`, or `services` after `createIpcShellProjection()` resolves but before `shell.ready`. The resulting session and capability gate then differ from the immutable endpoint registration, violating BIND-01/BIND-03 and NAP-SHELL's requirement that session identity and the authoritative `shell.init` environment come from creation-time host assignment.

**Fix:** Bind every projection closure to the transport's frozen endpoint registration, not `options.registration`, and add a raw-socket regression that mutates the original input after factory resolution but before `shell.ready` and asserts the session, domain gate, and `shell.init` still use the original frozen values. For example, retain a typed `frozenRegistration` initialized from `endpoint.registration` before returning the projection, and have `sendToNapplet`, `isDomainAllowed`, readiness registration, diagnostics, and teardown use that value exclusively. If lifecycle hooks need it before the endpoint is returned, capture the host-frozen registration passed into their hook and verify it is the expected endpoint copy.

---

_Reviewed: 2026-08-20T13:05:32Z_
_Reviewer: gsd-code-reviewer_
_Depth: deep_
