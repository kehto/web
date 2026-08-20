---
phase: 109-runnable-proof-and-drafting-evidence
reviewed: 2026-08-20T15:18:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - .changeset/quiet-rice-queue.md
  - docs/.vitepress/config.ts
  - docs/packages/shell-ipc.md
  - docs/reference/experimental-ipc-projection.md
  - packages/shell-ipc/README.md
  - packages/shell-ipc/examples/ipc-projection-reference-host.mjs
  - packages/shell-ipc/src/ipc-projection-process.test.ts
  - packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs
findings:
  critical: 5
  warning: 1
  info: 0
  total: 6
status: issues_found
---

# Phase 109: Code Review Report

**Reviewed:** 2026-08-20T15:18:00Z
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The documentation accurately records the pinned `napplet/naps`
`origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa` authority as having no
IPC carrier, and the package/release boundaries are otherwise consistent. The
runnable proof itself is not shippable: its documented invocation fails, its
cleanup path can recursively delete caller-owned data, and its transcript lets
the raw child manufacture the host-side evidence the test treats as proof.

The focused Vitest file passes, but direct execution of the documented command
`node packages/shell-ipc/examples/ipc-projection-reference-host.mjs --mode graceful`
exits 1 with `IPC projection reference host failed.`

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01 [BLOCKER]: The documented standalone command is rejected before the proof starts

**File:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs:20`

**Issue:** `readArguments()` requires exactly four arguments even though
`baseDirectory` is explicitly optional and both public documents tell users to
pass only `--mode graceful` or `--mode forced` ([README](../../../packages/shell-ipc/README.md)
lines 85-89; [package docs](../../../docs/packages/shell-ipc.md) lines 60-64).
That two-argument invocation always throws `Invalid reference host arguments.`;
the fallback `mkdtemp()` branch is therefore unreachable from the documented
CLI. The process test hides this by always supplying `--base-dir`.

**Fix:** Accept either `--mode <mode>` or `--base-dir <dir> --mode <mode>`
regardless of flag order, reject duplicates/unknown flags, and add a process
test that executes the exact README command without `--base-dir`.

### CR-02 [BLOCKER]: A failed run recursively deletes the caller-owned base directory

**File:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs:185`

**Issue:** When `--base-dir` is supplied, any failure before the success
transcript (child error, timeout, or transcript error) executes
`rm(baseDirectory, { recursive: true, force: true })`. `baseDirectory` belongs
to the caller in this mode and can contain unrelated files, so a failed proof
can delete arbitrary caller data. This also contradicts the public lifecycle
contract that the host owns only its created socket resources.

**Fix:** Never remove a caller-supplied directory. Only remove the directory
created by this process (`ownsBaseDirectory`), and add a failure-path test with
a sentinel file in a supplied base directory that must survive.

### CR-03 [BLOCKER]: The child can forge the control transcript and cause a host-originated push without a real result

**File:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs:138-149`

**Issue:** The host accepts the child's stdout record `{"milestone":"result"}`
as proof that the runtime result arrived, then calls
`ServiceRuntimeContext.sendToEligibleNapplet()` solely because that untrusted
record was printed. A child can send bare `shell.ready` to establish the
session, print `shell.init`, `result`, and `intent.changed` without sending the
canonical request or receiving either envelope, and cause the host to emit a
successful `context-push` record. `expectProof()` then accepts that forged
sequence ([process test](../../../packages/shell-ipc/src/ipc-projection-process.test.ts)
lines 66-86). Thus the proof does not establish the required real
request/result or host-originated push and violates the required transcript
authenticity boundary.

**Fix:** Record trusted host milestones at the real service-dispatch/result
seam and invoke the eligible push from that host-controlled path, not from
child stdout. Keep child records observational only, then assert that the
child's receipt records occur after independently emitted host request/result
and push milestones. Add a negative fixture/test that prints forged stdout
milestones and proves it cannot advance the host proof.

### CR-04 [BLOCKER]: `routeAbsent` is hard-coded and the advertised route cleanup is never checked

**File:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs:170`

**Issue:** The cleanup transcript claims `routeAbsent: true` as a literal,
while the test asserts that claim as evidence of cleanup
([process test](../../../packages/shell-ipc/src/ipc-projection-process.test.ts)
lines 79-84). No endpoint/registration route is inspected or made observable,
so a route leak would still produce a green proof. This fails the Phase 109
requirement to assert that both route and session state are gone after graceful
and SIGKILL cleanup.

**Fix:** Replace the literal with an observable assertion. For example, after
closing the endpoint, register and close a replacement with the same `windowId`
to prove the old route was removed, then check the resulting path/directory
cleanup; or expose an explicitly public, read-only lifecycle observation that
can establish absence. Make the transcript derive `routeAbsent` from that
assertion rather than a constant.

### CR-05 [BLOCKER]: Malformed child control output bypasses lifecycle cleanup

**File:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs:131-153`

**Issue:** `parseChildRecord()` and the duplicate-milestone check throw inside
an EventEmitter `data` callback. Those throws are outside `main()`'s awaited
control flow, so they can terminate the host instead of entering its `finally`
block. A malformed line from the raw process can consequently leave the socket
path/directory and runtime teardown unperformed; a never-terminated stdout
record is also accumulated without a bound. This makes the abnormal-child
cleanup evidence incomplete and lets an untrusted control channel turn a
reference run into an orphaned-resource failure.

**Fix:** Convert stdout parsing failures into a rejected, awaited transcript
promise; race it with the lifecycle waits, terminate/reap the child, and let
the `finally` close the composition. Enforce a maximum buffered control-line
size even when no newline arrives. Add malformed, duplicate, and unterminated
control-output tests that assert a nonzero host exit while preserving cleanup.

## Warnings

### WR-01 [WARNING]: The static raw-child boundary guard permits disallowed helpers and CommonJS imports

**File:** `packages/shell-ipc/src/ipc-projection-process.test.ts:117-125`

**Issue:** The guard only requires every detected `import` to start with
`node:`. It therefore permits imports such as `node:child_process` or
`node:module`, and it does not reject `require('@kehto/...')` via
`createRequire`. That is weaker than the phase boundary that the raw napplet
uses only `node:net` plus local framing/arguments/stdout, so a regression can
introduce a helper dependency while the test remains green.

**Fix:** Assert the complete import list is exactly `['node:net']`, reject
`require`, `createRequire`, package specifiers, and helper/browser tokens, and
keep the existing local RFC 7464 assertions.

---

_Reviewed: 2026-08-20T15:18:00Z_
_Reviewer: gsd-code-reviewer_
_Depth: deep_
