---
phase: 104
slug: nap-intent-and-manifest-contract-parity
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-26
---

# Phase 104 — Validation Strategy

> Feedback contract for exact NAP-INTENT binding, manifest resolution, runtime
> acceptance, and retained target delivery.

## Authority

- NAP-INTENT draft PR #91:
  `a718915ddefa2f03a0126579601f59d8bd86f7c4`
- Merged web projection:
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`
- Released-source implementation:
  `napplet/web@dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b`

The draft head must be rechecked at execution and final verification.

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | Vitest 4.1.2; TypeScript package type-checks |
| **Config file** | `vitest.config.ts`, package `tsconfig.json` files |
| **Binding command** | `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` |
| **Manifest command** | `pnpm exec vitest run packages/nip/src/5d/index.test.ts packages/services/src/manifest-intent-catalog.test.ts tests/unit/playground-intent-catalog.test.ts tests/unit/playground-gateway-guard.test.ts` |
| **Resolver command** | `pnpm exec vitest run packages/services/src/catalog-intent-resolver.test.ts` |
| **Runtime command** | `pnpm exec vitest run packages/services/src/intent-service.test.ts packages/runtime/src/intent-dispatch.test.ts packages/acl/src/resolve.test.ts` |
| **Integration command** | `pnpm exec vitest run packages/services/src/manifest-intent-dispatch.test.ts tests/unit/nip5d-conformance-guard.test.ts` |
| **Focused phase command** | Run all commands above together, then type-check nip/services/runtime/shell/Paja/playground |
| **Estimated quick runtime** | under 45 seconds |

## Sampling Rate

- **After every RED commit:** run the new or changed focused test file and
  confirm the intended failure.
- **After every GREEN commit:** run the full affected package test file and
  package type-check.
- **After every plan:** run that plan's focused matrix plus `git diff --check`.
- **After runtime lifecycle changes:** run binding, service, runtime, ACL, and
  integration tests together.
- **Before phase verification:** run the complete focused phase command,
  affected package type-checks, available AI-slop gate, and diff check.
- **Max feedback latency:** 45 seconds for unit/type feedback.

## Requirement Verification Map

| Requirement | Observable behavior | Test layer | Planned evidence | Status |
|---|---|---|---|---|
| BASE-01 | Active intent types, metadata, and adapters contain conventions and no numbered protocol fields. | type/static/unit | exact type construction plus conformance guards | ⬜ planned |
| BASE-02 | Discovery/routing identity is exactly queryless `napplet:<archetype>/<intent>`. | binding/parser/resolver | query transposition and exact-equality vectors | ⬜ planned |
| INTENT-01 | Protected `invoke`/`open` normalize URI and reject invalid input before postMessage. | binding unit | valid and full invalid URI matrix; replacement attacks | ⬜ planned |
| INTENT-02 | Runtime rejects missing/mismatched/query-bearing normalized fields before resolver access. | service/runtime unit | resolver spy remains untouched on invalid requests | ⬜ planned |
| INTENT-03 | Exact required/discriminated types contain no lifecycle/protocol/ID fields. | type/static | compile fixtures and negative property guards | ⬜ planned |
| INTENT-04 | Repeated valid manifest tags become separate scoped contracts and installed catalog candidates. | parser/adapter/integration | repeated same-slug/kind vectors from parsed manifest | ⬜ planned |
| INTENT-05 | Resolver accepts only exact advertised convention and never infers action/kind. | resolver unit | exact/near-miss/payload-kind vectors | ⬜ planned |
| INTENT-06 | Default, sole candidate, chooser, cancellation, and explicit authorization obey user policy; ambiguity never first-picks. | resolver unit | complete selection matrix | ⬜ planned |
| INTENT-07 | One immediate result means retained responsibility only; denials are structured results. | service/runtime unit | exact result shape, ACL/firewall denial, no second result | ⬜ planned |
| INTENT-08 | Retained task survives source destruction and starts after source result. | integration | deferred target readiness plus source destroy | ⬜ planned |
| INTENT-09 | Target delivery contains session-attested sender, exact fields, no ID/INC, and reaches only target. | runtime/integration | real session registry and three-window collectors | ⬜ planned |
| INTENT-10 | Early parent deliveries buffer FIFO; lifecycle policy remains behind task/controller seams. | binding/resolver/integration | early delivery, ready/reused/deferred/retry seam vectors | ⬜ planned |
| INTENT-11 | Every loaded eligible session receives a change without a prior intent request. | runtime/service unit | registered domain-enabled + ACL-granted, ungranted/revoked, domain-disabled, and destroyed sessions | ⬜ planned |
| ARCH-01 | Parser/build tooling require and emit one matching queryless convention tag with scoped unsigned kinds. | parser/build unit | valid repeated tags and malformed metadata matrix | ⬜ planned |
| ARCH-02 | Adapter derives only indexes from contracts and invents no defaults/payload schemas. | adapter/static unit | no-open-default and opaque payload vectors | ⬜ planned |
| ARCH-04 | Build helper rejects query/fragment/mismatch/numbered convention and invalid kinds. | build/static unit | shared Vite config guard matrix | ⬜ planned |

## Security Regression Matrix

| Threat | Required proof |
|---|---|
| Sender spoofing | Caller `sender` and derived-field overrides never reach wire; service uses session dTag. |
| Target confusion | Exact convention filtering precedes default/chooser/explicit selection. |
| Unauthorized explicit target | Missing/false authorization rejects before retention. |
| Metadata injection | Verified-manifest parser and build helper reject every malformed contract field. |
| Delivery leak | Only selected target receives no-ID delivery; source and third window do not. |
| Premature success | Retention failure yields `ok:false`; accepted result exists only after task creation. |
| Premature delivery | Task start and target send occur after source result send. |
| Source-coupled loss | Source destruction before readiness does not cancel retained task. |
| Binding replacement | Direct domain, whole namespace, descriptor, and deletion attacks retain protected intent behavior. |
| Discovery leakage | Changes go only to current registered sessions passing immutable intent-domain and current `intent:read` ACL checks. |

## Wave 0 Test Dependencies

No new test framework or fixture package is required. Existing runtime adapter,
session registry, prelude test window, signed-manifest fixture, deferred Promise,
and message collectors cover all phase behaviors. Each implementation task
creates its failing regression before production changes.

## Manual-Only Verification

None. Runtime lifecycle policy remains injected, but the public neutrality and
ordering seams are automatically tested with ready, deferred, source-destroyed,
and task-failure controllers.

## Validation Sign-Off Checklist

- [x] Every phase requirement maps to automated evidence
- [x] Every source-changing task has a focused command
- [x] No watch-mode command
- [x] No dependency installation required
- [x] Security-critical ordering and identity have concrete runtime vectors
- [ ] All planned regressions implemented and passing
- [ ] Focused phase matrix passing
- [ ] Affected package type-checks passing
- [ ] Draft authority rechecked without drift
- [ ] `nyquist_compliant: true` after independent post-execution audit
