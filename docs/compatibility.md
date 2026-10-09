# Compatibility register

Retained compatibility has a removal boundary, a diagnostic, and regression
coverage. This register records both implemented safeguards and existing debt;
**debt is not an exemption for new or changed compatibility paths**. Ownership
below identifies the package responsible for the implementation and its tests.
No removal date is implied by an old source comment.

## Active paths changed in PR #277

| ID / owner | Old behavior and replacement | Warning / regression coverage | Retirement prerequisite |
| --- | --- | --- | --- |
| **INTENT_INC** — shell, Paja, playground | An exact-topic INC listener consumes a canonical intent locally when no `intent.onDelivery` listener exists. Migrate the consumer to `window.napplet.intent.onDelivery(handler)`. Hosts send only `intent.deliver`. | `KEHTO_COMPAT_INTENT_INC`, once per iframe on actual fallback use in `packages/shell/src/napplet-namespace.ts`. `napplet-namespace.test.ts`, suite `intent delivery and KEHTO_COMPAT_INTENT_INC`, covers matching, warning text/frequency, quiet canonical/ordinary INC paths, trust, close, buffering and no replay. `tests/e2e/paja-runtime-pointer.spec.ts` proves legacy reuse warns once; its cold-target test and `tests/e2e/playground-profile-intent.spec.ts` prove canonical delivery. | Migrate supported installed handlers, announce a removal release, then remove only the local legacy registration/dispatch adapter. Keep canonical buffering and ordinary INC behavior. Convert fallback fixtures to explicit rejection/non-delivery tests. |
| **LEGACY_MANIFEST** — nip | Explicit `x` aggregate marker selects the isolated pre-plugin-0.15 parser. Republish as a signed single-artifact event using `@napplet/vite-plugin >=0.15`. Malformed current events never retry as legacy. | `KEHTO_COMPAT_LEGACY_MANIFEST`, once per resolver module lifetime after successful signature, aggregate and blob verification. Implementation: `packages/nip/src/5d/legacy-manifest.ts`, called by `resolveNapplet`. `current-manifest.test.ts` tests quiet current/invalid input, warning and rate limit; `artifact-cache.test.ts` covers both formats and shared verified cache bytes. | Republish supported artifacts and fixtures, document the rejected legacy marker and release impact, then remove the parser/aggregate resolver branch. Preserve current signature/blob/cache checks. Test explicit legacy rejection. |
| **INTENT_BINDING** — shell, playground | Host-owned `onDelivery` binding and profile demo delivery type bridge the missing API in `@napplet/nap@0.32.0`. | No deprecation warning on canonical API use: this fills a packaged implementation gap, not an old consumer path. `napplet-namespace.test.ts` and `tests/unit/nip5d-conformance-guard.test.ts` cover the protected binding and bounded demo exception. | Upgrade to a package exposing the checked contract; remove local type/binding duplication only after proving early buffering, parent trust, protected namespace and both browser hosts. |
| **ARTIFACT_HASH_NAME** — nip, shell, Paja, services | Existing `aggregateHash` fields carry the current artifact hash or the original legacy aggregate. `artifactHash` is available from the resolver. Cache/ACL identity still uses the existing field. | No access warning: plain fields cannot distinguish old consumers from internal identity plumbing. This is an explicit diagnostic limitation, not a claim of runtime detection. `current-manifest.test.ts`, `artifact-cache.test.ts`, `packages/paja/src/browser-target-frame.test.ts` exercise verified identity across formats. | Coordinate a public API and persisted identity migration with cache/ACL owners. Do not rename keys or discard existing grants as part of parser removal. |

Authority: NAP-INTENT delivery at
[`napplet/naps@25b29ee49e5bff8ebfe031f4b76dce98705c8b7e`](https://github.com/napplet/naps/blob/25b29ee49e5bff8ebfe031f4b76dce98705c8b7e/naps/NAP-INTENT.md)
and NIP-5D at `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`.
The legacy adapters are Kehto transition policies. Current intent delivery is
aligned; URI invocation, accepted-result lifecycle, nameless catalog identifiers
and other upstream NAP changes are intentionally deferred. See
[the conformance boundary](./policies/NIP-5D-CONFORMANCE.md#intent-delivery-boundary).

## Existing compatibility inventory

Baseline: PR #277 at `016e9cf3`, reviewed 2026-10-09. These paths are recorded so
follow-up work can be scheduled without silently removing support in this PR.
**Missing** means a warning or dedicated regression still needs implementation;
a related test file is not proof of diagnostic coverage. Runtime changes here
require their own scoped specification check and migration PR.

| ID / owner | Source and retained behavior | Diagnostics and tests today | Next step / removal condition |
| --- | --- | --- | --- |
| **SESSION_ALIASES** — runtime, shell | `packages/runtime/src/session-registry.ts`, `types.ts`, `packages/shell/src/session-registry.ts`: `NappKeyRegistry`, `NappKeyEntry`, `createNappKeyRegistry`, `nappKeyRegistry` alias current session APIs. | JSDoc deprecation only; runtime warning and dedicated alias coverage missing. Type-only aliases have no runtime hook. | Migrate imports; warn on callable alias use without changing identity of singleton exports; add export/type regressions. Replace stale “v0.9.0” deadlines with an agreed release. |
| **AUTH_SHAPES** — runtime, shell, acl | `packages/runtime/src/types.ts`: deprecated `SessionEntry.pubkey`, `legacy-auth` provenance, optional shell-secret persistence; `packages/acl/src/types.ts`: ignored optional `pubkey`. Transport type also permits arrays while the shell bridge rejects them. | JSDoc only; no usage warning. This is retained API/type shape, not permission to re-enable AUTH or array dispatch. | Audit actual consumers and remove obsolete shapes in a breaking release. Keep source-identity and array-rejection regressions. |
| **STORAGE_KEYS** — runtime | `packages/runtime/src/state-handler.ts`: shared storage reads old pubkey-scoped/prefix keys and lists/cleans old keys. Instance scope does not fall back. | Warning missing. Related behavior tests: `packages/runtime/src/state-handler.test.ts`; diagnostic assertion missing. | Add warning on actual legacy read and migration evidence; retire only after persisted data is migrated. Preserve isolation and cleanup coverage. |
| **STORAGE_OK** — runtime | `state-handler.ts`: storage result includes compatibility `ok` alongside the current value/error shape. | Old consumer use cannot be observed from an additive result field; dedicated retirement regression missing. | Find consumers, document diagnostic limitation, test both response consumers before removing the field. |
| **ACL_KEYS** — acl, shell | `packages/acl/src/migrate.ts`: pure migration of three-part ACL keys to two-part identity keys. | `packages/acl/src/migrate.test.ts` covers conversion/collisions/idempotency. No runtime warning in the pure function. | Host caller should report actual migration; keep the pure API free of logging side effects. Retire only after persisted-state migration and retention policy are agreed. |
| **RESOURCE_FIELDS** — services, shell | `packages/shell/src/types/internal-resource.ts`, `packages/services/src/resource-service.ts`: old `requestId` input and legacy resource response type fields. | Warning missing. Related tests: `packages/services/src/resource-service.test.ts`; inventory must distinguish live correlation fallback from historical response-type/comment fields. | Recheck owning NAP, inspect emitted response helpers, map old consumers, then warn/test actual old input use and remove stale types separately. |
| **DOMAIN_ALIAS** — Paja | `packages/paja/src/parity.ts`: upstream `ifc` capability alias maps to `inc` in parity metadata. | `parity.test.ts` covers the declaration; no runtime warning. This metadata is not evidence that old wire messages are accepted. | Drop the metadata alias once upstream parity no longer needs it; check public export consumers first. |
| **NOTIFY_NAME** — playground | `apps/playground/src/playground-access-controls.ts`, `node-details.ts`: `notifications` UI/persisted target name maps to the `notify` domain. | Warning and dedicated migration assertion missing. | Separate display labels from persisted aliases, warn on migrated persisted input, prove existing settings survive before removal. |
| **OUTBOX_AGGREGATE** — services | `packages/services/src/relay-pool-outbox-router.ts`, `outbox-service.ts`: aggregate `query()` remains beside streaming `queryStream()`. | `relay-pool-outbox-router.test.ts` exercises both. No deprecation warning; aggregate API is still supported. | Decide whether to deprecate at all; if so add warning at the old callable boundary, publish replacement and test limit/abort/result parity. |
| **FIREWALL_SCOPE** — firewall | `packages/firewall/src/types.ts`, `evaluate.ts`: pure callers without an init key use dTag burst scope. | `packages/firewall/src/evaluate.test.ts` covers policy evaluation; no diagnostic assertion for this fallback. | Add a host-visible diagnostic when opting into old scope; migrate callers before requiring instance identity. Preserve the pure evaluator. |
| **PROXY_EMIT** — shell | `identity-proxy.ts`, `theme-proxy.ts`: deprecated `emit` methods throw and direct callers to controlled publication APIs. | Actionable errors already fail closed; related identity/theme proxy tests protect rejection. Stable compatibility IDs missing. | Remove deprecated members after callers migrate; never restore bypass publication while adding diagnostics. |
| **ENFORCE_EXPORT** — shell | `packages/shell/src/index.ts` re-exports runtime enforcement helpers. | No warning: module re-export cannot observe which import path was used. Dedicated public-export retirement test missing. | Decide whether to retain as supported convenience; if deprecated, use JSDoc/build-time guidance and a documented diagnostic limitation. |
| **ADDITIVE_TYPES** — runtime | `packages/runtime/src/types.ts`: optional audit reason and confirmation discriminator. | No runtime warning for erased aliases or optional type fields. Dedicated removal/type-compatibility assertions missing. | Inventory consumers before making fields mandatory or deleting aliases. Record compile-time diagnostics and type tests if deprecating. |

## Retirement sequence

1. **Observe:** assign an owner, add actionable diagnostics at actual old-path
   use, and close the missing regression coverage above. Rate-limit by a stated
   lifetime; avoid payloads or user secrets in warnings. Record exceptions for
   erased types, additive output fields, and pure functions at their host boundary.
2. **Migrate:** publish the replacement and move supported consumers/fixtures.
   Recheck the owning NAP before changing a protocol path. Lack of warning reports
   alone is not evidence that external consumers have migrated.
3. **Announce:** choose a release and document the removal and rollback strategy.
   On 0.x, a breaking removal needs a minor changeset.
4. **Remove:** delete the bounded adapter, add negative tests for retired inputs,
   retain canonical behavior/security tests, and record the removal PR and release
   here. Keep retired rows as history.

The AGENTS policy requiring warnings, tracking, and tests is proposed separately
in [PR #284](https://github.com/kehto/web/pull/284). This implementation PR leaves
`AGENTS.md` unchanged.
