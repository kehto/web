---
phase: 107-ipc-transport-foundation
reviewed: 2026-08-18T17:40:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - .changeset/quiet-rice-queue.md
  - packages/shell-ipc/jsr.json
  - packages/shell-ipc/package.json
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
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 107: Code Review Report

**Reviewed:** 2026-08-18T17:40:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

The IPC package has bounded framing, owned socket directories, and targeted race tests, but three ship-blocking isolation and fail-closed defects remain. The focused suite passes (56 tests), yet it does not cover a coalesced post-rejection frame, peer-to-peer broadcast isolation, or validation of all transport-level limits before accepting a connection.

## Critical Issues

### CR-01: Peer identity rejection does not make the decoder terminal

**Classification:** BLOCKER

**File:** `packages/shell-ipc/src/ipc-shell.ts:77-82`

**Issue:** A forbidden top-level binding claim calls `socket.destroy()` and returns normally from `onEnvelope`. `createJsonSequenceDecoder()` has already retained the rest of the received chunk and continues its loop after that callback returns. A peer can therefore write an identity-claim record followed by a valid record in the same chunk; the second record reaches `hooks.onEnvelope` before the asynchronous destroy takes effect. This contradicts the required first-invalid-record fail-closed behavior and lets an unauthenticated peer dispatch after a protocol violation. I reproduced this with `RS + claimed shell.ready + LF + RS + valid shell.ready + LF`; the valid envelope was delivered.

**Fix:** Turn the claim into a decoder error so its existing `fail()` path clears the buffer and closes the decoder, then let the data handler emit the diagnostic and destroy the socket. Add a regression using both records in one `write()` and assert zero receiver invocations.

```ts
onEnvelope(envelope) {
  if (!assertNoPeerBindingClaims(envelope)) {
    throw new IpcTransportError(
      'PEER_IDENTITY_CLAIM',
      'IPC peer attempted to claim host-bound endpoint identity.',
    );
  }
  hooks.onEnvelope(envelope as unknown as NappletMessage, registration);
}
```

### CR-02: One overflowed peer aborts delivery to all later peers

**Classification:** BLOCKER

**File:** `packages/shell-ipc/src/ipc-shell.ts:117-120`

**Issue:** `OutboundQueue.enqueue()` intentionally throws after terminating an overflowing queue, but `endpoint.send()` does not isolate that exception. The `for` loop stops at the first saturated peer, so every peer later in insertion order silently misses that envelope. A slow peer that connected first can thus deny egress to healthy peers, contrary to the per-peer queue design. With two real connections, a one-frame limit, and two immediate sends, the first connection overflowed and the second received only the first frame.

**Fix:** Attempt delivery to every currently connected queue, retain the first terminal error for the caller after the loop (or make send non-throwing and use diagnostics), and add a two-peer regression where the first queue is saturated and the second receives the same later frame.

```ts
send(envelope) {
  const frame = encodeJsonSequence(envelope);
  let failure: unknown;
  for (const queue of peers.values()) {
    try {
      queue.enqueue(frame);
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure) throw failure;
}
```

### CR-03: Invalid transport limits can throw uncaught from an accepted-socket callback

**Classification:** BLOCKER

**File:** `packages/shell-ipc/src/ipc-shell.ts:30-31, 61-76`

**Issue:** The transport spreads `options.limits` without validating it. Frame/buffer limits are validated only when `createJsonSequenceDecoder()` runs inside the `createServer` connection listener; outbound limits are likewise validated by `createOutboundQueue()` there. A JavaScript consumer can create/register a transport with, for example, `maxFrameBytes: 0` or `maxOutboundQueueFrames: -1`; the next peer connection throws during the EventEmitter callback with no surrounding catch, which can terminate the Node process. `maxPathBytes` is also never checked as a finite positive integer.

**Fix:** Normalize and validate every transport limit before allocating the registry or returning the transport: positive safe integers for pathname/frame/input bounds and non-negative safe integers for queue bounds. Throw `IpcTransportError('INVALID_LIMIT', ...)` from `createIpcTransport()`. Add transport-level tests for every invalid field and verify an invalid options object rejects before endpoint registration or peer connection.

```ts
const limits = validateTransportLimits(options.limits);
// validateTransportLimits applies defaults and rejects invalid values here,
// not in the connection callback.
```

---

_Reviewed: 2026-08-18T17:40:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
