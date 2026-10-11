---
phase: 107-paja-intent-deep-links
plan: "01"
subsystem: protocol-services
tags: [nap-intent, nip-5d, catalog-identity, playground]
requires: []
provides:
  - Canonical NAP-INTENT contracts and verified manifest catalog mapping
  - Publisher-safe catalog IDs and retained target-completion lifecycle
affects: [paja, shell, playground]
tech-stack:
  added: []
  patterns:
    - Verified catalog IDs are distinct from artifact d-tags
    - Intent acceptance and asynchronous host completion are separate
key-files:
  created:
    - packages/services/src/intent-types.ts
    - packages/nip/src/5d/catalog-id.ts
  modified:
    - packages/services/src/catalog-intent-resolver.ts
    - packages/services/src/intent-service.ts
    - packages/nip/src/5d/current-manifest.ts
    - apps/playground/src/playground-intent-controller.ts
key-decisions:
  - "Canonical types live in @kehto/services because installed @napplet/nap 0.32 is behind NAP-INTENT PR 106."
  - "Intent sources resolve through authenticated window-to-catalog lookup; request sender fields are invalid and rejected."
  - "Target acceptance returns completion separately so delivery failures remain host-observable without extending canonical result wires."
requirements-completed: [LINK-02, LINK-07, LINK-08, LINK-09, LINK-10]
coverage:
  - id: D1
    description: Canonical catalog contracts preserve exact parameters and publisher-safe IDs.
    verification:
      - kind: unit
        ref: pnpm exec vitest run packages/nip/src/5d
        status: pass
    human_judgment: false
  - id: D2
    description: Resolver selection, authenticated senders, target acceptance, and playground retention are behaviorally covered.
    verification:
      - kind: unit
        ref: pnpm exec vitest run packages/services/src/*intent*.test.ts tests/unit/playground-intent* tests/unit/playground-installed-catalog.test.ts
        status: pass
    human_judgment: false
duration: delegated execution
completed: 2026-10-10
status: complete
---

# Phase 107 Plan 01: Shared intent contract and catalog Summary

**Canonical NAP-INTENT contracts now map verified NIP-5D manifests to opaque publisher-safe catalog IDs, retain exact convention parameters, and separate accepted delivery from asynchronous host completion.**

## Accomplishments

- Added `IntentContract`, `IntentRequest`, `IntentCandidate`, and canonical result types to `@kehto/services`; requests require action and convention, reject caller sender fields, and results never expose host window identity or lifecycle state.
- Added `getNappletCatalogId(event)` to `@kehto/nip/5d`, preserving literal named `d` values and deriving root/snapshot identities from verified publisher or event identity.
- Normalized current and legacy manifests into same-role contracts with parameter names; malformed optional `z`/`i` advertisements now drop only that advertisement while legacy compatibility warnings remain.
- Made resolver selection explicit-handler/authorization, `choose`, default, recommendation, then compatible fallback; absent handler and `handler: "default"` share the latter fallback steps, while an explicit target failure never falls through.
- Migrated playground catalog and lifecycle consumers to opaque IDs, authenticated source lookup, retained target work, and host-observable completion failure.
- Restored the manifest-to-service regression: accepted work remains valid after source removal, terminal completion never emits a second source result, and pre-accept target failure is rejected once.

## Public API handed to integration

```ts
createIntentService({
  resolver,
  resolveSender(windowId): string | undefined,
})

createCatalogIntentResolver({
  loadCatalog(): readonly IntentCatalogEntry[] | Promise<readonly IntentCatalogEntry[]>,
  targets: { accept(params: IntentDispatchParams): { completion: Promise<void> } },
  getDefaultHandler?(archetype): string | undefined,
  chooseHandler?(archetype, candidates, sender): string | undefined | Promise<string | undefined>,
  authorizeExplicitHandler?(sender, handler, request, candidate): boolean | Promise<boolean>,
  resolveHandlerHint?(hint, candidates): string | undefined | Promise<string | undefined>,
})
```

`chooseHandler` runs before defaults and recommendations when `request.handler === "choose"`. Explicit handler authorization runs before targeted delivery. Hosts should wrap `targets.accept` and observe `completion` to display failures or enable retries; that failure is intentionally outside the canonical `intent.invoke.result` wire.

## Verification

- Passed: `pnpm exec vitest run packages/services/src/*intent*.test.ts packages/nip/src/5d tests/unit/playground-intent* tests/unit/playground-installed-catalog.test.ts` — 11 files, 99 tests.
- Passed: `pnpm exec vitest run packages/nip/src/5d` — 81 tests.
- Passed: `pnpm --filter @kehto/services build && pnpm --filter @kehto/nip build`.
- Passed: `git diff --check`.
- `pnpm build` passes services and NIP and stops in Paja's separately owned manifest consumer: `packages/paja/src/installed-napplet-catalog.ts:132` must supply `params: string[]` when projecting `NappletManifest.archetypes`.

## Compatibility and protocol authority

- Implemented against NAP-INTENT PR 106 at `fc121fc264615482143eda86125863d2e1f741a2` and NIP-5D PR 2303 at `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`.
- `@napplet/nap` 0.32 lacks these current canonical types; the local service exports are deliberate upstream-drift containment, not a competing protocol definition.
- Existing legacy-manifest adapter diagnostics are retained. No compatibility behavior was made silent.

## Handoff

- Parent owns shared-worktree commits and final documentation integration. This delegated slice intentionally made no commit.
- NIP paths for parent staging: `packages/nip/src/5d/catalog-id.ts`, `kinds.ts`, `index.ts`, `current-manifest.ts`, `legacy-manifest.ts`, `current-manifest.test.ts`, `index.test.ts`.
- Paja integration remains responsible for adding `params` to its manifest projection; no Paja or shell-namespace file was changed here.
