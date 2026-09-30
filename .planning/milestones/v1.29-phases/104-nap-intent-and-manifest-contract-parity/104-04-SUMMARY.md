---
phase: 104-nap-intent-and-manifest-contract-parity
plan: 04
subsystem: authenticated-intent-runtime
tags: [nap-intent, runtime-context, acl, attestation, retained-delivery]
requires:
  - phase: 104-nap-intent-and-manifest-contract-parity
    plan: 03
    provides: exact resolver outcomes and retained delivery task
provides:
  - narrow policy-aware registered-service runtime context
  - canonical intent denial and recipient direction
  - authenticated validation and result-before-start orchestration
  - live eligible client intent change broadcasts
affects: [104-05, 105, 106]
tech-stack:
  added: []
  patterns: [optional service lifecycle, recipient-capability send gate, one-result retained orchestration]
key-files:
  created: []
  modified:
    - packages/runtime/src/types.ts
    - packages/runtime/src/runtime.ts
    - packages/runtime/src/domain-results.ts
    - packages/runtime/src/intent-dispatch.test.ts
    - packages/services/src/intent-service.ts
    - packages/services/src/intent-service.test.ts
    - packages/acl/src/resolve.ts
key-decisions:
  - "Registered services receive one frozen context of live identity snapshots and policy-aware recipient send closures, never mutable runtime authorities."
  - "Only invoke, available, and handlers are source intent requests; deliver, changed, and sanctioned results are recipient-only, while unknown and obsolete actions have no direction."
  - "The service rejects malformed or unattested invocation before resolution, sends one retained outcome result, then starts target policy without any second-result path."
patterns-established:
  - "Static and dynamic services share exactly-once attach/detach semantics across replacement, unregister, and runtime destroy."
  - "Change broadcasts enumerate current sessions and recheck liveness, immutable domain, recipient mapping, and current ACL at each send."
requirements-completed: [INTENT-02, INTENT-07, INTENT-08, INTENT-09, INTENT-11]
coverage:
  - id: D1
    description: Static and dynamic services receive narrow frozen live identity/send access with exactly-once cleanup.
    requirement: INTENT-07
    verification:
      - kind: unit
        ref: packages/runtime/src/intent-dispatch.test.ts#service runtime context
        status: pass
    human_judgment: false
  - id: D2
    description: ACL and firewall denials use sanctioned fixed intent results and runtime pushes have recipient-only capability direction.
    requirement: INTENT-02
    verification:
      - kind: unit
        ref: packages/runtime/src/intent-dispatch.test.ts#canonical denial results
        status: pass
      - kind: unit
        ref: packages/acl/src/resolve.test.ts#intent domain
        status: pass
    human_judgment: false
  - id: D3
    description: Strict normalized validation and authenticated sender derivation precede resolution, then one source result precedes retained task start.
    requirement: INTENT-08
    verification:
      - kind: unit
        ref: packages/services/src/intent-service.test.ts#intent.invoke validation and attestation
        status: pass
      - kind: unit
        ref: packages/services/src/intent-service.test.ts#retained acceptance ordering
        status: pass
    human_judgment: false
  - id: D4
    description: Resolver changes enumerate current sessions without request history and attempt only policy-aware recipient sends while registered.
    requirement: INTENT-11
    verification:
      - kind: unit
        ref: packages/services/src/intent-service.test.ts#intent.changed live-client broadcast
        status: pass
    human_judgment: false
duration: 14min
completed: 2026-07-26
status: complete
---

# Phase 104 Plan 04: Authenticated Runtime Intent Orchestration Summary

**Kehto now joins exact retained intent resolution to live authenticated runtime identity, sanctioned denial direction, one-result ordering, and current policy-aware discovery delivery.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-26T15:41:00+01:00
- **Completed:** 2026-07-26T15:55:00+01:00
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added an optional frozen service runtime context that resolves live dTags,
  snapshots current windows, and sends only recipient-mapped messages after
  current liveness, immutable domain, and ACL checks.
- Corrected intent ACL direction and both ACL/firewall denial exits so only
  sanctioned request/result and runtime-push messages exist and no policy detail
  leaks through invocation rejection.
- Rebuilt the reference service around strict normalized request validation,
  runtime-attested sender, retain/result/start ordering, contained terminal
  failure, and live-session change broadcasts without callback history.

## Task Commits

1. **Task 1: Attach a registered service to narrow authenticated runtime access** — `f23a3cb`
2. **Task 2: Shape intent policy denial and delivery direction exactly** — `8eb66c3`
3. **Task 3: Validate, attest, accept, and broadcast through the reference service** — `66d8e3b`

## Files Created/Modified

- `packages/runtime/src/types.ts` — Public narrow service context and optional registration lifecycle.
- `packages/runtime/src/index.ts` — Public `ServiceRuntimeContext` export.
- `packages/runtime/src/runtime.ts` — Frozen context, current recipient gate, and exactly-once attachment cleanup.
- `packages/runtime/src/domain-handlers.ts` — Three-action source intent allowlist.
- `packages/runtime/src/domain-results.ts` — Fixed non-sensitive sanctioned intent denial shaping.
- `packages/runtime/src/intent-dispatch.test.ts` — Runtime attachment, eligibility, denial, silence, and cleanup regressions.
- `packages/acl/src/resolve.ts` — Exact source/recipient intent direction map.
- `packages/acl/src/resolve.test.ts` — Invoke/read/deliver/result/unknown direction matrix.
- `packages/services/src/intent-service.ts` — Validation, sender attestation, result-before-start, and live change orchestration.
- `packages/services/src/intent-service.test.ts` — Malformed matrix, identity, ordering, failure, infrastructure, and broadcast coverage.
- `packages/services/src/manifest-intent-dispatch.test.ts` — Exact contract/retained controller fixture needed for package-wide validation.

## Authority Check

Checked `napplet/naps` draft PR #91 at
`a718915ddefa2f03a0126579601f59d8bd86f7c4` immediately before denial and
service implementation. Its wire table, structured rejection, sender
attestation, result-before-lifecycle, delivery direction, and change
notification rules remain unchanged. This runtime/service join conforms to
that exact draft.

## Decisions Made

- Capture the adapter's domain and transport functions when constructing the
  frozen service context so later hook reassignment cannot mutate established
  runtime policy.
- Require a recipient capability mapping before service-originated target send;
  source-only and unknown envelopes fail closed even for an otherwise live,
  granted target.
- Reject any request field outside the exact canonical allowlist, but keep
  payload completely opaque—including sender-looking payload keys.
- Keep availability and handler catalog infrastructure failures as sanctioned
  top-level errors while normalizing every invoke failure under its structured
  result.
- Subscribe to resolver changes only while registered and use current runtime
  enumeration at notification time.

## Deviations from Plan

### Auto-fixed: public runtime context export

- **Found during:** Task 1
- **Issue:** The plan introduced a public context type in `types.ts` but omitted
  the package entrypoint from its file list.
- **Fix:** Re-exported `ServiceRuntimeContext` from `packages/runtime/src/index.ts`.
- **Why required:** Services compile against the package boundary rather than
  importing runtime internals.

### Auto-fixed: stale integrated services fixture

- **Found during:** Task 3 package type-check
- **Issue:** `manifest-intent-dispatch.test.ts` was the last consumer of the
  removed `nap` manifest field, window controller, missing convention request,
  direct unattached service, and handled-state result.
- **Fix:** Mechanically aligned its fixture with exact convention contracts,
  retained targets, runtime attachment, and canonical result shape.
- **Why required:** This closed the recorded cross-wave service type-check
  transition without adding the live host controller reserved for Plans
  104-05 and Phase 105.

## Verification

- Full plan matrix across runtime dispatch/lifecycle, service orchestration,
  resolver, integrated manifest dispatch, and ACL direction — 211 passed.
- Unrelated firewall and general runtime dispatch regressions — 116 passed.
- `pnpm --filter @kehto/runtime type-check` — passed.
- `pnpm --filter @kehto/services type-check` — passed.
- `pnpm --filter @kehto/acl type-check` — passed.
- No active invented intent error message type remains in runtime or ACL source/tests.
- No runtime-to-services import was introduced.
- `git diff --check` — passed.
- No package manifest, lockfile, or dependency changes.
- AI-slop gate — unavailable; the workspace contains no configured script or installed executable.

## User Setup Required

None.

## Next Phase Readiness

Plan 104-05 can focus on the complete integrated source-destroyed/target-ready
flow, active consumer cleanup, documentation, and phase closure. All previously
deferred services type errors are now resolved.

## Self-Check: PASSED

- All eleven modified files exist and task commits `f23a3cb`, `8eb66c3`, and
  `66d8e3b` are present.
- The 211-test plan matrix and all three affected package type-checks pass.
- Runtime services receive no raw hook, registry, ACL, or mutable authority.
- No dependency adoption, live Paja/playground controller, generated docs, or
  changeset work entered this plan.
