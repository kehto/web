---
phase: 102-nap-inc-event-channel-parity
verified: 2026-07-23T21:30:00Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "The first overflowed inbound handle is now retained as a terminal handle for a later onOpened/onClosed sequence."
  gaps_remaining:
    - "Subsequent overflowed inbound handles before the first onOpened registration are still silently dropped."
  regressions: []
gaps:
  - truth: "Every overflowed inbound handle is closed and remains observable rather than being silently dropped before channel.onOpened registers."
    status: failed
    reason: "The one-slot overflow handoff uses `overflowedOpened ??= state`. Once the first overflowed ChannelState is retained, each subsequent inbound inc.channel.opened while the 32-slot pending queue remains full is closed but not retained. A later channel.onOpened receives at most one of those terminal handles, so the others cannot expose onClosed({ reason: 'buffer overflow' })."
    artifacts:
      - path: "packages/shell/src/napplet-namespace.ts"
        issue: "deliverOpened() at lines 466-469 preserves only the first overflowed state; later overflows take the same close path and are discarded."
      - path: "packages/shell/src/napplet-namespace.test.ts"
        issue: "The new regression tests exactly one 33rd inbound channel after filling the queue. It does not send a 34th or later open before onOpened and assert that each terminal handle remains observable."
    missing:
      - "Provide a bounded lifecycle design that does not silently discard any overflowed handle; alternatively, obtain and record an upstream clarification that a close notification without a later-observable handle is sufficient for additional overflows."
      - "Add a regression for at least two overflowed inbound opens before channel.onOpened and prove the contract-selected behavior for each one."
deferred:
  - truth: "The seven remaining full-E2E failures use stale published Napplet packages and legacy fixtures."
    addressed_in: "Phase 105"
    evidence: "Phase 105 explicitly owns adoption of published convention-capable core, nap, shim, SDK, and Vite-plugin releases. The supplied isolated-host run was 69 passed, 1 skipped, 7 failed; the dedicated Phase 102 symmetric-channel spec passed."
---

# Phase 102: NAP-INC Event and Channel Parity Verification Report

**Phase Goal:** Napplets can safely exchange exact stable convention events and authorized channel traffic through one projection binding using runtime-assigned identifiers and attested dTag identities.
**Verified:** 2026-07-23T21:30:00Z
**Status:** gaps_found
**Re-verification:** Yes — after Plan 102-13 gap closure

## Authority Checked

The implementation was checked against draft NAP-INC PR #89 at
`4593ce9e301ce098fd3dad64206fcd6f144fa7af`, web-projection PR #90 at
`896c32c92deee68dc4d10fc1132b62df20cccb6f`, and symmetric-channel PR #92 at
`c5cd06f7be6d4690b303949abb26e87ff62f4729`. The #92 requirement is explicit:
the binding retains an inbound `ChannelHandle` until `channel.onOpened`, retains
terminal closure for later `onClosed`, and a bounded unopened-handle buffer must
close and notify rather than silently drop handles. The upstream
[kehto/web#203 reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495)
confirms those symmetric target-handle and retention semantics.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The shared projection normalizes convention URI query sugar before the wire, rejects invalid forms locally, and resists namespace/domain reassignment. | ✓ VERIFIED | `packages/shell/src/napplet-namespace.ts:163-207` decodes once with literal `+`, rejects fragments, malformed encoding, duplicate decoded names, and query-plus-explicit-payload. |
| 2 | Subscriptions and delivery use exact queryless identity; raw query-bearing wire topics do not match; service routing cannot intercept INC by topic; emitters receive no echo. | ✓ VERIFIED | Exact topic map lookup and source exclusion in `packages/runtime/src/inc-handler.ts:137-150`; generic service dispatch excludes `inc.emit`. |
| 3 | Event/channel identities are runtime-attested dTags and opaque runtime IDs; forged caller data, absent sessions, and ambiguous targets fail closed. | ✓ VERIFIED | Session ingress gate, unique dTag resolution, source-derived sender/peer fields, and focused spoofing/session/ambiguity tests remain green. |
| 4 | The full shared channel API is wired through Paja and playground: symmetric handles, `onOpened`, `on`, `onClosed`, close, broadcast, and informational `list`. | ✓ VERIFIED | The common prelude implements the API and both production host paths inject it before `srcdoc`; current focused proof and supplied dedicated browser scenario cover the normal lifecycle. |
| 5 | Channel access is checked at open, target notification precedes success, lifecycle state is retained in order, overflow closes without drops, and cleanup leaves no live route. | ✗ FAILED — BLOCKER | Plan 102-13 fixes only the first overflow. With the queue still full, the second and subsequent overflowed opens are closed but omitted by `overflowedOpened ??= state`; their terminal handles are silently lost. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Re-verification of the Prior Gap

| Check | Result | Evidence |
| --- | --- | --- |
| First overflowed handle is terminal and delivered late | ✓ VERIFIED | Plan 102-13 test fills 32 entries, opens `c-overflowed-inbound`, then receives it through late `onOpened` and exact late `onClosed`. |
| Terminal handle is inert | ✓ VERIFIED | The same test verifies no local event delivery, `inc.channel.emit`, or duplicate `inc.channel.close`. |
| Repeated overflows before registration are not silently dropped | ✗ FAILED | `overflowedOpened ??= state` stores only the first overflow. The next overflowed `ChannelState` is neither in `pendingOpened` nor otherwise retained. No test exercises this path. |
| Existing queue bound remains finite | ✓ VERIFIED | `pendingOpened` remains capped at 32 and the new one-slot handoff is bounded. This resource bound does not authorize silently dropping later lifecycle handles. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/shell/src/napplet-namespace.ts` | Shared protected binding and bounded symmetric-channel lifecycle | ⚠️ PARTIAL | The first overflow handoff works, but the `??=` branch drops all later overflowed handles before an opened handler attaches. |
| `packages/runtime/src/inc-handler.ts` | Exact event routing and channel lifecycle | ✓ VERIFIED | Runtime-attested dTags, exact lookup, source exclusion, target-open-before-result, opaque IDs, and bilateral teardown. |
| `packages/runtime/src/runtime.ts` | Session and ACL integration | ✓ VERIFIED | Session gate, target authorization at open, and revocation teardown are wired. |
| `packages/paja/src/browser-target-frame.ts` | Paja shared-prelude injection | ✓ VERIFIED | Registers the trusted target before `srcdoc`, then injects the common prelude. |
| `apps/playground/src/shell-host.ts` | Playground shared-prelude injection | ✓ VERIFIED | Captures trusted environment/identity and injects the same prelude. |
| `packages/shell/src/napplet-namespace.test.ts` | Executed overflow regression | ⚠️ PARTIAL | Covers one extra open but lacks repeated-overflow coverage. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Shell prelude | INC runtime | normalized `inc.emit` | ✓ WIRED | Queryless wire envelope reaches registered INC domain handler. |
| Runtime | session registry | authenticated dTag lookup | ✓ WIRED | Event senders, channel peers, and targets never use caller IDs. |
| Runtime | ACL state | open authorization and revocation | ✓ WIRED | Target `relay:read` authorizer is passed to INC runtime; mutation tears down affected routes. |
| Paja/playground | shared prelude | `injectNappletNamespacePrelude` | ✓ WIRED | No host-specific parser/client was found. |
| `deliverOpened()` | late `channel.onOpened()` | `pendingOpened` plus terminal overflow handoff | ✗ PARTIAL | First handoff is wired; further overflows cannot reach a later callback. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Shell binding, first overflow terminal callback, and inert terminal route | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` | 1 file, 20 tests passed | ✓ PASS |
| Shell package typing | `pnpm --filter @kehto/shell type-check` | passed | ✓ PASS |
| Repeated unopened-handle overflow before `onOpened` | Direct trace of `deliverOpened()` | Second overflow is closed but overwritten by neither queue nor handoff state; no later public handle exists. | ✗ FAIL |

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| BASE-04 | ✓ SATISFIED | Shared local convention URI normalizer and rejection matrix. |
| BASE-05 | ✓ SATISFIED | Exact queryless identity routing and no service-prefix interception. |
| INC-01 | ✓ SATISFIED | Queryless wire identity and transposed payload. |
| INC-02 | ✓ SATISFIED | Canonical emit/on, closeable subscriptions, correlated subscribe, fire-and-forget unsubscribe. |
| INC-03 | ✓ SATISFIED | Runtime-attested dTags and opaque runtime IDs only. |
| INC-04 | ✓ SATISFIED | Exact routing and source exclusion. |
| INC-05 | ✓ SATISFIED | Symmetric handle surface and informational list. |
| INC-06 | ✓ SATISFIED | Open-time source/target authorization; membership-only established traffic. |
| INC-07 | ✗ BLOCKED | Dead/revoke/normal close behavior works, but repeated unopened-handle overflow silently loses terminal target handles. |
| INC-08 | ✓ SATISFIED | Correlated requests and fire-and-forget operations retain distinct wire behavior. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| `packages/shell/src/napplet-namespace.ts` | 466-469 | Singleton overflow handoff (`overflowedOpened ??= state`) | 🛑 Blocker | Every overflow after the first is silently dropped before the application can receive a handle or terminal record. |

No `TBD`, `FIXME`, or `XXX` marker was found in the Phase 102 implementation and active documentation surfaces checked. The configured AI-slop executable remains unavailable; this is a final quality-gate limitation, not a reason for the lifecycle gap.

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | Seven stale-package/fixture E2E failures | Phase 105 | The roadmap assigns published-package adoption to Phase 105; the supplied full isolated-host result isolates these seven failures from the passing Phase 102 channel proof. |
| 2 | AI-slop executable unavailable | Phase 106 release gate | It was not installed and was intentionally not fetched. |

## Gaps Summary

Plan 102-13 partially closes the prior defect: the first overflowed target
handle is now terminal, later observable, and inert. It does not establish the
same property for repeated inbound opens while `pendingOpened` is already full.
The `??=` operator deliberately retains only one state, so a second overflow
is indistinguishable to the application from the original silent drop.

Draft #92 permits a finite buffer but does not permit a finite buffer to lose
additional lifecycle handles without notification. Phase 102 therefore remains
blocked until the repeated-overflow behavior is retained/observed under a
bounded conformant policy, or the upstream draft explicitly resolves that
resource-policy ambiguity.

---

_Verified: 2026-07-23T21:30:00Z_
_Verifier: the agent (gsd-verifier)_
