# Phase 104 Plan Outline — NAP-INTENT and Manifest Contract Parity

Protocol authority: NAP-INTENT draft PR #91 at exact head
`a718915ddefa2f03a0126579601f59d8bd86f7c4`, the merged web projection at
`napplet/naps@5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, and the
convention-capable implementation merged as
`napplet/web@dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b`. Package adoption remains
Phase 105.

| Plan ID | Objective | Wave | Depends On | Requirements | Primary files |
|---|---|---:|---|---|---|
| 104-01 | Replace the partial compatibility model with exact canonical intent types and a protected URI-authoritative binding that sanitizes options and retains validated parent deliveries. | 1 | none | BASE-01, BASE-02, INTENT-01, INTENT-03, INTENT-10 | `packages/services/src/intent-types.ts`<br>`packages/services/src/index.ts`<br>`packages/shell/src/napplet-namespace.ts`<br>`packages/shell/src/napplet-namespace.test.ts` |
| 104-02 | Make verified-manifest parsing, catalog adaptation, and playground build metadata preserve and validate one exact contract per repeated archetype tag. | 2 | 104-01 | BASE-01, BASE-02, INTENT-04, INTENT-05, ARCH-01, ARCH-02, ARCH-04 | `packages/nip/src/5d/index.ts`<br>`packages/nip/src/5d/index.test.ts`<br>`packages/services/src/manifest-intent-catalog.ts`<br>`packages/services/src/manifest-intent-catalog.test.ts`<br>`apps/playground/napplets/shared-vite-config.ts`<br>`apps/playground/napplets/profile-viewer/vite.config.ts` |
| 104-03 | Resolve only exact compatible installed contracts through default/sole/chooser/authorized-explicit policy and retain an opaque source-independent delivery task before acceptance. | 3 | 104-01, 104-02 | INTENT-05, INTENT-06, INTENT-07, INTENT-08, INTENT-09, INTENT-10 | `packages/services/src/catalog-intent-resolver.ts`<br>`packages/services/src/catalog-intent-resolver.test.ts`<br>`packages/services/src/intent-service.ts` |
| 104-04 | Attach services to runtime-owned session/send context, derive sender identity, validate normalized requests, order result before task start, broadcast changes to all eligible loaded clients, and correct intent denial/delivery direction. | 4 | 104-01, 104-03 | INTENT-02, INTENT-07, INTENT-08, INTENT-09, INTENT-11 | `packages/runtime/src/types.ts`<br>`packages/runtime/src/runtime.ts`<br>`packages/runtime/src/domain-handlers.ts`<br>`packages/runtime/src/intent-dispatch.test.ts`<br>`packages/acl/src/resolve.ts`<br>`packages/acl/src/resolve.test.ts`<br>`packages/services/src/intent-service.ts`<br>`packages/services/src/intent-service.test.ts` |
| 104-05 | Prove manifest-to-runtime retained delivery across target readiness and source destruction, update stale compile consumers and phase-local docs/guards, and close the focused contract matrix. | 5 | 104-01, 104-02, 104-03, 104-04 | BASE-01, BASE-02, INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05, INTENT-06, INTENT-07, INTENT-08, INTENT-09, INTENT-10, INTENT-11, ARCH-01, ARCH-02, ARCH-04 | `packages/services/src/manifest-intent-dispatch.test.ts`<br>`packages/paja/src/browser-adapter.ts`<br>`apps/playground/src/playground-intent-catalog.ts`<br>`tests/unit/playground-intent-catalog.test.ts`<br>`tests/unit/nip5d-conformance-guard.test.ts`<br>`tests/unit/playground-gateway-guard.test.ts`<br>`packages/{nip,runtime,services,shell}/README.md` |

Execution constraints:

- Re-check PR #91's exact head before the first source edit and before phase
  verification. Any drift blocks execution until its delta is audited.
- The immediate accepted result is sent only after an immutable delivery task is
  retained, and that task is started only after the result send.
- No canonical or public intent object may expose `protocol`, `protocols`,
  `handled`, `windowId`, `newWindow`, intent ID, delivery ID, or caller sender.
- Build and runtime metadata use exact queryless convention equality. Payload is
  never inspected to infer action, convention, or event kind.
- No ambiguous first-candidate fallback and no unauthorised explicit dTag.
- No dependency install/upgrade in this phase. Phase 105 owns the released
  Napplet line and real Paja/playground host controller.
- Phase 106 owns final generated docs, changesets, full release gates, and the
  repository-wide vocabulary sweep. Phase 104 still keeps its touched package
  docs and compile consumers coherent.

## OUTLINE COMPLETE
