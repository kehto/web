---
phase: 107-ipc-transport-foundation
reviewed: 2026-08-18T16:57:16Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - .changeset/quiet-rice-queue.md
  - packages/shell-ipc/jsr.json
  - packages/shell-ipc/package.json
  - packages/shell-ipc/README.md
  - packages/shell-ipc/src/endpoint-registry.test.ts
  - packages/shell-ipc/src/endpoint-registry.ts
  - packages/shell-ipc/src/index.ts
  - packages/shell-ipc/src/ipc-shell.test.ts
  - packages/shell-ipc/src/ipc-shell.ts
  - packages/shell-ipc/src/json-sequence.test.ts
  - packages/shell-ipc/src/json-sequence.ts
  - packages/shell-ipc/src/outbound-queue.test.ts
  - packages/shell-ipc/src/outbound-queue.ts
  - packages/shell-ipc/src/socket-directory.test.ts
  - packages/shell-ipc/src/socket-directory.ts
  - packages/shell-ipc/src/types.ts
  - packages/shell-ipc/tsconfig.json
  - packages/shell-ipc/tsup.config.ts
  - docs/.vitepress/config.ts
  - docs/packages/index.md
  - docs/packages/shell-ipc.md
  - docs/reference/api.md
  - typedoc.json
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 107: Code Review Report

**Reviewed:** 2026-08-18T16:57:16Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The original blockers remain resolved: a peer identity claim now terminates decoding before a coalesced follow-up frame can be delivered; one failed outbound peer no longer suppresses delivery attempts to later peers; and invalid transport limits reject before a transport is returned.

The public-package documentation integration is complete and docs-gate compatible. `IpcEnvironmentValue` is re-exported from the package root, listed on the package page, and emitted successfully by strict TypeDoc. Focused validation passed: package type-check, 63 IPC tests, strict TypeDoc, and `pnpm docs:check`.

One runtime boundary defect remains: the newly public JSON-compatible environment type is only compile-time enforced, while the implementation accepts mutable non-JSON containers and exposes the supposedly frozen clone through `endpoint.registration`.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Runtime accepts mutable non-JSON environment metadata despite the immutable binding contract

**Classification:** WARNING

**File:** `packages/shell-ipc/src/ipc-shell.ts:150-187`

**Issue:** `cloneAndFreezeRegistration()` clones and freezes arbitrary runtime input without validating that `environment` is an `IpcEnvironmentValue` tree. For example, a JavaScript caller (or a TypeScript caller using an assertion) can register `environment: new Map([['policy', 'original']])`. `structuredClone()` preserves the `Map`, and `Object.freeze()` does not freeze its entries; because `endpoint.registration` is public, `endpoint.registration.environment.set('policy', 'mutated')` succeeds. Later `onEnvelope` calls then receive changed host-bound metadata. This contradicts the documented and planned invariant that the environment is JSON-compatible and recursively immutable before listening.

**Fix:** Validate the complete registration at the public boundary before cloning/listening. Recursively accept only JSON primitives, arrays, and plain objects; reject `Map`, `Set`, `Date`, functions, `undefined`, non-finite numbers, and cycles with a typed `IpcTransportError`. Then clone and freeze the validated JSON tree. Add a production-endpoint test that attempts the `Map` input and asserts registration is rejected (and that no directory/listener is created).

---

_Reviewed: 2026-08-18T16:57:16Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
