---
phase: 102
slug: nap-inc-event-channel-parity
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-23
authority: "napplet/naps PR #89 head 4593ce9e301ce098fd3dad64206fcd6f144fa7af + PR #90 head 896c32c92deee68dc4d10fc1132b62df20cccb6f + stacked PR #92 head c5cd06f7be6d4690b303949abb26e87ff62f4729"
---

# Phase 102 — Validation Strategy

> Per-phase validation contract for the shared convention web binding and
> NAP-INC event/channel parity. Every normative vector is pinned to PR #89 head
> `4593ce9e301ce098fd3dad64206fcd6f144fa7af` and PR #90 head
> `896c32c92deee68dc4d10fc1132b62df20cccb6f`, with symmetric channel
> semantics pinned to PR #92 head
> `c5cd06f7be6d4690b303949abb26e87ff62f4729`.

## Decision Index

`102-CONTEXT.md` groups locked decisions by concern rather than numbering each bullet. The plans use this derived, lossless index for traceability:

| ID | Locked decision |
|----|-----------------|
| D-01 | Use NAP-INC PR #89 head `4593ce9e301ce098fd3dad64206fcd6f144fa7af` and web projection PR #90 head `896c32c92deee68dc4d10fc1132b62df20cccb6f` as proposed Phase 102 authority. |
| D-02 | One projection-owned helper transposes a queried convention URI before the wire for every convention-accepting operation, preserving literal plus/text values and rejecting invalid forms. |
| D-03 | Invalid fire-and-forget calls fail locally and never invent `inc.emit.error`. |
| D-04 | Runtime routing is exact complete-string equality and performs no URI parsing, normalization, prefix, wildcard, or base/query matching. |
| D-05 | The emitter cannot set sender; runtime-attested sender, peer, and target identities exposed to napplets are dTags, while internal window IDs/pubkeys never substitute. |
| D-06 | Implement the complete symmetric channel surface with target opened push before opener success, retained early handle/events/terminal closure, opaque IDs, authorization once at open, and deterministic cleanup. |
| D-07 | The shared shell prelude is the sole Kehto INC binding/client implementation consumed by Paja and playground, and shim/SDK namespace replacement cannot bypass its INC operations. |
| D-08 | Phase 102 creates an intent-reusable parser seam but does not change or test the public intent API; Phase 104 owns URI-authoritative intent binding, replacement protection, resolution, and delivery. |
| D-09 | Published package adoption and conformance remain Phase 105; Phase 102 adds no unreleased public compatibility overload. |
| D-10 | Preserve changelogs, archived planning, migrations, and historical material. |
| D-11 | Generic/service-owned INC topic-prefix interception and senderless synthetic events are retired; canonical service-domain messages remain intact. |
| D-12 | Draft #92 resolves target attachment through `channel.onOpened` / `inc.channel.opened`, symmetric handles, `onClosed`, strict per-endpoint ordering/retention, and informational-only `channel.list`; implement that exact contract. |

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2; Playwright 1.59.1 |
| **Config files** | `vitest.config.ts`; `playwright.config.ts` |
| **Quick runtime command** | `pnpm exec vitest run tests/unit/nap-inc-conformance.test.ts packages/runtime/src/types.test.ts packages/runtime/src/runtime.test.ts packages/runtime/src/dispatch.test.ts packages/runtime/src/service-dispatch.test.ts packages/services/src/notification-service.test.ts packages/acl/src/resolve.test.ts` |
| **Quick client command** | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts packages/paja/src/browser-host.test.ts tests/unit/playground-gateway-guard.test.ts` |
| **Cross-host command** | `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts tests/e2e/nap-inc-playground.spec.ts --workers=1` |
| **Full suite command** | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e && pnpm docs:check && npx --no-install aislop scan -d && git diff --check` |
| **Focused feedback target** | Vitest under 120 seconds; browser checks at plan/wave boundaries |

## Wave Structure and Ownership

| Wave | Plans | Dependency reason |
|------|-------|-------------------|
| 1 | 102-01 | Production tracer proves prelude → wire → exact runtime → dTag event. |
| 2 | 102-02, 102-04, 102-09, 102-10 | Runtime channels, injected API, generic dispatch retirement, and services retirement build independently from the tracer with disjoint ownership. |
| 3 | 102-03, 102-11, 102-12 | ACL mapping/revocation consumes runtime teardown while executable and guidance migrations independently consume Plans 09/10; ownership is disjoint. |
| 4 | 102-05, 102-06 | Paja and playground prove the shared API after runtime, binding, ACL, and active downstream migration. |
| 5 | 102-07 | Active docs and static guard consume both host summaries. |
| 6 | 102-08 | Changesets and full gate run after every behavior/doc artifact exists. |

Same-wave ownership is disjoint:

| Plan | Exclusive files |
|------|-----------------|
| 102-02 | `packages/runtime/src/session-registry.ts`, `packages/runtime/src/types.test.ts`, `packages/runtime/src/inc-handler.ts`, `packages/runtime/src/runtime.test.ts` |
| 102-04 | `packages/shell/src/napplet-namespace.ts`, `packages/shell/src/napplet-namespace.test.ts` |
| 102-09 | `packages/runtime/src/service-dispatch.ts`, `packages/runtime/src/service-dispatch.test.ts` |
| 102-10 | legacy `packages/services` INC surfaces, exports, types, tests, and package metadata |
| 102-03 | ACL resolver/state/runtime integration files |
| 102-11 | active playground service consumers and notification E2E specs |
| 102-12 | active service docs/skills and the active conformance guard |
| 102-05 | `packages/paja/src/browser-host.test.ts`, `tests/e2e/paja-single-window.spec.ts` |
| 102-06 | `tests/unit/playground-gateway-guard.test.ts`, `tests/e2e/nap-inc-playground.spec.ts` |

## Sampling Rate

- **After every TDD RED commit:** Run the task's focused Vitest command and prove it fails for the intended behavioral assertion.
- **After every GREEN commit:** Re-run the same command to green before refactoring or committing.
- **After Wave 2:** Run both quick runtime and quick client commands.
- **After Wave 3:** Run `pnpm test:unit`.
- **After Wave 4:** Run the cross-host command with `workers=1`.
- **Before Phase 102 verification:** Run the complete Plan 102-08 gate without watch mode or dependency installation.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure behavior | Test type | Automated command | File exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 102-01-01 | 102-01 | 1 | BASE-04, BASE-05, INC-01, INC-02, INC-03, INC-04, INC-08 | T-102-01..03 | Shared query transposition crosses exact runtime routing, yields an attested dTag event, and sessionless emit/subscribe/open fail closed | tracer/integration | `pnpm exec vitest run tests/unit/nap-inc-conformance.test.ts packages/runtime/src/dispatch.test.ts` | ✅ created/extended | ✅ green |
| 102-02-01 | 102-02 | 2 | INC-03 | T-102-04 | Only one live dTag resolves; missing/duplicate/window/pubkey inputs fail closed | unit | `pnpm exec vitest run packages/runtime/src/types.test.ts` | ✅ extended | ✅ green |
| 102-02-02 | 102-02 | 2 | INC-03, INC-04, INC-05, INC-07, INC-08 | T-102-04..07 | Channel identity, target-opened-before-success ordering, opaque IDs, membership, and teardown are complete | integration | `pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/runtime/src/types.test.ts` | ✅ extended | ✅ green |
| 102-03-01 | 102-03 | 3 | INC-06, INC-08 | T-102-08..09 | Existing ACL checks channel open only; established actions use membership | unit | `pnpm exec vitest run packages/acl/src/resolve.test.ts` | ✅ extended | ✅ green |
| 102-03-02 | 102-03 | 3 | INC-06, INC-07 | T-102-08..11 | Denied opens create no state; relevant revoke/block closes established routes | integration | `pnpm exec vitest run packages/runtime/src/acl-state.test.ts packages/runtime/src/dispatch.test.ts packages/acl/src/resolve.test.ts` | ✅ extended | ✅ green |
| 102-04-01 | 102-04 | 2 | BASE-04, BASE-05, INC-01, INC-02, INC-08 | T-102-12..14 | Full parser rejection matrix, INC replacement safety, exact IncEvent, independent local subscriptions, prescribed transport, with no intent API change | unit | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` | ✅ extended | ✅ green |
| 102-04-02 | 102-04 | 2 | INC-05, INC-07, INC-08 | T-102-13..15 | Symmetric channel API with exact correlation/push filtering, opened-event-closed ordering, early-data retention, overflow close, and cleanup | unit | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` | ✅ extended | ✅ green |
| 102-09-01 | 102-09 | 2 | BASE-05, INC-04 | T-102-29 | Generic dispatch never routes INC by topic prefix and retains exact direct-domain service routing | unit | `pnpm exec vitest run packages/runtime/src/service-dispatch.test.ts` | ✅ created | ✅ green |
| 102-10-01 | 102-10 | 2 | BASE-05, INC-03, INC-04 | T-102-30..31 | Notification service ignores all INC traffic, fabricates no event, and preserves canonical direct notify handling | unit | `pnpm exec vitest run packages/services/src/notification-service.test.ts` | ✅ extended | ✅ green |
| 102-10-02 | 102-10 | 2 | BASE-05 | T-102-31 | Legacy audio exports/types/source are absent while the services package type-checks and builds | static/build | `pnpm --filter @kehto/services type-check && pnpm --filter @kehto/services build` | ✅ extended | ✅ green |
| 102-11-01 | 102-11 | 3 | BASE-05, INC-03, INC-04 | T-102-32..33 | Active playground code and notification browser flows use direct notify messages with no legacy INC path | browser/build | `pnpm --filter @kehto/playground build && pnpm exec playwright test tests/e2e/demo-notification-service.spec.ts tests/e2e/notify-lifecycle.spec.ts --workers=1` | ✅ extended | ✅ green |
| 102-12-01 | 102-12 | 3 | BASE-05, INC-03, INC-04 | T-102-34..35 | Active docs/skills teach exact routing and the scoped guard blocks legacy executable behavior while preserving history | static/docs | `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts && pnpm docs:check` | ✅ extended | ✅ green |
| 102-05-01 | 102-05 | 4 | BASE-04, BASE-05, INC-01, INC-02, INC-05 | T-102-16..17 | Paja URL/pointer modes inject one replacement-safe shared binding after trusted registration | static/unit | `pnpm exec vitest run packages/paja/src/browser-host.test.ts` | ✅ extended | ✅ green |
| 102-05-02 | 102-05 | 4 | INC-01, INC-02, INC-05, INC-08 | T-102-16..18 | Real Paja srcdoc proves producer, event, correlation/error, fire-and-forget, and reload cleanup | browser | `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1` | ✅ extended | ✅ green |
| 102-06-01 | 102-06 | 4 | BASE-04, BASE-05, INC-01, INC-02 | T-102-19..20 | Playground registers identity then injects one shared binding that survives shim assignment; host has no parser/client fork | static/unit | `pnpm exec vitest run tests/unit/playground-gateway-guard.test.ts` | ✅ extended | ✅ green |
| 102-06-02 | 102-06 | 4 | INC-01..INC-08 | T-102-19..22 | Two live dTags prove event transposition, exact isolation, symmetric public handles, bidirectional traffic, ordering/retention, and cleanup | browser | `pnpm exec playwright test tests/e2e/nap-inc-playground.spec.ts --workers=1` | ✅ created | ✅ green |
| 102-07-01 | 102-07 | 5 | BASE-04, BASE-05, INC-01..INC-08 | T-102-23..25 | Active source/docs cite all three Phase 102 heads and preserve shared-binding, intent-lifecycle, package, and history boundaries | static/docs | `pnpm exec vitest run tests/unit/nip5d-conformance-guard.test.ts && pnpm docs:check` | ✅ extended | ✅ green |
| 102-08-01 | 102-08 | 6 | INC-01..INC-08 | T-102-26..28 | Package metadata and complete focused/cross-host phase evidence agree; full E2E package-adoption and unavailable aislop gates are external to Phase 102 behavior | release/verification | Plan 102-08 full command | ✅ created | ⚠️ partial (external gates) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Wave 0 / Tracer Requirements

- [x] No framework or package installation is required.
- [x] Plan 102-01 begins RED by creating `tests/unit/nap-inc-conformance.test.ts`, the cross-package tracer missing from the current suite.
- [x] Plan 102-09 creates `packages/runtime/src/service-dispatch.test.ts` before removing the generic prefix fallback.
- [x] Plans 102-10 through 102-12 extend existing unit/browser/guard coverage before retiring service-owned compatibility and downstream consumers/guidance.
- [x] Plan 102-06 creates `tests/e2e/nap-inc-playground.spec.ts` before relying on two-frame browser proof.
- [x] All other tasks extend named existing tests fail-first; no task has a `MISSING` verify without an owning creation task.
- [x] Reload-heavy browser tests set 120000 timeouts and run with `workers=1`.

## Full Cross-Host Proof

The phase does not equate a unit test with host conformance:

1. `tests/unit/nap-inc-conformance.test.ts` proves the core prelude/runtime seam in memory.
2. `tests/e2e/paja-single-window.spec.ts` executes the shared API in Paja's opaque-origin srcdoc, including reload cleanup.
3. `tests/e2e/nap-inc-playground.spec.ts` crosses two distinct playground dTags for event and channel routing.
4. `packages/runtime/src/service-dispatch.test.ts` and the service guard prove
   no exact-route bypass survives outside `IncRuntime`.
5. The canonical notification lifecycle specs prove the retired compatibility
   prefixes are not required by active service behavior.
6. The Plan 102-08 command runs all four focused browser specs together after
   runtime, ACL, namespace, service, docs, and guard tests are green.

## Multi-Source Coverage Audit

| SOURCE | ID | Feature / requirement | Plan | Status | Notes |
|--------|----|-----------------------|------|--------|-------|
| GOAL | — | Safe exact convention events and authorized dTag channels | 01-12 | COVERED | Tracer through package gate and cross-host closeout. |
| REQ | BASE-04 | Shared URI-to-payload binding | 01, 04, 05, 06, 07, 08 | COVERED | INC uses one reusable parser; intent wiring remains Phase 104. |
| REQ | BASE-05 | Exact normalized resolution | 01, 04, 06, 07, 08, 09, 10, 11 | COVERED | No runtime parser, proxy bypass, service-owned topic interpretation, or topic-prefix interception. |
| REQ | INC-01 | Producer transposition plus exact stable routing | 01, 04, 05, 06, 07, 08 | COVERED | Positive and raw-wire negative vectors. |
| REQ | INC-02 | Canonical emit/on and closeable subscriptions | 01, 04, 05, 06, 08 | COVERED | Executed prelude plus both hosts. |
| REQ | INC-03 | dTag-only sender/peer/target | 01, 02, 06, 08, 10, 11 | COVERED | Unique live target, delivery assertions, and no senderless service events. |
| REQ | INC-04 | Exact routing, sender exclusion, payload, opaque IDs | 01, 02, 06, 08, 09, 10, 11 | COVERED | Unit/tracer/browser evidence plus no generic or service-owned prefix interception. |
| REQ | INC-05 | Complete injected channel surface | 02, 04, 05, 06, 08 | COVERED | Client and runtime contracts. |
| REQ | INC-06 | Authorization once at open | 03, 06, 08 | COVERED | Resolver and dispatch tests. |
| REQ | INC-07 | Dead/close/destroy/revoke lifecycle | 02, 03, 06, 08 | COVERED | Unified teardown plus browser graceful close. |
| REQ | INC-08 | Correlation versus fire-and-forget | 01, 02, 03, 04, 05, 06, 08 | COVERED | Negative wire-shape assertions included. |
| RESEARCH | R-01 | Projection-only shared transposition; no runtime parser | 01, 04, 05, 06, 07 | COVERED | Binding ownership and replacement safety preserved. |
| RESEARCH | R-02 | Unique dTag lookup and no window/pubkey fallback | 02 | COVERED | Duplicate live dTags fail closed. |
| RESEARCH | R-03 | Open-time ACL and revocation teardown | 03 | COVERED | Existing relay:read policy, no new capability. |
| RESEARCH | R-04 | One shared prelude for Paja/playground | 04, 05, 06 | COVERED | Static and behavioral proof. |
| RESEARCH | R-05 | Two real host paths and full gate | 05, 06, 08 | COVERED | Cross-host command is explicit. |
| RESEARCH | R-06 | No external package install/upgrade | 01-12 | COVERED | T-102-SC repeated; Phase 105 gate preserved. |
| CONTEXT | D-01 | Exact proposed PR heads | 01, 07, 08 | COVERED | Tests/docs/changesets cite both. |
| CONTEXT | D-02 | Convention URI emission | 01, 04, 05, 06 | COVERED | Full parser matrix and hosts. |
| CONTEXT | D-03 | Local reject; no emit error | 04 | COVERED | Absence of postMessage asserted. |
| CONTEXT | D-04 | Exact runtime routing | 01, 06, 07 | COVERED | Raw-wire negative proof. |
| CONTEXT | D-05 | dTag identity | 01, 02, 06 | COVERED | All exposed fields checked. |
| CONTEXT | D-06 | Complete authorized channel lifecycle | 02, 03, 04, 06 | COVERED | Runtime, policy, client, browser. |
| CONTEXT | D-07 | Shared replacement-safe prelude | 04, 05, 06 | COVERED | No host implementation fork or shim bypass. |
| CONTEXT | D-08 | Intent-reusable parser only; all public intent work stays Phase 104 | 01, 04, 07, 08 | COVERED | No intent API smoke or partial wire contract. |
| CONTEXT | D-09 | Package adoption stays Phase 105 | 03, 04, 07, 08 | COVERED | No upgrade/compatibility claim. |
| CONTEXT | D-10 | Preserve history | 07 | COVERED | Active guard is scoped. |
| CONTEXT | D-11 | Retire prefix-routed service compatibility | 09, 10, 11, 12 | COVERED | Generic runtime dispatch, services package, examples/tests, and active guidance have separate owners. |
| CONTEXT | D-12 | Exact symmetric handle contract from PR #92 | 02, 04, 06, 07, 08 | COVERED | Target push, both handles, ordering/retention, onClosed, and informational list. |

Deferred ideas are excluded rather than missing: NAP-INTENT resolution and
delivery lifecycle, published Napplet dependency adoption, and the Phase 106
active-surface release sweep.

## Manual-Only Verifications

All Phase 102 behaviors have automated proof. No human-only checkpoint is required.

## Validation Sign-Off

- [x] Every task has an `<automated>` verify command.
- [x] TDD-eligible behavior starts with explicit RED cases.
- [x] No three consecutive tasks lack automated feedback.
- [x] Wave 0 owns every new missing test file before implementation relies on it.
- [x] Same-wave plans have disjoint file ownership.
- [x] Both Paja and playground are behaviorally exercised.
- [x] Every goal, binding/INC requirement, research constraint, and locked context decision is covered.
- [x] No watch-mode flag, package install, or unpublished API assumption is present.
- [x] `nyquist_compliant: true` and `wave_0_complete: true` are set.

**Approval:** validated 2026-07-23 — all Phase 102 behavior rows are green; the Plan 102-08 aggregate gate is partial only for the external Phase 105 package-adoption failures and unavailable aislop executable. No manual-only Phase 102 behavior remains.

## Validation Audit 2026-07-23

| Metric | Count |
|--------|-------|
| Plans/SUMMARYs reconciled | 12/12 |
| Phase requirements reconciled | 10/10 (BASE-04, BASE-05, INC-01..INC-08) |
| Per-task rows green | 17/18 |
| Per-task rows partial (external, non-behavioral) | 1/18 (102-08-01) |
| New behavioral tests required | 0 |
| Escalated Phase 102 implementation gaps | 0 |

### Audit Evidence

- Fresh audit run: `pnpm exec vitest run tests/unit/nap-inc-conformance.test.ts packages/runtime/src/types.test.ts packages/runtime/src/runtime.test.ts packages/runtime/src/acl-state.test.ts packages/runtime/src/dispatch.test.ts packages/runtime/src/service-dispatch.test.ts packages/acl/src/resolve.test.ts packages/shell/src/napplet-namespace.test.ts packages/services/src/notification-service.test.ts packages/paja/src/browser-host.test.ts tests/unit/playground-gateway-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts` — **12 files, 314 tests passed**.
- Review-fix regression run: `pnpm exec vitest run packages/runtime/src/runtime.test.ts packages/runtime/src/dispatch.test.ts packages/services/src/notification-service.test.ts tests/unit/flow-animator-path.test.ts` — **4 files, 111 tests passed**. This includes target ACL denial/open-result teardown, owner-scoped notification mutation, contract-defined INC denials, and host-originated notification animation.
- Executed plan evidence: the Phase 102 focused proof recorded **12 files, 309 tests passed**; browser proofs recorded Paja **6**, playground channel **1**, and notification **7** tests passed. The correct-host full E2E result, **69 passed / 1 skipped / 7 failed**, is not a Phase 102 gap: the seven failures are the separately owned Phase 105 published-package-adoption gate.
- `aislop` remains unavailable and was deliberately not installed; it is an environment limitation, not an automated behavioral coverage gap.
- Authority remains the exact draft heads: NAP-INC #89 `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, web projection #90 `896c32c92deee68dc4d10fc1132b62df20cccb6f`, and symmetric channels #92 `c5cd06f7be6d4690b303949abb26e87ff62f4729`.
