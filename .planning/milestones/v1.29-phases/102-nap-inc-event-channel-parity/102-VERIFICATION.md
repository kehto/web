---
phase: 102-nap-inc-event-channel-parity
verified: 2026-07-26T13:09:29Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "The authenticated runtime now limits either endpoint to 32 live channels before target notification, so every legitimate binding-side opened push is bounded at its source."
    - "The protected binding now retains every trusted-parent opened state until a late onOpened callback drains it; the singleton overflow handoff and N+2 drop no longer exist."
  gaps_remaining: []
  regressions: []
gaps: []
deferred:
  - truth: "Published Napplet package adoption and stale isolated-host fixtures are not Phase 102 work."
    addressed_in: "Phase 105"
    evidence: "Phase 105 owns importing the newly released core, nap, shim, SDK, and Vite-plugin packages and re-running the full host matrix."
---

# Phase 102: NAP-INC Event and Channel Parity Verification Report

**Phase Goal:** Napplets can safely exchange exact stable convention events and authorized channel traffic through one projection binding using runtime-assigned identifiers and attested dTag identities.
**Verified:** 2026-07-26T13:09:29Z
**Status:** passed
**Re-verification:** Yes — after Plan 102-14 gap closure

## Authority Checked

The implementation was checked against merged
`napplet/naps@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24/naps/NAP-INC.md`,
which incorporates NAP-INC PRs #89, #90, and #92.

The merged document requires the projection binding to retain every
`inc.channel.opened` handle until at least one `channel.onOpened` handler
receives it. It separately permits a maximum number of concurrent channels per
napplet and recommends rate-limiting opens and bounding resources. Plan 102-14
uses those two rules together: the authenticated runtime admits at most 32 live
channels for either endpoint before it sends a trusted opened push, while the
binding retains every push it receives.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The shared projection normalizes convention URI query sugar before the wire, rejects invalid forms locally, and resists namespace/domain reassignment. | ✓ VERIFIED | `packages/shell/src/napplet-namespace.ts` retains the shared normalizer and protected domain construction; the executed shell suite covers canonicalization, malformed input, and reassignment. |
| 2 | Subscriptions and delivery use exact queryless identity; raw query-bearing wire topics do not match; service routing cannot intercept INC by topic; emitters receive no echo. | ✓ VERIFIED | Exact topic map lookup and source exclusion remain in `packages/runtime/src/inc-handler.ts:138-176`; the focused runtime and shell suites are green. |
| 3 | Event/channel identities are runtime-attested dTags and opaque runtime IDs; forged caller data, absent sessions, and ambiguous targets fail closed. | ✓ VERIFIED | `packages/runtime/src/inc-handler.ts:196-225` resolves both session identities before allocation; existing spoofing, session, ambiguity, and ordering tests remain green. |
| 4 | The full shared channel API is wired through Paja and playground: symmetric handles, `onOpened`, `on`, `onClosed`, close, broadcast, and informational `list`. | ✓ VERIFIED | The common protected prelude implements the API at `packages/shell/src/napplet-namespace.ts:412-614`; the shell execution suite exercises the complete lifecycle consumed by both host injectors. |
| 5 | Channel access is checked at open, target notification precedes success, lifecycle state is retained in order, resources are bounded without handle loss, and cleanup leaves no live route. | ✓ VERIFIED | Runtime admission and ordering are enforced at `packages/runtime/src/inc-handler.ts:188-225`; bilateral membership removal is at lines 85-95 and 279-334; lossless trusted-parent retention is at `packages/shell/src/napplet-namespace.ts:458-465,494-514,586-591`. |

**Score:** 5/5 truths verified

### Re-verification of the Prior Gap

| Check | Result | Evidence |
| --- | --- | --- |
| Source endpoint cannot exceed 32 live channels | ✓ VERIFIED | Runtime test `caps concurrent channels for the opener and releases both endpoint slots on close` admits 32, rejects a 33rd toward a free target, and observes no target opened push. |
| Target endpoint cannot exceed 32 live channels | ✓ VERIFIED | Runtime test `caps concurrent channels for a target when every opener remains below the limit` uses 33 distinct authenticated source sessions and proves the target receives exactly 32 opened pushes. |
| Capacity is reclaimed for both endpoints | ✓ VERIFIED | The source-capacity regression closes one A↔B channel, then successfully opens A↔C and C↔B replacements. |
| Every trusted-parent opened handle survives late registration | ✓ VERIFIED | Shell test `retains every trusted-parent inbound handle in arrival order until onOpened registers` sends 34 trusted pushes before registration and receives the exact ordered ID vector once. |
| Late registration creates no synthetic terminal lifecycle | ✓ VERIFIED | The same regression observes zero outbound close messages and zero immediate `onClosed` records for all 34 handles. |
| Untrusted lifecycle injection remains excluded | ✓ VERIFIED | A forged non-parent opened push precedes the 34 trusted pushes and is absent from the delivered vector. |
| Per-handle event buffering remains bounded | ✓ VERIFIED | `maxRetainedEvents = 32` and the close-on-overflow branches remain at `packages/shell/src/napplet-namespace.ts:390,467-491`; the adjacent executed regression still passes. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/runtime/src/inc-handler.ts` | Exact routing, authenticated channel lifecycle, and per-endpoint admission control | ✓ VERIFIED | Defines `MAX_CHANNELS_PER_WINDOW = 32`, checks both live membership sets before allocation, and reuses teardown for bilateral release. |
| `packages/runtime/src/runtime.test.ts` | Executed admission-limit, target-silence, ordering, and capacity-release regressions | ✓ VERIFIED | Both source- and target-capacity vectors pass with deterministic unique channel IDs. |
| `packages/shell/src/napplet-namespace.ts` | Protected shared binding with lossless late opened-handle delivery | ✓ VERIFIED | `pendingOpened` is the sole pre-registration retention path and drains in insertion order; no `maxRetainedChannels` or `overflowedOpened` state remains. |
| `packages/shell/src/napplet-namespace.test.ts` | Executed repeated late-open and parent-trust regression | ✓ VERIFIED | Covers 34 retained pushes, ordered exactly-once delivery, no synthetic close/terminal state, and forged-source exclusion. |
| `packages/paja/src/browser-target-frame.ts` | Paja shared-prelude injection | ✓ VERIFIED | The existing host path still registers the trusted target and injects the shared prelude before `srcdoc`. |
| `apps/playground/src/shell-host.ts` | Playground shared-prelude injection | ✓ VERIFIED | The existing host path still injects the same protected shared prelude. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Channel-open request | authenticated runtime membership | session-resolved window IDs plus `channelsByWindow` | ✓ WIRED | The limit checks only runtime-owned source and target window IDs after target and ACL validation. |
| Runtime admission | target lifecycle delivery | limit check before UUID, `addChannel`, and `inc.channel.opened` | ✓ WIRED | An over-limit request returns one correlated normal result and cannot notify the target. |
| Channel teardown | future admission | bilateral `removeChannel` membership deletion | ✓ WIRED | Normal close, destroyed window, revocation, and failed delivery all reach removal paths. |
| Trusted parent push | late napplet callback | `isParentMessage` → `deliverOpened` → `pendingOpened.splice(0)` | ✓ WIRED | Every accepted state drains once and in arrival order to the first registered handler. |
| Paja/playground | shared prelude | `injectNappletNamespacePrelude` | ✓ WIRED | Both host consumers inherit the same corrected binding; no host-specific INC queue exists. |

### Behavioral Verification

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Runtime admission, ordering, target silence, and bilateral capacity release | `pnpm exec vitest run packages/runtime/src/runtime.test.ts` | 1 file, 22 tests passed | ✓ PASS |
| Runtime package typing | `pnpm --filter @kehto/runtime type-check` | passed | ✓ PASS |
| Shell binding, 34-handle late retention, parent trust, and event overflow | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` | 1 file, 23 tests passed | ✓ PASS |
| Shell package typing | `pnpm --filter @kehto/shell type-check` | passed | ✓ PASS |
| Combined Phase 102 focused regression | `pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/shell/src/napplet-namespace.test.ts` | 2 files, 45 tests passed | ✓ PASS |
| Execution diff hygiene | `git diff --check` | passed | ✓ PASS |

### Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| BASE-04 | ✓ SATISFIED | Shared local convention URI normalizer and rejection matrix. |
| BASE-05 | ✓ SATISFIED | Exact queryless identity routing and no service-prefix interception. |
| INC-01 | ✓ SATISFIED | Queryless wire identity and transposed payload. |
| INC-02 | ✓ SATISFIED | Canonical emit/on, closeable subscriptions, correlated subscribe, and fire-and-forget unsubscribe. |
| INC-03 | ✓ SATISFIED | Runtime-attested dTags and opaque runtime IDs only. |
| INC-04 | ✓ SATISFIED | Exact routing and source exclusion. |
| INC-05 | ✓ SATISFIED | Symmetric handle surface and informational list. |
| INC-06 | ✓ SATISFIED | Open-time source/target authorization and membership-only established traffic. |
| INC-07 | ✓ SATISFIED | Ordered early lifecycle, per-endpoint resource admission, lossless late handle delivery, bilateral teardown, and inert terminal routes are all executed. |
| INC-08 | ✓ SATISFIED | Correlated requests and fire-and-forget operations retain distinct wire behavior. |

### Anti-Patterns and Threat Review

- No `maxRetainedChannels`, `overflowedOpened`, or singleton unopened-handle overflow branch remains.
- T-102-39/T-102-40: the 32-channel denial-of-service bound uses only authenticated runtime memberships.
- T-102-41/T-102-42: trusted opened pushes are retained losslessly, while non-parent injection is rejected.
- T-102-43: the independent per-handle event buffer remains bounded and tested.
- T-102-SC: Plan 102-14 installed or upgraded no dependency.
- No unresolved high-severity threat remains in the Plan 102-14 scope.

## Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | Newly published Napplet package adoption and stale isolated-host fixtures | Phase 105 | The roadmap explicitly assigns dependency import and full host-matrix convergence to Phase 105. |
| 2 | Repository-wide release gates | Phase 106 | Full build, type, unit, docs, E2E, AI-slop, and release evidence remain the milestone release-gate scope. |

## Conclusion

The former N+2 lifecycle blocker is closed. The design now places the finite
resource policy where merged NAP-INC permits it—before authenticated runtime
admission—and fulfills the binding's unconditional retention requirement for
every trusted opened push. Phase 102 achieves its goal and is ready to close.

---

_Verified: 2026-07-26T13:09:29Z_
_Verifier: Codex (inline goal-backward verification)_
