---
phase: 102-nap-inc-event-channel-parity
verified: 2026-07-23T21:12:00Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Channel overflow closes rather than silently dropping an unopened target handle, and the terminal closure remains observable."
    status: failed
    reason: "When pendingOpened is full, deliverOpened closes the newly materialized ChannelState but does not retain it in pendingOpened. A later channel.onOpened() receives no handle, so the target cannot observe that terminal close through ChannelHandle.onClosed(). This is an observable drop of the incoming handle contrary to draft NAP-INC #92."
    artifacts:
      - path: "packages/shell/src/napplet-namespace.ts"
        issue: "deliverOpened() returns immediately after closeChannelState() at lines 464-467 without retaining the closed state for a later onOpened subscriber."
      - path: "packages/shell/src/napplet-namespace.test.ts"
        issue: "The overflow regression covers only messages after a handle was already delivered; it does not fill the unopened-handle queue and assert later handle/closure delivery."
    missing:
      - "Retain an overflowed inbound handle in a terminal state (or otherwise make its terminal record observable to a later channel.onOpened/onClosed registration) while still sending inc.channel.close."
      - "Add a regression that fills the unopened-handle buffer, opens one more inbound channel, then proves a later onOpened receives its closed handle and onClosed receives reason 'buffer overflow'."
deferred:
  - truth: "The seven remaining full-E2E failures use stale published Napplet packages and legacy fixtures."
    addressed_in: "Phase 105"
    evidence: "Phase 105 depends on published convention-capable core, nap, shim, SDK, and Vite-plugin releases and owns released-package adoption; the supplied isolated-host run was 69 passed, 1 skipped, 7 failed while the Phase 102 symmetric-channel spec passed."
---

# Phase 102: NAP-INC Event and Channel Parity Verification Report

**Phase Goal:** Napplets can safely exchange exact stable convention events and authorized channel traffic through one projection binding using runtime-assigned identifiers and attested dTag identities.
**Verified:** 2026-07-23T21:12:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Authority Checked

This verification compared the implementation with draft NAP-INC PR #89 at
`4593ce9e301ce098fd3dad64206fcd6f144fa7af`, web-projection PR #90 at
`896c32c92deee68dc4d10fc1132b62df20cccb6f`, and symmetric-channel PR #92
at `c5cd06f7be6d4690b303949abb26e87ff62f4729`. It also checked the resolution
recorded in [kehto/web#203](https://github.com/kehto/web/issues/203#issuecomment-5060904495).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The shared projection normalizes convention URI query sugar before the wire, rejects invalid forms locally, and resists namespace/domain reassignment. | ✓ VERIFIED | `packages/shell/src/napplet-namespace.ts:163-207` decodes once with literal `+`, rejects fragments, malformed encodings, duplicate decoded names, and query-plus-explicit-payload. The executed prelude suite covers normalization and protected assignment. |
| 2 | Subscriptions and delivery use exact queryless identity, raw query-bearing wire topics do not match, service routing cannot intercept INC by topic, and emitters receive no echo. | ✓ VERIFIED | `inc-handler.ts:137-150` looks up the complete topic string and excludes the source; `service-dispatch.ts:32-33` refuses `inc.emit`. The focused tracer proves the raw queried topic does not base-match. |
| 3 | Event/channel identities are runtime-attested dTags and opaque runtime IDs; forged caller data, absent sessions, and ambiguous targets fail closed. | ✓ VERIFIED | Session ingress gate precedes dispatch in `runtime.ts:318-323`; `session-registry.ts:getWindowIdByDTag()` rejects duplicates; runtime tests cover forged sender, ambiguous dTag, window ID, pubkey, target ACL denial, and sessionless INC. |
| 4 | The complete subscription/channel API is wired through the shared Paja and playground prelude: symmetric handles, `onOpened`, `on`, `onClosed`, close, broadcast, and informational `list`. | ✓ VERIFIED | `napplet-namespace.ts:372-608` implements the complete API; Paja and playground inject that same prelude before `srcdoc` (`browser-target-frame.ts:81-101`, `shell-host.ts:526-549`). The focused suite passed 313 assertions, and the supplied isolated-host E2E result confirms the dedicated symmetric-channel browser scenario passed. |
| 5 | Open-time authorization, target-open-before-success, retained lifecycle state, overflow closure, and teardown leave no live route. | ✗ FAILED — BLOCKER | Open authorization/order/teardown are covered, but unopened-handle buffer overflow at `napplet-namespace.ts:464-467` drops the terminal target handle instead of retaining a later-observable closed handle. This violates the #92 overflow rule. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/shell/src/napplet-namespace.ts` | Shared protected convention binding and symmetric channel client | ⚠️ PARTIAL | Substantive and wired to both hosts, but its unopened-handle overflow branch loses the retained target handle. |
| `packages/runtime/src/inc-handler.ts` | Exact event routing and channel lifecycle | ✓ VERIFIED | Runtime-attested dTags, exact map lookup, source exclusion, target notification before success, opaque IDs, bilateral teardown. |
| `packages/runtime/src/runtime.ts` | Session/ACL integration | ✓ VERIFIED | Session gate plus target-side `relay:read` authorizer is passed into `createIncRuntime`. |
| `packages/runtime/src/service-dispatch.ts` | Direct-domain-only service dispatch | ✓ VERIFIED | INC is not generic-service routed by topic. |
| `packages/paja/src/browser-target-frame.ts` | Paja shared-prelude injection before source execution | ✓ VERIFIED | Registers frame before assigning `srcdoc`, then calls `injectNappletNamespacePrelude`. |
| `apps/playground/src/shell-host.ts` | Playground shared-prelude injection | ✓ VERIFIED | Captures identity/environment and injects the same shell prelude into verified bytes. |
| `tests/e2e/nap-inc-playground.spec.ts` | Two-frame end-to-end contract | ✓ VERIFIED | Tests exact URI transposition, source exclusion, forged sender overwrite, #92 ordering, symmetric handles, retention, terminal close, and informational list. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Shell prelude | INC runtime | normalized `inc.emit` envelope | ✓ WIRED | `emit()` posts queryless `inc.emit`; `runtime.ts` registers `incRuntime.handleMessage` as the INC domain handler. |
| Runtime | session registry | trusted dTag lookup | ✓ WIRED | Event sender, channel peer, and target resolution use `getEntryByWindowId` / `getWindowIdByDTag`, never caller fields. |
| Runtime | ACL state | authorization/revocation | ✓ WIRED | `runtime.ts:431-497` revokes channels on relevant policy mutation and checks target `relay:read` during open. |
| Paja/playground | shared prelude | `injectNappletNamespacePrelude` | ✓ WIRED | Both production host paths import the shell helper; no separate parser/client was found. |
| Service dispatcher | direct services | `message.type` domain | ✓ WIRED | `notify.*` routes by direct domain; `inc.emit` is excluded from generic routing. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Runtime, binding, ACL, service, host-guard, and documentation contract matrix | `pnpm exec vitest run tests/unit/nap-inc-conformance.test.ts packages/runtime/src/types.test.ts packages/runtime/src/runtime.test.ts packages/runtime/src/dispatch.test.ts packages/runtime/src/service-dispatch.test.ts packages/services/src/notification-service.test.ts packages/acl/src/resolve.test.ts packages/shell/src/napplet-namespace.test.ts packages/paja/src/browser-host.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/flow-animator-path.test.ts` | 12 files, 313 tests passed | ✓ PASS |
| Unopened-handle overflow retention | Code trace of `deliverOpened()` and its regression coverage | The 33rd unopened handle is closed and not queued; later `onOpened()` cannot expose it. | ✗ FAIL |

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| BASE-04 | ✓ SATISFIED | Shared `normalizeConventionUri()` transposes query text locally and the binding tests exercise rejection vectors. |
| BASE-05 | ✓ SATISFIED | Exact topic map and direct message-type routing; raw query-bearing topic negative proof. |
| INC-01 | ✓ SATISFIED | Queryless wire and subscription identity with binding-owned payload transposition. |
| INC-02 | ✓ SATISFIED | `emit`, closeable `on`, correlated subscribe and fire-and-forget unsubscribe are implemented and tested. |
| INC-03 | ✓ SATISFIED | Authenticated source dTags only; forged, missing, ambiguous, pubkey/window-ID vectors fail closed. |
| INC-04 | ✓ SATISFIED | Exact lookup and source exclusion are runtime behavior, with a focused cross-package tracer. |
| INC-05 | ✓ SATISFIED | Complete symmetric API and informational-only `channel.list()` are exercised by binding and browser tests. |
| INC-06 | ✓ SATISFIED | Source and target ACL are checked at open; established traffic is membership-routed; revocation tears down routes. |
| INC-07 | ✗ BLOCKED | The lifecycle contract’s unopened-handle overflow branch silently drops the affected target handle. |
| INC-08 | ✓ SATISFIED | Correlated open/list versus fire-and-forget emit/unsubscribe/channel traffic are separated and covered. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| `packages/shell/src/napplet-namespace.ts` | 464-467 | Bounded unopened-handle overflow closes but does not retain the closed state for delivery | 🛑 Blocker | Breaks observable target lifecycle semantics and the #92 overflow guarantee. |

No untracked `TBD`, `FIXME`, or `XXX` marker was found in the Phase 102 implementation and active documentation surfaces scanned. The ordinary `return null`/empty fallbacks found are type-guard or optional-domain paths, not stubs.

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | Seven full-E2E failures caused by stale published packages/legacy fixtures | Phase 105 | Roadmap Phase 105 explicitly owns published convention-capable package adoption; this phase’s dedicated symmetric-channel test passed in the supplied 69 passed / 1 skipped / 7 failed run. |
| 2 | AI-slop executable unavailable | Phase 106 final release gate | It was unavailable on `PATH`; no dependency was installed. This is a quality-gate deferral, not evidence against the implemented INC behavior. |

## Gaps Summary

Phase 102 is not complete. The shared binding correctly closes a channel when the
unopened-handle queue reaches its bound, but it then discards the very handle
whose terminal close must remain observable. That is not a harmless internal
resource policy: the target application can register `channel.onOpened()` later
and will never receive a `ChannelHandle`, so it cannot learn the terminal
`buffer overflow` closure via `onClosed()`.

The seven package/fixture E2E failures are specifically bounded to Phase 105
and do not cause this verdict. The unopened-handle loss is an in-phase,
observable violation of the proposed #92 channel contract and blocks Phase 102
until fixed and regression-tested.

---

_Verified: 2026-07-23T21:12:00Z_  
_Verifier: the agent (gsd-verifier)_
