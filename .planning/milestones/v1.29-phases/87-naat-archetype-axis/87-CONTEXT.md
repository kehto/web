# Phase 87: NAAT Archetype Axis - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped; spec from REQUIREMENTS.md + audit)

<domain>
## Phase Boundary

Add the NAAT (Napplet Archetype) axis so NAP-INTENT resolves archetypes from **signed NIP-5A manifests** rather than host-injected catalog data. Four requirements:
- **ARCH-01 (G3,G4):** `@kehto/nip/5d` parses `["archetype","<slug>","<NAP-N>"]` manifest tags into a structured `archetypes` field on `NappletManifest`, and parses the optional `source` tag.
- **ARCH-02 (G3):** a NIP-5A-manifest → `IntentCatalogEntry` adapter derives a napplet's archetype catalog entry (slug → actions/protocols) from its resolved signed manifest.
- **ARCH-03 (G3):** the playground intent catalog is populated from resolved manifests via the adapter, and at least one playground napplet declares an `archetype` tag.
- **ARCH-04 (G3):** a test (e2e OR integration — integration is acceptable) exercises NAP-INTENT dispatch end-to-end against the archetype-tagged napplet: `intent.available` reports the candidate, `intent.invoke` resolves to it.

Out of scope: NAP-INTENT wire/shape/resolution logic (already ALIGNED per audit), the terminology migration (Phase 88), docs (Phase 89).
</domain>

<decisions>
## Implementation Decisions

### ARCH-01 — manifest parsing (`@kehto/nip/5d`)
- `parseNappletManifest` (`packages/nip/src/5d/index.ts:128-151`) currently parses `path`/`x`/`server`/`requires`/`d`/`title`/`description`. It does NOT parse `archetype` or `source`.
- Add `archetypes` to `NappletManifest` (interface at `5d/index.ts:58`). Shape: `Array<{ slug: string; nap?: string }>` derived from `["archetype","<slug>","<NAP-N>"]` tags (the 3rd element `<NAP-N>` is the recommended default wire protocol; may be absent). Also add optional `source: string` from the `source` tag.
- Unit tests: single archetype tag, multiple archetype tags, absent (empty array), archetype tag with and without the NAP-N element. Follow the existing test patterns in `packages/nip/src/5d/index.test.ts`.
- Keep this additive and backward compatible — existing parse tests must stay green.

### ARCH-02 — manifest → IntentCatalogEntry adapter (`@kehto/services`)
- `IntentCatalogEntry` (`packages/services/src/catalog-intent-resolver.ts:49-56`) = `{ dTag, title?, archetypes: Record<slug, IntentArchetypeSupport> }` where `IntentArchetypeSupport` = `{ actions: string[]; protocols: string[] }`.
- Write a pure adapter (new file e.g. `packages/services/src/manifest-intent-catalog.ts`) that maps a resolved napplet manifest (the `@kehto/nip/5d` `NappletManifest`, or the playground's resolved shape carrying `dTag`/`title`/`archetypes`) → an `IntentCatalogEntry`. For each archetype slug: derive `protocols` from the tag's NAP-N (default to that single protocol, or `[]`), and `actions` (default `['open']` when the manifest does not enumerate actions — NAP-INTENT default action is `open`).
- Decide cleanly where the adapter's input type comes from: it should accept the parsed manifest fields, not re-parse. Avoid a hard dependency cycle — if `@kehto/services` cannot depend on `@kehto/nip`, accept a minimal structural input (`{ dTag, title?, archetypes: {slug, nap?}[] }`) so the playground can adapt resolved manifests itself. Claude's discretion; prefer the structural-input approach to keep `@kehto/services` dependency-light.
- Unit tests for the adapter: slug→entry mapping, NAP-N→protocols, default action `open`, multiple archetypes, empty.

### ARCH-03 — playground catalog wiring + archetype-tagged napplet
- IMPORTANT: NAP-INTENT is implemented in `@kehto/services` (intent-service.ts, catalog-intent-resolver.ts) with unit tests, but is **NOT currently wired into the playground** — `apps/playground/src` has no `hooks.intent`, no `loadCatalog` provider, and no intent UI. The shell `IntentHooks` interface exists (`packages/shell/src/types.ts:172-313`, advertised only when `hooks.intent.isAvailable()` is true).
- Minimum to satisfy ARCH-03 without building a whole new playground UI:
  - Add an `["archetype", "<slug>", "<NAP-N>"]` tag to at least one existing playground napplet via `apps/playground/napplets/shared-vite-config.ts` (`definePlaygroundNappletConfig` — extend it with an optional `archetypes` field, validated like `requires`, emitted into the NIP-5A manifest by the vite plugin). Choose a sensible existing napplet + archetype slug (e.g. `profile-viewer` → `profile`, or `feed` → `feed`, or `composer` → `note`).
  - Wire the playground so its intent catalog is built from resolved manifests via the ARCH-02 adapter (the resolver's `loadCatalog()` returns adapter output over the resolved manifests the playground already has). Whether to also surface a full intent UI is OPTIONAL — the requirement is that the catalog is populated from resolved manifests, provable by ARCH-04.
- Update playground napplet-count / DEMO_CAPABILITIES assertions in lockstep if adding a manifest tag changes any asserted count (it should not change counts, only add a tag — verify).

### ARCH-04 — dispatch test
- An INTEGRATION test (vitest) is acceptable and preferred over a heavy Playwright e2e: wire ARCH-02 adapter → `createCatalogIntentResolver` → `createIntentService` with a fixture manifest carrying an `archetype` tag, then assert `intent.available` reports the candidate and `intent.invoke` resolves to it (`ok:true`, `handler` = the dTag). This proves the archetype axis end-to-end (manifest tag → adapter → catalog → resolver → dispatch). If a playground e2e is cheap given the ARCH-03 wiring, add it too, but the integration test is the gating proof.

### Constraints
- KEEP `naps`+`nubs` dual-emit; do not touch capability arrays or terminology (Phase 88 owns `ifc`→`inc`).
- Additive only — all existing unit + e2e stay green.
- Add changesets for `@kehto/nip` (minor — new manifest fields) and `@kehto/services` (minor — new adapter export). `@kehto/shell`/playground changes may not need a changeset (playground is private; shell only if its public types change).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/NIP-5D-2303-DELTA-AUDIT.md` — gaps G3 (archetype axis, NAP-INTENT §3 + NIP-5D manifest §2) and G4 (source tag).
- `.planning/REQUIREMENTS.md` — ARCH-01..04.
- The NAP-INTENT spec semantics (in the audit): `IntentCandidate { dTag, title?, actions, protocols, isDefault? }`, `IntentAvailability { archetype, available, candidates, hasDefault }`; archetype manifest tag `["archetype","<slug>","<NAP-N>"]`.
- `packages/nip/src/5d/index.ts` — `NappletManifest` interface (l.58), `parseNappletManifest` (l.128-151), `allTagValues`/`firstTagValue` helpers; `packages/nip/src/5d/index.test.ts`.
- `packages/services/src/catalog-intent-resolver.ts` — `IntentCatalogEntry` (l.49), `IntentArchetypeSupport`, `loadCatalog` (l.88), `candidatesFor` (l.130), `createCatalogIntentResolver`.
- `packages/services/src/intent-service.ts`, `intent-types.ts`, `intent-service.test.ts`, `catalog-intent-resolver.test.ts` — wiring + test patterns.
- `apps/playground/napplets/shared-vite-config.ts` — `definePlaygroundNappletConfig`, `validateRequires` (extend for `archetypes`).
- `packages/shell/src/types.ts:172-313` — `IntentHooks` / `isAvailable()` advertise gate.
- `packages/nip/package.json`, `packages/services/package.json` — check dependency direction before coupling.
</canonical_refs>

<specifics>
## Specific Ideas

- Suggested archetype-tagged napplet: `profile-viewer` declaring `["archetype","profile","NAP-1"]` (NAP-1 is the `profile:*` topic family per the registry), since profile-viewer is identity/profile focused. Planner may pick a better fit.
- The adapter is a pure function — easy to unit-test in isolation; keep it dependency-light (structural input).
</specifics>

<deferred>
## Deferred Ideas

None for this phase. A full interactive playground intent UI is explicitly optional — only the catalog-from-manifests wiring + dispatch proof are required.
</deferred>

---

*Phase: 87-naat-archetype-axis*
*Context gathered: 2026-06-17 (discuss skipped; spec from requirements + audit)*
