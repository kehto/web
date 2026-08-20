---
phase: 108-runtime-shell-composition
verified: 2026-08-20T13:11:32Z
status: gaps_found
score: 8/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Graceful close, abrupt disconnect, explicit unregister, and host shutdown clean up only the matching runtime session and IPC resources."
    status: failed
    reason: "The public IpcShellProjection exposes only close(); it does not expose an endpoint close or explicit unregister operation bound to its runtime/session teardown. The internal transport unregisterEndpoint() cannot be reached by a host using the projection."
    artifacts:
      - path: "packages/shell-ipc/src/types.ts"
        issue: "IpcShellProjection has path, registration, runtime, and close only; no per-registration unregister/endpoint-close lifecycle API exists."
      - path: "packages/shell-ipc/src/runtime-shell.test.ts"
        issue: "No raw-socket test exercises endpoint close or explicit projection unregister with matching runtime teardown."
    missing:
      - "Expose and wire a host-usable explicit endpoint unregister/close lifecycle that first retires the matching connection token, destroys its runtime window, unregisters its session, then releases only its carrier resources."
      - "Add direct graceful, abrupt, endpoint-close, explicit-unregister, and host-shutdown lifecycle coverage."
  - truth: "Closing one IPC endpoint cleans its runtime state while a surviving ready IPC peer receives runtime-produced inc.channel.closed and remains usable."
    status: failed
    reason: "Each createIpcShellProjection() call creates a distinct Runtime and the projection API owns exactly one endpoint. No shared-runtime multi-registration composition exists, and runtime-shell.test.ts contains no inc.channel.open/inc.channel.closed case."
    artifacts:
      - path: "packages/shell-ipc/src/ipc-shell.ts"
        issue: "The factory calls createRuntime() per projection and has a single activeConnection; it has no host-level multi-endpoint registry feeding one runtime."
      - path: "packages/shell-ipc/src/runtime-shell.test.ts"
        issue: "The planned inc.channel.closed parity matrix is absent (no inc.channel.open or inc.channel.closed assertions)."
    missing:
      - "Provide a host composition seam for multiple independently registered IPC endpoints sharing the applicable Runtime/session space, with targeted egress per endpoint."
      - "Prove NAP-INC channel closure reaches the surviving peer and that its post-cleanup route remains usable."
---

# Phase 108: Runtime Shell Composition Verification Report

**Phase Goal:** Connected napplet processes receive the same authenticated NAP-SHELL and runtime guarantees as the web projection through IPC-specific lifecycle binding.
**Verified:** 2026-08-20T13:11:32Z
**Status:** gaps_found
**Re-verification:** No — initial verification

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
| 7 | Graceful close, abrupt disconnect, explicit unregister, and host shutdown clean up only matching session and carrier resources. | ✗ FAILED | Graceful/abrupt/projection-close paths are tested, but `IpcShellProjection` exposes no explicit unregister or endpoint-close operation and no test can exercise those required paths. |
| 8 | NAP-INC cleanup delivers `inc.channel.closed` to a surviving IPC peer. | ✗ FAILED | No shared-runtime multi-endpoint IPC composition exists; no `inc.channel.open`/`inc.channel.closed` test exists in `runtime-shell.test.ts`. |
| 9 | Canonical envelopes carry no IPC sidecars and peer identity claims are rejected before dispatch. | ✓ VERIFIED | Carrier's peer-binding guard remains before onEnvelope; projection metadata is closure state only. The raw identity-claim test closes the peer. |
| 10 | IPC carrier-specific policy remains an explicit spec gap, not claimed as NAP wire authority. | ✓ VERIFIED | Source and public types state the pinned NAP ref and that it defines no IPC carrier; the checked authority is `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`. |

**Score:** 8/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/shell-ipc/src/ipc-shell.ts` | Runtime projection, targeted egress, readiness, generation-safe cleanup | PARTIAL | Substantive and wired to public runtime; lacks host-level multi-endpoint runtime composition and public explicit unregister lifecycle. |
| `packages/shell-ipc/src/types.ts` | Projection lifecycle contract | PARTIAL | Substantive typed public API, but `IpcShellProjection` exposes only `close()`. |
| `packages/shell-ipc/src/runtime-shell.test.ts` | Raw-socket lifecycle and parity matrix | PARTIAL | Seven substantive raw `node:net` tests pass; required explicit-unregister/endpoint-close and NAP-INC survivor cases are absent. |
| `packages/shell-ipc/src/index.ts` and `package.json` | Public ESM runtime-composition seam | ✓ VERIFIED | Public factory/types exported and `@kehto/runtime: workspace:^` is declared. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Projection ingress | `@kehto/runtime` | `Runtime.handleMessage(registration.windowId, envelope)` after readiness | ✓ WIRED | The runtime graph trace reaches enforcement, ACL, session registry, and domain dispatch. |
| Runtime egress | accepted IPC peer | composed `sendToNapplet` checks source window, readiness, canonical shape, then `peer.send()` | ✓ WIRED | Targeted egress is closure-bound to the active peer. |
| Matching peer terminal event | runtime session teardown | generation match, retire record, `destroyWindow`, then session unregister | ✓ WIRED | Graceful, abrupt, and stale-replacement focused tests pass. |
| Explicit endpoint unregister | matching projection runtime teardown | public host lifecycle API | ✗ NOT WIRED | The only `unregisterEndpoint()` belongs to the inaccessible internal transport. |
| `Runtime.destroyWindow` | surviving IPC peer | runtime-generated `inc.channel.closed` | ✗ NOT WIRED | Requires two endpoint registrations in one Runtime; implementation/test surface has none. |

### Data-Flow Trace (Level 4)

Not applicable: this phase contains transport/runtime utilities and raw-socket tests, not rendered dynamic-data artifacts.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Combined projection/transport/runtime/INC checks | `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts packages/runtime/src/runtime.test.ts tests/unit/nap-inc-conformance.test.ts --reporter=dot` | 4 files, 49 tests passed | ✓ PASS |
| Exact ready, one init, pre-ready gate, peer admission | named `runtime-shell.test.ts` handshake test | 1 passed | ✓ PASS |
| Token-safe graceful replacement cleanup | named replacement test | 1 passed | ✓ PASS |
| Abrupt disconnect and idempotent projection shutdown | named shutdown test | 1 passed | ✓ PASS |
| Identity/domain/ACL policy after ready | named runtime-policy test | 1 passed | ✓ PASS |
| Package build and type contract | `pnpm --filter @kehto/shell-ipc build` and `type-check` | both passed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- |
| BIND-02 | 108-02 | One active peer and generation-safe replacement | ✓ SATISFIED | Active peer guard and raw replacement test. |
| BIND-03 | 108-01 | Bare ready, one init, no pre-ready capabilities | ✓ SATISFIED | Exact readiness predicate and raw handshake test. |
| BIND-04 | 108-02 | Graceful, abrupt, explicit unregister, and shutdown cleanup | ✗ BLOCKED | Explicit unregister/endpoint-close is not exposed/wired through the runtime projection. |
| PROOF-01 | 108-01 | Public runtime composition without browser/runtime source changes | ✓ SATISFIED | Public runtime API call path, package dependency, and clean source-boundary diff. |
| PROOF-04 | 108-02 | ACL, eligibility, source identity, handshake, and lifecycle parity | ✗ BLOCKED | Local policy parity is proven, but the required IPC NAP-INC two-endpoint lifecycle/targeted egress case is not implemented or tested. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `packages/shell-ipc/src/runtime-shell.test.ts` | — | Planned `inc.channel.closed` scenario absent | 🛑 BLOCKER | The test artifact's declared parity matrix is incomplete and exposes an unwired host composition seam. |
| `packages/shell-ipc/src/types.ts` | 225 | Projection lifecycle has only `close()` | 🛑 BLOCKER | A host cannot explicitly unregister the IPC projection while applying matching runtime teardown. |

## Gaps Summary

The single-peer projection correctly reuses the public runtime seam for handshake, identity, ACL, domain eligibility, targeted egress, and token-safe peer teardown. It does not yet implement the two host-level lifecycle capabilities Phase 108 planned and the roadmap requires: explicit registration teardown and multiple IPC registrations in the same runtime/session space. Those absences make the NAP-INC survivor cleanup guarantee untestable through IPC and leave BIND-04 incomplete.

The protocol check is conformant for carrier-neutral NAP-SHELL/NAP-INC rules at `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; its lack of an IPC carrier remains an intentionally documented experimental spec gap. No later Phase 109 criterion specifically supplies the missing host-level unregister or multi-endpoint shared-runtime binding, so these are not deferred.

---

_Verified: 2026-08-20T13:11:32Z_
_Verifier: the agent (gsd-verifier)_
