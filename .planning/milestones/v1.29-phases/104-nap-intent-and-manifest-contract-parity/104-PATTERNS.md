# Phase 104: NAP-INTENT and Manifest Contract Parity - Patterns

**Mapped:** 2026-07-26
**Purpose:** Map each Phase 104 change to the closest existing Kehto or released
Napplet implementation pattern.

## Pattern Map

| New or changed surface | Closest analog | Reuse |
|---|---|---|
| Protected intent binding | `makeProtectedInc`, `makeProtectedIdentity`, `makeProtectedTheme` in `packages/shell/src/napplet-namespace.ts` | Cache one host-owned instance and merge/ignore reassignment without losing canonical operations or pending state. |
| URI normalization | Existing projection `normalizeConventionUri` in the same prelude; released `@napplet/nap` `convention-uri.ts` | Reuse the single serialized helper; tighten its `name=value` matrix rather than adding an intent parser. |
| Delivery sanitization and buffering | Released `@napplet/nap/intent/shim.ts`; Phase 102 channel retention | Copy only required delivery fields, trust only parent messages, retain FIFO, and drain once on handler registration. |
| Exact intent value types | Released `napplet/web` `packages/core/src/types/intent.ts` | Mirror the published source shapes exactly until Phase 105 imports the package release. |
| Manifest contract parsing | `pathEntriesFromTags` / `parseNappletManifest` fail-closed validation | Parse one tag into one structured record and throw `invalid-manifest` for malformed authority metadata. |
| Manifest build validation | Released Vite plugin `buildArchetypeTags`; local `validateRequires` | Use the upstream regex/rules and emit one tag per declared contract. |
| Catalog grouping | Existing `manifestToIntentCatalogEntry` structural adapter | Preserve dependency direction; group repeated records rather than importing `@kehto/nip` into services. |
| Exact candidate selection | Existing `createCatalogIntentResolver` injected policy hooks | Keep catalog/default/chooser/controller injection, remove protocol/default-first behavior, and add explicit authorization. |
| Retained delivery lifecycle | Phase 102 runtime-first channel admission and retained binding handles | Complete admission/retention before success; start eventual delivery only after the immediate result. |
| Runtime service attachment | `runtime.registerService`, adapter `services`, and `notifyServiceWindowDestroyed` | Add optional lifecycle/context callbacks at the existing registration boundary; existing handlers remain valid. |
| Authenticated sender | `SessionRegistry.getEntryByWindowId` used by INC | Resolve dTag from creation-time session state; never accept sender from request data. |
| Structured policy denial | `createCanonicalDomainResult` pattern in runtime | Special-case only `intent.invoke` to its sanctioned structured result and leave unrelated denial behavior unchanged. |
| Loaded-client change broadcast | `SessionRegistry.getAllEntries` plus `RuntimeAdapter.isDomainAllowed` | Enumerate live eligible sessions at change time instead of remembering prior request callbacks. |
| Host-independent integration | Runtime `intent-dispatch.test.ts` plus services `manifest-intent-dispatch.test.ts` | Compose real runtime/session/service/catalog pieces with a deferred fake target controller. |

## Files to Modify

### Binding and public model

- `packages/shell/src/napplet-namespace.ts`
- `packages/shell/src/napplet-namespace.test.ts`
- `packages/services/src/intent-types.ts`
- `packages/services/src/index.ts`

Keep the helper inside the serialized prelude. Do not import a runtime parser
into the iframe artifact, and do not create a second source-of-truth parser in
`makeIntent`.

### Manifest pipeline

- `packages/nip/src/5d/index.ts`
- `packages/nip/src/5d/index.test.ts`
- `packages/services/src/manifest-intent-catalog.ts`
- `packages/services/src/manifest-intent-catalog.test.ts`
- `apps/playground/napplets/shared-vite-config.ts`
- relevant playground fixture config and unit guards

The parser owns validity of installed verified metadata. The adapter owns only
structural grouping/derivation. The playground helper repeats validation
because it is a build authoring boundary.

### Resolver and lifecycle

- `packages/services/src/catalog-intent-resolver.ts`
- `packages/services/src/catalog-intent-resolver.test.ts`
- `packages/services/src/intent-service.ts`
- `packages/services/src/intent-service.test.ts`

Keep lifecycle policy injected. Do not introduce DOM, Paja, playground, or
window-manager dependencies into `@kehto/services`.

### Runtime trust and dispatch

- `packages/runtime/src/types.ts`
- `packages/runtime/src/runtime.ts`
- `packages/runtime/src/domain-handlers.ts`
- `packages/runtime/src/intent-dispatch.test.ts`
- `packages/acl/src/resolve.ts`
- `packages/acl/src/resolve.test.ts`

The runtime context should be generic enough for services but minimal: session
identity, live enumeration, and policy-aware target send. The send closure must
combine session liveness, immutable domain eligibility, and the message's
recipient ACL mapping; it must not expose raw transport or mutable ACL/session
internals.

### Integration and compile consumers

- `packages/services/src/manifest-intent-dispatch.test.ts`
- `packages/paja/src/browser-adapter.ts` and focused simulator tests
- `apps/playground/src/playground-intent-catalog.ts`
- `tests/unit/playground-intent-catalog.test.ts`
- `tests/unit/nip5d-conformance-guard.test.ts`
- `tests/unit/playground-gateway-guard.test.ts`
- package-local intent documentation touched by the changed exports

Paja changes in this phase are compile-compatible simulation only. Persistent
catalog/controller wiring belongs to Phase 105.

## Required Implementation Patterns

### Pattern 1: Canonical request construction

```typescript
const normalized = normalizeConventionUri(uri, hasExplicitPayload);
const options = validateIntentOptions(input);

const request = {
  archetype: normalized.archetype,
  action: normalized.action,
  convention: normalized.convention,
  ...(normalized.payload === undefined ? {} : { payload: normalized.payload }),
  ...(options.handler === undefined ? {} : { handler: options.handler }),
  ...(options.behavior === undefined ? {} : { behavior: options.behavior }),
};
```

Construct; do not spread arbitrary input. The URI-derived fields are
authoritative and caller sender is never a request field.

### Pattern 2: Runtime exact normalized validation

```typescript
const match = /^napplet:([^/?#\s]+)\/([^/?#\s]+)$/.exec(request.convention);
if (!match
  || match[1] !== request.archetype
  || match[2] !== request.action) {
  return rejected('invalid convention');
}
```

This is stable-identity validation, not query parsing. Payload remains opaque
after the binding boundary.

### Pattern 3: One tag, one contract

```typescript
for (const archetypeTag of tags) {
  const contract = parseArchetypeContract(archetypeTag);
  contracts.push(contract);
}
```

Never key tags by slug during parsing. Grouping happens later in the services
adapter so repeated contracts and their same-tag kind scopes survive.

### Pattern 4: Derived candidate indexes

```typescript
support.contracts.push(contract);
support.conventions.push(contract.convention);
support.actions.push(actionFrom(contract.convention));
```

Preserve contract order and remove duplicate quick-index strings without
dropping duplicate contract records. `contracts` is authoritative;
`actions`/`conventions` are derived convenience indexes.

### Pattern 5: Default/sole/chooser selection

```text
explicit dTag -> compatible installed candidate -> authorization hook
default       -> compatible user default
implicit      -> compatible user default -> sole candidate -> chooser
choose        -> chooser
ambiguous without chooser -> reject
```

Chooser output must be revalidated against the compatible candidate set.
Catalog order is never policy.

### Pattern 6: Retain, result, then start

```typescript
const outcome = await resolver.invoke(request, context);
send({ type: 'intent.invoke.result', id, result: outcome.result });
if (outcome.result.ok) {
  void outcome.retained.start().catch(() => {
    // Post-acceptance terminal policy is controller-owned.
    // Never send a second source result.
  });
}
```

The resolver/controller must have retained immutable delivery responsibility
before returning an accepted outcome. `start()` may wait for readiness and own
retry/replacement policy.

### Pattern 7: Runtime-attached service context

```typescript
handler.onRegistered?.({
  resolveDTag: (windowId) =>
    sessionRegistry.getEntryByWindowId(windowId)?.dTag,
  listWindowIds: () =>
    sessionRegistry.getAllEntries().map((entry) => entry.windowId),
  sendToEligibleNapplet: (windowId, message) => {
    const entry = sessionRegistry.getEntryByWindowId(windowId);
    const domain = message.type.split('.', 1)[0];
    const { recipientCap } = resolveCapabilitiesNap(message);
    if (!entry || !recipientCap) return false;
    if (hooks.isDomainAllowed?.(windowId, domain) === false) return false;
    if (!enforceNap(windowId, recipientCap, message).allowed) return false;
    hooks.sendToNapplet(windowId, message);
    return true;
  },
});
```

Use narrow closures rather than exposing `hooks` or the mutable registry.
Refuse messages without a recipient capability: source request/reply transport
remains the existing fixed-source callback and cannot be escalated through this
context.
Attach both adapter-provided and later registered services, and clean up on
unregister/destroy.

### Pattern 8: Change broadcast from live state

```typescript
for (const windowId of runtime.listWindowIds()) {
  runtime.sendToEligibleNapplet(windowId, {
    type: 'intent.changed',
    availability,
  });
}
```

No prior `intent.available` or `intent.handlers` call is required. The send
operation itself rechecks liveness, domain eligibility, and `intent:read`.

## Anti-Patterns

- Optional `IntentRequest.action` or `convention`.
- Canonical `protocol`, `protocols`, `handled`, `windowId`, `newWindow`,
  intent ID, or delivery ID fields.
- Caller-supplied or caller-overridable `sender`.
- Runtime query parsing or payload inspection.
- Prefix/wildcard convention matching.
- Synthesizing `open` or selecting the first contract when metadata is absent.
- Overwriting repeated archetype tags in a `Record` before preserving their
  contracts.
- Treating a running frame list as the installed catalog.
- Sending `ok: true` before target delivery state is retained.
- Waiting for target delivery before returning `ok: true`.
- Reporting post-acceptance failure as a second invoke result.
- Sending target delivery through an observable INC envelope.
- Remembering only clients that previously called the intent service.
- Letting a shim replace the protected intent binding or its buffered state.
- Importing `@kehto/services` from runtime or `@kehto/nip` from services.
- Upgrading Napplet packages before Phase 105's package-line verification.

## Test Analog Map

| Behavior | Extend |
|---|---|
| URI/replacement/delivery buffer | `packages/shell/src/napplet-namespace.test.ts` Phase 102 protected INC vectors |
| Strict manifest parsing | `packages/nip/src/5d/index.test.ts` archetype/source block |
| Contract grouping | `packages/services/src/manifest-intent-catalog.test.ts` |
| Selection policy | `packages/services/src/catalog-intent-resolver.test.ts` |
| Validation/result ordering/changes | `packages/services/src/intent-service.test.ts` |
| Runtime attestation and denial | `packages/runtime/src/intent-dispatch.test.ts` |
| Directional ACL mapping | `packages/acl/src/resolve.test.ts` |
| Full retained delivery | `packages/services/src/manifest-intent-dispatch.test.ts` |
| Build metadata | `tests/unit/playground-gateway-guard.test.ts` and focused shared-config tests |
| Active stale-shape guard | `tests/unit/nip5d-conformance-guard.test.ts` |

## Dependency Order

```text
exact types + binding
          |
          +----> strict manifest parser + adapter + build validation
          |                         |
          +-------------------------+----> exact resolver + retained task
                                             |
runtime service context + ACL denial --------+----> intent service orchestration
                                                        |
                                                        v
                                            host-independent lifecycle proof
```

No plan should claim source-independent delivery until the integration proof
uses a real authenticated runtime session and destroys the source before
releasing target readiness.
