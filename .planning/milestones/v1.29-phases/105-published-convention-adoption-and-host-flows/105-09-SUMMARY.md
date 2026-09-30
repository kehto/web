---
phase: 105-published-convention-adoption-and-host-flows
plan: 09
subsystem: playground profile intent and resource media
tags: [playground, nap-intent, nap-identity, resource-bytes, playwright]
requires:
  - phase: 105-08
    provides: "Verified installed catalog and retained, source-bound playground intent controller."
provides:
  - "Feed-to-profile invocation through the published query-bearing convention URI."
  - "Target-only profile intent delivery with safe, revocable Blob media URLs."
  - "Live browser coverage for source teardown, no profile INC route, and synchronized theme state."
affects: [105-10, playground-profile-flow, identity-theme-conformance]
tech-stack:
  added: []
  patterns: [published-intent-invoke, target-only-on-delivery, resource-bytes-blob-url, ready-source-reuse]
key-files:
  created:
    - apps/playground/napplets/feed/src/profile-media.ts
    - apps/playground/napplets/profile-viewer/src/profile-media.ts
    - tests/unit/profile-resource-media.test.ts
    - tests/e2e/playground-profile-intent.spec.ts
  modified:
    - apps/playground/napplets/feed/src/main.ts
    - apps/playground/napplets/profile-viewer/src/main.ts
    - apps/playground/napplets/profile-viewer/vite.config.ts
    - apps/playground/src/shell-host.ts
    - apps/playground/src/main.ts
    - tests/e2e/profile-open.spec.ts
    - tests/e2e/identity-flow.spec.ts
    - tests/e2e/theme-broadcast.spec.ts
    - tests/unit/nip5d-conformance-guard.test.ts
    - tests/unit/playground-gateway-guard.test.ts
key-decisions:
  - "Use the published intent URI and target-only delivery; retain no profile INC route or subscription."
  - "Resolve profile picture and banner bytes only through resourceBytes and use one revocable Blob URL per sink."
  - "A previously registered live target is immediately eligible only when its current iframe source is still origin-registered and session-bound."
patterns-established:
  - "Frozen shell environments must receive a live service capability on the same adapter instance used for environment resolution."
  - "Resource-media controllers tokenize requests and revoke on replacement, error, clear, and pagehide."
requirements-completed: [PKG-03, IDENTITY-05, THEME-04, ARCH-03]
coverage:
  - id: D1
    description: "Feed invocation cold-starts the verified profile handler and sends one runtime-attested delivery after its source closes, without an INC carrier."
    requirement: ARCH-03
    verification:
      - kind: e2e
        ref: tests/e2e/playground-profile-intent.spec.ts#accepts the feed profile convention before its source closes and cold-starts one profile delivery without INC
        status: pass
    human_judgment: false
  - id: D2
    description: "Profile picture and banner media stays behind resourceBytes with stale-safe Blob URL lifecycle cleanup."
    requirement: IDENTITY-05
    verification:
      - kind: unit
        ref: tests/unit/profile-resource-media.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Migrated profile and identity browser paths use published intent and preserve current-plus-changed theme state."
    requirement: THEME-04
    verification:
      - kind: e2e
        ref: tests/e2e/profile-open.spec.ts, tests/e2e/identity-flow.spec.ts, tests/e2e/theme-broadcast.spec.ts
        status: pass
    human_judgment: false
  - id: D4
    description: "Feed and profile consume the released intent/resource SDK surfaces and emit matching profile archetype metadata."
    requirement: PKG-03
    verification:
      - kind: other
        ref: pnpm --filter @kehto/demo-feed build && pnpm --filter @kehto/demo-profile-viewer build
        status: pass
    human_judgment: false
metrics:
  duration: 32m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 09: Live Profile Intent and Safe Media Summary

**The playground feed now invokes `napplet:profile/open`, profiles receive one retained target-only delivery, and identity media renders only from host-mediated revocable Blob URLs.**

## Performance

- **Duration:** 32m
- **Started:** 2026-07-27T10:30:58Z
- **Completed:** 2026-07-27T11:02:50Z
- **Tasks:** 2/2
- **Files modified:** 14

## Accomplishments

- Replaced feed/profile `profile:open` INC traffic with the released `intentInvoke`/`intentOnDelivery` profile convention, including queryless profile manifest metadata.
- Added stale-safe feed avatar and profile picture/banner controllers that fetch through `resourceBytes`, assign only Blob URLs, and revoke every owned URL on replacement, denial/error, clear, and pagehide.
- Migrated the profile, identity, and theme browser proofs and added a focused cold-target retained-delivery proof: it closes the profile before invocation, closes the feed after acceptance, observes one target delivery, and rejects an INC carrier.
- Repaired frozen shell intent advertisement and reused a current trusted ready target without weakening origin/session checks.

## NAP Authority

- **NAP-INTENT:** `napplet/naps` PR #91 head `a718915ddefa2f03a0126579601f59d8bd86f7c4`; conformant with URI normalization, accepted-retention semantics, target-only delivery, and source-independent delivery.
- **NAP-IDENTITY / NAP-THEME:** current master `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`; profile picture/banner bytes follow identity's explicit `resource.bytes` delegation and theme coverage retains the automatic current/changed contract.
- **NAP-RESOURCE gap:** no standalone `NAP-RESOURCE.md` exists at that master ref. This plan follows only NAP-IDENTITY's explicit delegation, the released `@napplet/nap@0.29.0` resource declarations, and Kehto's existing policy; it adds no inferred wire semantics.

## Verification

- `pnpm exec vitest run tests/unit/playground-gateway-guard.test.ts tests/unit/nip5d-conformance-guard.test.ts tests/unit/profile-resource-media.test.ts` — passed (36 tests).
- `pnpm test:unit` — passed (124 files, 1,537 tests).
- `pnpm --filter @kehto/demo-feed build && pnpm --filter @kehto/demo-profile-viewer build && pnpm --filter @kehto/demo-resource-demo build` — passed.
- `pnpm --filter @kehto/playground build` — passed.
- `pnpm exec tsc -p apps/playground/tsconfig.json --noEmit` — passed.
- `pnpm exec playwright test tests/e2e/playground-profile-intent.spec.ts tests/e2e/profile-open.spec.ts tests/e2e/identity-flow.spec.ts tests/e2e/theme-broadcast.spec.ts --workers=1` — passed (5 tests).
- `git diff --check` — passed.
- `npx --no-install aislop scan -d` — completed with 70/100 and 12 pre-existing warnings outside this plan's files; no errors or plan-owned findings remain.

## Task Commits

1. **Task 1: Invoke/receive the profile convention and own safe media URLs** — `febece0` (RED test), `1bd16c2` (feature), `275c009` (cleanup)
2. **Task 2: Replace legacy INC browser proofs with retained intent/onDelivery** — `aab2121` (RED test), `52c5c96` (host fix), `c652c0b` (cold-target correction), `ff26bd6` (full-unit guard correction)

## Files Created/Modified

- `apps/playground/napplets/feed/src/main.ts` and `profile-media.ts` — published profile invocation and safe avatar rendering.
- `apps/playground/napplets/profile-viewer/src/main.ts`, `profile-media.ts`, and `index.html` — early target delivery receiver plus Blob-backed picture/banner rendering.
- `apps/playground/napplets/profile-viewer/vite.config.ts` and `tests/unit/nip5d-conformance-guard.test.ts` — manifest requires match the released intent/resource use and preserve a static regression assertion.
- `apps/playground/src/shell-host.ts` and `main.ts` — trusted ready-target reuse plus live-frame close/test-observation seams that retain verified catalog authority.
- `tests/unit/profile-resource-media.test.ts` — resource bytes, stale completion, denial, and URL revocation vectors.
- `tests/e2e/playground-profile-intent.spec.ts`, `profile-open.spec.ts`, `identity-flow.spec.ts`, and `theme-broadcast.spec.ts` — deterministic browser evidence for the retained convention and theme behavior.

## Decisions Made

- Kept the full live environment rather than treating the absence of an `inc` global as proof of no INC use; tests prove the active profile route through the published intent API.
- Reused an already-ready target only after checking its current iframe source, origin registry entry, and runtime session, retaining NAP-SHELL source binding.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Revoke Blob URLs after image decode errors**
- **Found during:** Task 1
- **Issue:** The new safe media controller needed source-level image error hooks to release URLs after failed image rendering.
- **Fix:** Attached feed/profile image error handlers that clear and revoke the active sink URL.
- **Files modified:** feed/profile media consumers.
- **Verification:** `profile-resource-media.test.ts` passes error and cleanup coverage.
- **Committed in:** `1bd16c2`

**2. [Rule 1 - Bug] Advertise intent through the stable frozen environment adapter**
- **Found during:** Task 2 browser verification
- **Issue:** Replacing `hooks.services` registered the handler but left `intent` absent from already-resolved capability snapshots.
- **Fix:** Mutated the existing adapter service map and enabled its `IntentHooks` availability predicate.
- **Files modified:** `apps/playground/src/shell-host.ts`
- **Verification:** profile/identity Playwright specs pass with the published intent API present.
- **Committed in:** `52c5c96`, `275c009`

**3. [Rule 1 - Bug] Resolve an already-ready live target generation immediately**
- **Found during:** Task 2 browser verification
- **Issue:** A live profile target waited indefinitely for a second `shell.ready` after an accepted intent.
- **Fix:** Reused its source only when the iframe, origin registry, and session registry agree, then resolved the retained delivery gate.
- **Files modified:** `apps/playground/src/shell-host.ts`
- **Verification:** source-teardown focused E2E passes exactly once.
- **Committed in:** `52c5c96`

**4. [Rule 1 - Bug] Correct stale profile manifest metadata and cold-target proof**
- **Found during:** Post-plan acceptance inspection
- **Issue:** The profile manifest still declared legacy `inc` requirements, and the focused browser test had loaded the target before invocation, so it did not prove retained cold-start delivery.
- **Fix:** Declared `intent`, `relay`, `resource`, and `theme`; updated the static manifest guard; added lifecycle-safe close handling and an E2E that closes the verified target before invocation, closes the source after acceptance, observes exactly one `intent.deliver`, and rejects INC envelopes.
- **Files modified:** profile Vite config, conformance guard, playground host/bootstrap, focused Playwright spec.
- **Verification:** 21 focused unit tests, three napplet builds, playground build/typecheck, and all four required Playwright specs pass.
- **Committed in:** `c652c0b`

**5. [Rule 1 - Bug] Update the active gateway guard from transitional INC assumptions**
- **Found during:** Wave 7 full-unit gate
- **Issue:** `playground-gateway-guard.test.ts` still required legacy feed/profile `inc` manifests and imports, so the full unit suite rejected the shipped published intent/resource flow.
- **Fix:** Assert the exact published `intent`/`resource` manifest requirements, queryless profile archetype metadata, `intentInvoke`/`intentOnDelivery`, Blob-backed media controllers, and the absence of active profile INC imports/carriers.
- **Files modified:** `tests/unit/playground-gateway-guard.test.ts`.
- **Verification:** focused gateway/NIP-5D/media guards (36 tests) and full `pnpm test:unit` (124 files, 1,537 tests) pass.
- **Committed in:** `ff26bd6`

**Total deviations:** 5 auto-fixed (4 Rule 1, 1 Rule 2). All were necessary for the plan's source-bound delivery and media-security requirements.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The retained playground profile flow is ready for the remaining Phase 105 convention and host-flow plans. The verified `srcdoc` loader and mandatory Kehto-owned NAP-SHELL prelude remain unchanged.

## Self-Check: PASSED

- All plan-owned sources, tests, and this summary exist.
- All seven Plan 105-09 task and correction commits exist and carry `Co-Authored-By: Codex <noreply@openai.com>`.
- Stub scan found no placeholder or unwired plan-owned rendering path.
