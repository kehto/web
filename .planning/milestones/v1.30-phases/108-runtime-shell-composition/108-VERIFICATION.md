---
phase: 108-runtime-shell-composition
verified: 2026-08-20T13:31:30Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/10
  gaps_closed:
    - "A host can explicitly close or unregister an IPC shell endpoint with matching runtime and carrier cleanup."
    - "Two IPC endpoints can share one Runtime and deliver runtime-produced inc.channel.closed to a surviving peer."
  gaps_remaining: []
  regressions: []
---

# Phase 108: Runtime Shell Composition Verification Report

**Phase Goal:** Connected napplet processes receive the same authenticated NAP-SHELL and runtime guarantees as the web projection through IPC-specific lifecycle binding.
**Verified:** 2026-08-20T13:31:30Z
**Status:** passed
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | IPC composes the public runtime seam without changing canonical envelopes or browser shell/runtime source. | ✓ VERIFIED | `createIpcShellProjection()` uses public `createRuntime()` and `Runtime.handleMessage()`; `git diff 1eaf462..HEAD -- packages/runtime/src packages/shell/src` is empty. Focused build/type-check pass. |
| 2 | An endpoint admits only one peer and stale terminal events cannot erase a replacement session. | ✓ VERIFIED | `activeConnection` is generation-bound and is retired before cleanup; raw `node:net` replacement test passed. |
| 3 | One exact bare `shell.ready` creates the host-bound session and emits exactly one `shell.init`; duplicates are idempotent. | ✓ VERIFIED | `isShellReady()` requires exactly the own `type` field; `registerReadyPeer()` has a ready guard and sends one init. Raw-socket handshake test passed. |
| 4 | Payload-bearing ready is inert and does not establish a session. | ✓ VERIFIED | `isPayloadBearingShellReady()` reports one redacted `SHELL_READY_PAYLOAD_IGNORED` diagnostic; raw-socket test proves no session/init. |
| 5 | Pre-ready capability traffic is inert, while ready traffic follows the real runtime ACL and domain gates under host identity. | ✓ VERIFIED | Projection returns before `runtime.handleMessage()` until ready; post-ready policy test proves allowed execution, ACL block, adapter domain denial, and registration capability denial. |
| 6 | Runtime identity and delivered shell environment use the transport-cloned, recursively frozen host registration. | ✓ VERIFIED | Projection captures `endpoint.registration`, compares callback identity, and the mutation regression preserves original identity/capabilities/services. |
| 7 | Graceful close, abrupt disconnect, endpoint close, explicit unregister, and composition shutdown clean only matching session and carrier resources. | ✓ VERIFIED | `closeRecord()` joins lifecycle callers, retires peer state, destroys the window, unregisters the session, then closes carrier resources; raw lifecycle tests prove concurrent caller joining and immediate same-window re-registration after cleanup. |
| 8 | NAP-INC cleanup delivers `inc.channel.closed` to a surviving IPC peer that remains usable. | ✓ VERIFIED | Two raw `node:net` endpoints share one runtime, open a real channel, close A, assert the single canonical survivor event at B, then prove B receives `inc.channel.list.result`. |
| 9 | Canonical envelopes carry no IPC sidecars and peer identity claims are rejected before dispatch. | ✓ VERIFIED | Carrier's peer-binding guard remains before onEnvelope; projection metadata is closure state only. The raw identity-claim test closes the peer. |
| 10 | IPC carrier-specific policy remains an explicit spec gap, not claimed as NAP wire authority. | ✓ VERIFIED | Source and public types state the pinned NAP ref and that it defines no IPC carrier; the checked authority is `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`. |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/shell-ipc/src/ipc-shell.ts` | Shared runtime composition, targeted egress, readiness, generation-safe cleanup | ✓ VERIFIED | One private record per frozen registration; lifecycle callers join `closeRecord()` and egress resolves only the current ready record. |
| `packages/shell-ipc/src/types.ts` | Composition and endpoint lifecycle contract | ✓ VERIFIED | `IpcShellComposition` and `IpcShellEndpoint` expose host-only close/unregister semantics while retaining the one-registration convenience projection. |
| `packages/shell-ipc/src/runtime-shell.test.ts` | Raw-socket lifecycle and parity matrix | ✓ VERIFIED | Ten substantive raw `node:net` tests include concurrent lifecycle and NAP-INC survivor coverage. |
| `packages/shell-ipc/src/index.ts` and `package.json` | Public ESM runtime-composition seam | ✓ VERIFIED | Public factory/types exported and `@kehto/runtime: workspace:^` is declared. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Projection ingress | `@kehto/runtime` | `Runtime.handleMessage(registration.windowId, envelope)` after readiness | ✓ WIRED | The runtime graph trace reaches enforcement, ACL, session registry, and domain dispatch. |
| Runtime egress | accepted IPC peer | composed `sendToNapplet` checks source window, readiness, canonical shape, then `peer.send()` | ✓ WIRED | Targeted egress is closure-bound to the active peer. |
| Matching peer terminal event | runtime session teardown | generation match, retire record, `destroyWindow`, then session unregister | ✓ WIRED | Graceful, abrupt, and stale-replacement focused tests pass. |
| Explicit endpoint unregister | matching projection runtime teardown | public host lifecycle API | ✓ WIRED | `IpcShellComposition.unregisterEndpoint()` and endpoint `close()` join the same record-local cleanup promise. |
| `Runtime.destroyWindow` | surviving IPC peer | runtime-generated `inc.channel.closed` | ✓ WIRED | Shared composition's targeted runtime adapter delivers the real runtime survivor event to B. |

### Data-Flow Trace (Level 4)

Not applicable: this phase contains transport/runtime utilities and raw-socket tests, not rendered dynamic-data artifacts.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Combined projection/transport/runtime/INC checks | `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts packages/runtime/src/runtime.test.ts tests/unit/nap-inc-conformance.test.ts --reporter=dot` | 4 files, 52 tests passed | ✓ PASS |
| Exact ready, one init, pre-ready gate, peer admission | named `runtime-shell.test.ts` handshake test | 1 passed | ✓ PASS |
| Token-safe graceful replacement cleanup | named replacement test | 1 passed | ✓ PASS |
| Abrupt disconnect and idempotent projection shutdown | named shutdown test | 1 passed | ✓ PASS |
| Identity/domain/ACL policy after ready | named runtime-policy test | 1 passed | ✓ PASS |
| Concurrent endpoint close/unregister and same-window re-registration | named raw-socket lifecycle test | 1 passed | ✓ PASS |
| Shared-runtime INC survivor cleanup and B post-close usability | named two-endpoint raw-socket test | 1 passed | ✓ PASS |
| Old endpoint cannot close same-window replacement | named stale-handle raw-socket test | 1 passed | ✓ PASS |
| Package build and type contract | `pnpm --filter @kehto/shell-ipc build` and `type-check` | both passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- |
| BIND-02 | 108-02 | One active peer and generation-safe replacement | ✓ SATISFIED | Active peer guard and raw replacement test. |
| BIND-03 | 108-01 | Bare ready, one init, no pre-ready capabilities | ✓ SATISFIED | Exact readiness predicate and raw handshake test. |
| BIND-04 | 108-02, 108-03 | Graceful, abrupt, explicit unregister, and shutdown cleanup | ✓ SATISFIED | Public endpoint close/unregister, joined teardown, resource release, and shutdown proof. |
| PROOF-01 | 108-01 | Public runtime composition without browser/runtime source changes | ✓ SATISFIED | Public runtime API call path, package dependency, and clean source-boundary diff. |
| PROOF-04 | 108-02, 108-03 | ACL, eligibility, source identity, handshake, and lifecycle parity | ✓ SATISFIED | Raw policy tests plus shared-runtime NAP-INC survivor delivery and post-cleanup route proof. |

### Anti-Patterns Found

None. The Phase 108 source/test files contain no unresolved debt markers, stubs, or hardcoded runtime output paths.

## Re-verification Summary

Both prior blockers are closed. The public IPC shell composition now owns per-registration lifecycle APIs and shares a single public Runtime across independently registered Unix-socket endpoints. All original handshake, frozen-identity, policy-gate, targeted-egress, and token-retirement guarantees remain behaviorally covered.

NAP-SHELL and NAP-INC were checked against `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`. The implementation is conformant for carrier-neutral handshake, identity, session, and INC lifecycle semantics; the POSIX IPC carrier topology remains explicitly documented as an intentional spec gap.

---

_Verified: 2026-08-20T13:31:30Z_
_Verifier: the agent (gsd-verifier)_
