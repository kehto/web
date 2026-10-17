## ISSUES FOUND

**Phase:** 113 — Service authorization boundaries
**Focused recheck:** 113-03 relay authorization
**Issues:** 1 blocker

All earlier full-phase coverage, dependency, and validation findings remain passed. Plans 01/02 remain an accepted atomic resource group. This finding applies only to Plan 03 before its execution begins.

### Blocker (must fix)

1. **[key_links_planned] Plan 03 cannot meet its pre-sign/pre-encrypt, cache, query, and once-grant requirements with its declared Task 2 scope.**
   - Plan/task: 113-03 Task 2 (with related Task 1 runtime work)
   - Evidence: [`113-RELAY-AUTHORITY.md`](113-RELAY-AUTHORITY.md) documents that `packages/runtime/src/relay-handler.ts` encrypts/signs before dispatching to `relay-pool-service`; it also buffers/delivers publish events and cache/query data before or outside the registered service. `relay.query` synthesizes `relay.subscribe` and `relay.close`, which can double-approve/charge or consume a once grant twice. Current publish adapter/service interfaces do not expose an immutable destination plan before signing.
   - The current Task 2 only owns service/coordinated-relay files. Its action says signing starts only inside `authorizeOperation`, but it does not include the runtime handler, runtime adapter/service type contracts, runtime relay-handler tests, or an explicit captured-plan handoff. A service-only implementation therefore leaves the real signer/encryptor and cache/fallback paths outside authorization, failing SVC-03/SVC-05 and the plan’s own must-haves.
   - Fix: amend/split Plan 03 so its runtime-owned task explicitly modifies and tests `packages/runtime/src/relay-handler.ts` plus the relevant runtime adapter/service type boundary and relay-handler test surface. It must:
     1. validate/snapshot and obtain the exact destination plan before encryption, signing, cache buffer/delivery, pool I/O, or publish;
     2. pass that immutable approved plan through registered-service and adapter-fallback publish paths, forbidding reselection after approval;
     3. authorize local buffer/cache delivery with interface authority without inventing a network grant;
     4. make query’s synthesized subscribe/close one operation for rate/once-grant purposes and return one canonical query failure on denial; and
     5. test unresolved approval and revocation/replacement around encryption, signing, cache delivery, publish, query, timers, and same-ID subscription replacement.

### Structured Issues

```yaml
issues:
  - plan: "113-03"
    task: 2
    dimension: key_links_planned
    severity: blocker
    description: "Runtime relay-handler signs/encrypts and can deliver cache/buffer data before the service; Task 2 modifies only service files and cannot enforce its promised pre-sign/destination-plan/once-grant semantics."
    fix_hint: "Add or split a runtime relay-handler + adapter/type-contract task with immutable destination-plan handoff and direct lifecycle/rate/cache/query regressions."
```

### Recommendation

Revise Plan 03 before starting its wave. The resource group may continue; this relay correction does not invalidate Plans 01/02 or the rest of the Phase 113 plan set.
