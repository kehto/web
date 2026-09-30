---
phase: 105-published-convention-adoption-and-host-flows
plan: 08
subsystem: playground intent host
tags: [playground, nap-intent, verified-manifest, retained-delivery]
requires:
  - phase: 105-05
    provides: "Published NAP-INTENT values plus exact installed-contract resolver policy."
  - phase: 105-06
    provides: "Persistent verified-install and retained-target patterns proven in Paja."
provides:
  - "Persistent resolver-verified playground install catalog independent of live iframes."
  - "Retained source-bound playground intent controller with current-generation exactly-once delivery."
  - "Catalog-backed playground intent service with fail-closed chooser and explicit-target policy."
affects: [105-09-playground-profile-flow, playground-browser-host]
tech-stack:
  added: ["Direct @napplet/core and @napplet/nap 0.29.0 playground dependencies"]
  patterns: [verified-install-catalog, retained-target-controller, source-bound-ready-delivery]
key-files:
  created:
    - apps/playground/src/installed-napplet-catalog.ts
    - apps/playground/src/playground-intent-controller.ts
    - tests/unit/playground-installed-catalog.test.ts
    - tests/unit/playground-intent-controller.test.ts
  modified:
    - apps/playground/package.json
    - apps/playground/src/acl-panel.ts
    - apps/playground/src/shell-host.ts
    - apps/playground/src/main.ts
    - pnpm-lock.yaml
    - tests/unit/nip5d-conformance-guard.test.ts
    - tests/unit/playground-gateway-guard.test.ts
key-decisions:
  - "Resolver-verified manifest facts and restart descriptors persist independently of frames, sessions, and source generations."
  - "Only a registered current `shell.ready` source can receive a target-only `intent.deliver`; the host exposes no INC route."
  - "Playground remains fail-closed for ambiguous chooser and explicit handler selections until Plan 09 supplies live user policy."
  - "The NAP registry has no NAP-DM capability policy at c5cd06f; playground exposes the existing canonical `dm:*` Capability union labels without enabling a DM service or authorization policy."
patterns-established:
  - "Install catalog changes notify the resolver by archetype while frame replacement clears only live generation state."
  - "Retained delivery revalidates the exact installed manifest contract before opening a cold target."
requirements-completed: [PKG-01, ARCH-03]
coverage:
  - id: D1
    description: "Verified playground installations remain eligible for discovery after frame teardown and disappear only on explicit uninstall."
    requirement: PKG-01
    verification:
      - kind: unit
        ref: tests/unit/playground-installed-catalog.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Playground retains, starts, source-binds, and delivers an accepted intent exactly once with fail-closed target selection."
    requirement: ARCH-03
    verification:
      - kind: unit
        ref: tests/unit/playground-intent-controller.test.ts
        status: pass
      - kind: unit
        ref: tests/unit/playground-shell-host-proxy.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Playground TypeScript resolves its direct published Napplet imports and keeps its Capability maps exhaustive."
    requirement: PKG-01
    verification:
      - kind: unit
        ref: tests/unit/playground-capability-maps.test.ts
        status: pass
      - kind: other
        ref: pnpm exec tsc -p apps/playground/tsconfig.json --noEmit
        status: pass
    human_judgment: false
metrics:
  duration: 20m
  completed: 2026-07-27
status: complete
---

# Phase 105 Plan 08: Playground Verified Catalog and Retained Intent Controller Summary

**Playground now resolves handlers from persistent verified manifests and delivers accepted intents once to a current `shell.ready` target source.**

## Performance

- **Duration:** 20m
- **Started:** 2026-07-27T09:40:00Z
- **Completed:** 2026-07-27T09:53:38Z
- **Tasks:** 2/2
- **Files modified:** 12

## Accomplishments

- Added an immutable, serializable installed catalog that records only resolver-verified aggregate, manifest-contract, and restart facts; live frame lifecycle cannot alter availability.
- Inserted installations immediately after successful resolver verification, added explicit uninstall/default discovery notifications, and retained the lossless manifest adapter.
- Composed `createCatalogIntentResolver`, `createIntentService`, and a retained target controller before shell creation so `intent` is present in each frozen playground shell environment.
- Bound target readiness and `intent.deliver` to the registered current iframe source, with replacement/retry/current-generation checks and no INC delivery path.

## NAP Authority

Checked `napplet/naps` NAP-INTENT PR #91 head `a718915ddefa2f03a0126579601f59d8bd86f7c4` at `naps/NAP-INTENT.md`. This implementation is conformant with manifest-backed availability, acceptance-before-start, source-independent retention, target-ready delivery, runtime-attested sender, exact compatible selection, and the required absence of a visible INC dependency. Also checked current `napplet/naps@c5cd06f7be6d4690b303949abb26e87ff62f4729:naat/dm.md`: it defines only the `napplet:dm/open` role and points to NAP-INTENT; no NAP-DM capability policy exists. The completion fix therefore labels the existing shell `dm:*` Capability union but does not create a DM service, grant, or policy.

## Verification

- `pnpm exec vitest run tests/unit/playground-installed-catalog.test.ts tests/unit/playground-intent-catalog.test.ts tests/unit/playground-shell-host-proxy.test.ts` — passed (7 tests).
- `pnpm exec vitest run tests/unit/playground-intent-controller.test.ts tests/unit/playground-installed-catalog.test.ts tests/unit/playground-shell-host-proxy.test.ts` — passed (9 tests).
- Wave 6 aggregate Vitest gate — passed (7 files, 22 tests).
- `pnpm install --lockfile-only` and `pnpm install --frozen-lockfile` — passed.
- `pnpm exec tsc -p apps/playground/tsconfig.json --noEmit` — passed.
- Reopened focused playground/conformance suite — passed (7 files, 42 tests).
- `pnpm --filter @kehto/playground build` — passed.
- `pnpm test:unit` — passed (123 files, 1,526 tests).
- `git diff --check` — passed.
- `npx --no-install aislop scan -d` — completed with the existing 71/100 warning baseline and no errors.

## Task Commits

1. **Task 1: Keep a verified profile candidate installed after frame close** — `c343cd5` (test), `ded3572` (feat)
2. **Task 2: Select, retain, start, and deliver through playground** — `1f3c65f` (test), `9ffb9aa` (feat)
3. **Rule 3 completion: Restore direct compiler and exhaustive Capability maps** — `1ad05d6` (test), `f526d1c` (fix), `d40e807` (test)

## Files Created/Modified

- `apps/playground/src/installed-napplet-catalog.ts` — persistent verified manifest records, exact catalog entries, defaults, and discovery changes.
- `apps/playground/src/playground-intent-controller.ts` — immutable retention and bounded current-generation delivery policy.
- `apps/playground/src/shell-host.ts` — verified catalog insertion, target lifecycle callbacks, registered-source ready mapping, and target-only send.
- `apps/playground/src/main.ts` — catalog resolver and intent-service composition before shell boot.
- `tests/unit/playground-installed-catalog.test.ts` — installation persistence and explicit-uninstall coverage.
- `tests/unit/playground-intent-controller.test.ts` — cold/replacement/exactly-once and fail-closed selection coverage.
- `apps/playground/package.json` and `pnpm-lock.yaml` — exact published 0.29.0 imports materialized for playground compilation.
- `apps/playground/src/acl-panel.ts` and `tests/unit/playground-capability-maps.test.ts` — exhaustive canonical Capability labels/hints and regression coverage.

## Decisions Made

- Kept catalog authority separate from browser state: only `resolvePlaygroundNapplet` output becomes an installation record, and only explicit uninstall removes it.
- Kept user policy fail-closed: stale defaults, cancelled/invalid choice, and every explicit handler request reject until a user authorization surface exists.
- Used a real `intent.deliver` host push only after current source registration rather than adapting the pre-existing INC route.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored the direct playground TypeScript gate**
- **Found during:** Reopened Task 2 verification.
- **Issue:** The explicit playground compiler command could not resolve direct published Napplet type imports, and existing `Record<Capability, …>` maps omitted the canonical `dm:read`/`dm:write` union keys.
- **Fix:** Added exact published `@napplet/core` and `@napplet/nap` runtime dependencies, regenerated and frozen-materialized the lockfile, completed the display/snapshot maps without enabling DM policy, and updated stale static guards for the already catalog-backed Paja and three-argument playground shell bootstrap.
- **Files modified:** `apps/playground/package.json`, `pnpm-lock.yaml`, `apps/playground/src/acl-panel.ts`, `apps/playground/src/shell-host.ts`, and focused guard tests.
- **Verification:** Lockfile-only and frozen installs, direct playground `tsc`, focused suites, playground build, and all 1,526 unit tests pass.
- **Committed in:** `1ad05d6`, `f526d1c`, `d40e807`

**Total deviations:** 1 auto-fixed (Rule 3). The correction is required for the plan's explicit TypeScript acceptance criterion and does not broaden the DM policy surface.

## Issues Encountered

- The initial direct compiler run exposed missing import ownership and exhaustive Capability entries. The Rule 3 correction resolved all six diagnostics. The full unit run then exposed two stale static guard slices left behind by the already-migrated catalog-backed Paja implementation and the new intent-service boot argument; both guards now assert the current conformant seams.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 09 can wire the live feed/profile UI onto an installed, cold-start-capable profile handler without deriving availability from frames. It must preserve the controller's exact-contract, ready-source, and target-only delivery seams.

## Self-Check: PASSED

- All plan-owned implementation/test artifacts and the Rule 3 compiler correction exist.
- Task commits `c343cd5`, `ded3572`, `1f3c65f`, `9ffb9aa`, `1ad05d6`, `f526d1c`, and `d40e807` exist and each has the required `Co-Authored-By: Codex <noreply@openai.com>` trailer.
- Stub scan found no placeholder data or incomplete rendering path in the plan-owned files.
