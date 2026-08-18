---
phase: 104-nap-intent-and-manifest-contract-parity
plan: 02
subsystem: manifest-contracts
tags: [nap-intent, nip-5d, archetypes, signed-manifest, playground]
requires:
  - phase: 104-nap-intent-and-manifest-contract-parity
    plan: 01
    provides: exact intent value model and normalized convention identity
provides:
  - strict installed-manifest archetype contract parsing
  - lossless repeated-contract catalog adaptation
  - convention-bearing playground manifest authoring and final signing
affects: [104-03, 104-04, 104-05, 105]
tech-stack:
  added: []
  patterns: [fail-closed signed metadata, structural package adapter, path-only aggregate hashing]
key-files:
  created: []
  modified:
    - packages/nip/src/5d/index.ts
    - packages/services/src/manifest-intent-catalog.ts
    - apps/playground/napplets/shared-vite-config.ts
    - tests/unit/playground-gateway-guard.test.ts
key-decisions:
  - "Every archetype tag is one required queryless convention contract; repeated tags and same-tag event-kind order remain authoritative."
  - "Actions and conventions are derived indexes over lossless contracts, with no protocol aliases or invented open defaults."
  - "Playground final-manifest recomputation validates and signs the same contract shape while aggregate identity remains path-only."
patterns-established:
  - "Signed discovery metadata fails closed before it can become catalog authority."
  - "Cross-package manifest inputs stay structurally compatible without introducing a services-to-nip dependency."
requirements-completed: [BASE-01, BASE-02, INTENT-04, INTENT-05, ARCH-01, ARCH-02, ARCH-04]
coverage:
  - id: D1
    description: Every accepted installed archetype tag is a complete matching queryless convention contract with only safe ordered event kinds.
    requirement: ARCH-01
    verification:
      - kind: unit
        ref: packages/nip/src/5d/index.test.ts#archetype contracts
        status: pass
    human_judgment: false
  - id: D2
    description: Repeated manifest contracts survive catalog grouping with independent kind scopes and only derived action and convention indexes.
    requirement: INTENT-04
    verification:
      - kind: unit
        ref: packages/services/src/manifest-intent-catalog.test.ts
        status: pass
      - kind: unit
        ref: tests/unit/playground-intent-catalog.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Playground authoring rejects malformed contracts and final signed manifests emit exact repeated convention tags without NAP-N metadata.
    requirement: ARCH-04
    verification:
      - kind: unit
        ref: tests/unit/playground-gateway-guard.test.ts#archetype contract validation
        status: pass
      - kind: unit
        ref: tests/unit/playground-gateway-guard.test.ts#signed manifest recomputation
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-26
status: complete
---

# Phase 104 Plan 02: Exact Manifest Contract Pipeline Summary

**Verified manifests now fail closed on malformed intent metadata, preserve every repeated scoped contract through catalog adaptation, and produce exact convention-bearing playground artifacts.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-26T15:19:00+01:00
- **Completed:** 2026-07-26T15:26:00+01:00
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Replaced optional NAP-number archetype parsing with required matching queryless
  convention identities and exhaustive unsigned-safe event-kind validation.
- Preserved repeated same-slug and same-convention contracts in declaration order
  while deriving stable unique action and convention indexes without aliases or
  defaults.
- Made playground authoring and final signed-manifest recomputation emit exact
  convention-bearing tags, including the stable `napplet:profile/open` fixture,
  while retaining path-only aggregate identity.

## Task Commits

1. **Task 1: Parse one strict contract from every archetype tag** — `a134be2`
2. **Task 2: Group repeated contracts without inventing actions or protocols** — `d4d7fa7`
3. **Task 3: Validate and emit convention-bearing playground archetype metadata** — `029e64a`

## Files Created/Modified

- `packages/nip/src/5d/index.ts` — Strict verified-manifest contract parser.
- `packages/nip/src/5d/index.test.ts` — Valid, repeated, and malformed contract matrix.
- `packages/services/src/catalog-intent-resolver.ts` — Exact support and candidate model consumed by the catalog adapter.
- `packages/services/src/manifest-intent-catalog.ts` — Lossless contract grouping and derived indexes.
- `packages/services/src/manifest-intent-catalog.test.ts` — Repeated-contract and no-invention regressions.
- `apps/playground/src/napplet-resolver.ts` — Resolved manifest type aligned with required convention contracts.
- `apps/playground/src/playground-intent-catalog.ts` — Playground structural catalog projection aligned with exact support records.
- `tests/unit/playground-intent-catalog.test.ts` — Resolved-manifest-to-catalog parity coverage.
- `apps/playground/napplets/shared-vite-config.ts` — Exact authoring validation, serialization, and exported final recomputation helper.
- `apps/playground/napplets/profile-viewer/vite.config.ts` — Stable profile/open contract fixture.
- `tests/unit/playground-gateway-guard.test.ts` — Invalid authoring matrix, repeated scoped tags, aggregate, and signed artifact proof.

## Authority Check

Checked `napplet/naps` draft PR #91 at
`a718915ddefa2f03a0126579601f59d8bd86f7c4`, merged web projection
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`, and
`napplet/web@dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b` immediately before
implementation. The installed parser, structural adapter, and build metadata
conform to those exact sources.

## Decisions Made

- Reject malformed trailing tag fields instead of ignoring them, because signed
  metadata must not gain authority through partial parsing.
- Preserve duplicate contracts even when their quick-index strings repeat;
  indexes are conveniences and never replace authoritative contract entries.
- Export final manifest recomputation for contract testing while keeping signed
  bytes and path-only aggregate behavior unchanged.

## Deviations from Plan

### Auto-fixed: resolved playground structural consumers

- **Found during:** Task 2
- **Issue:** The plan named the playground catalog test but omitted the two source
  adapters whose structural types still exposed the removed optional `nap` field.
- **Fix:** Updated `apps/playground/src/napplet-resolver.ts` and
  `apps/playground/src/playground-intent-catalog.ts` in the same task.
- **Why required:** Leaving either adapter stale would break the exact
  resolved-manifest-to-catalog boundary that the planned regression asserts.

### Deferred cross-wave services verification

The package-wide `@kehto/services` type-check still reports only the deliberately
legacy resolver/service consumers assigned to Plans 104-03 and 104-04. The exact
manifest adapter tests pass, and the NIP package type-check is green. The full
services type-check remains a mandatory Phase 104 closure gate.

## Verification

- `pnpm exec vitest run packages/nip/src/5d/index.test.ts packages/services/src/manifest-intent-catalog.test.ts tests/unit/playground-intent-catalog.test.ts tests/unit/playground-gateway-guard.test.ts` — 69 passed.
- `pnpm --filter @kehto/nip type-check` — passed.
- `pnpm --filter @kehto/services type-check` — deferred; diagnostics are confined to Plan 104-03/04 legacy consumers.
- `pnpm --filter @kehto/playground type-check` — package has no `type-check` script.
- Direct `tsc --noEmit` for the app additionally exposed pre-existing DM-map omissions, old generated package declarations, and unavailable old-package theme resolution; the repository-wide build/type gates remain the authoritative closure check.
- A direct standalone profile Vite build reached the existing single-file artifact guard with copied asset/demo files; final recomputation is proven in an isolated signed-artifact test, and the official repository build remains pending.
- `git diff --check` — passed.
- Package and lockfile diff check — no changes.
- AI-slop gate — unavailable; the workspace contains no configured script or installed executable.

## User Setup Required

None.

## Next Phase Readiness

Plan 104-03 can now select only catalog-authorized exact convention contracts
and retain immutable deliveries without relying on protocol aliases or defaults.
Plans 104-03 and 104-04 must close the recorded services type-check transition.

## Self-Check: PASSED

- All eleven modified files exist and task commits `a134be2`, `d4d7fa7`, and
  `029e64a` are present.
- The focused 69-test matrix and NIP type-check pass.
- No package manifest, lockfile, dependency adoption, runtime delivery lifecycle,
  live host flow, generated docs, or changeset work entered this plan.
