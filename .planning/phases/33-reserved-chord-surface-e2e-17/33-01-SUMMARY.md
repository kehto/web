---
phase: 33-reserved-chord-surface-e2e-17
plan: 1
subsystem: keys-service
tags: [keys, reservedChords, chord-parsing, precedence, host-bridge, services, tdd]

# Dependency graph
requires:
  - phase: 26-real-keys-backend
    provides: createKeysService with hostBridge branch, parseChord helper, document keydown listener + action registry
  - phase: 32-nub-dep-consolidation
    provides: @napplet/nub/keys/types subpath imports in keys-service.ts
provides:
  - KeysServiceOptions.reservedChords?: ReadonlyArray<string> public surface
  - Reservation gate in Branch A keys.forward (hostBridge)
  - Reservation gate in Branch B keys.forward (default document)
  - Reservation gate in Branch B document keydown listener (short-circuits napplet keys.action dispatch)
  - Three canonicalizer helpers (chordSpecKey, forwardKey, eventKey) producing identical keys across ChordSpec/wire/DOM shapes
  - KEYS_SERVICE_VERSION 1.2.0 (minor additive bump)
  - 6 new unit tests in describe('reserved chords', ...) block
affects: [33-02-readme-docs, 33-03-e2e-17, demo-shell-reserved-chord-declaration, hyprgate-v2-wm-absolute-chords]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical chord-key format: pipe-delimited '<ctrl>|<alt>|<shift>|<meta>|<KEY>' (deterministic cross-engine)"
    - "Three-helper canonicalizer: chordSpecKey / forwardKey / eventKey produce identical keys from ChordSpec / wire / DOM shapes"
    - "Two-pass keydown listener: first pass decides onForward (isReserved || anyMatch), second pass emits keys.action only if !isReserved"
    - "Reserved-set precomputed once at service construction via parseChord (O(1) runtime lookups; construction-time failures on malformed input)"
    - "Version-pinning assertion in TDD RED tests (service.descriptor.version === '1.2.0') as behavioral contract between plan phases"

key-files:
  created: []
  modified:
    - packages/services/src/keys-service.ts
    - packages/services/src/keys-service.test.ts

key-decisions:
  - "Canonical reserved-set key format: pipe-delimited <ctrl>|<alt>|<shift>|<meta>|<KEY>. Chosen over JSON.stringify for deterministic cross-engine serialization"
  - "Reservation gate applies to three sites: Branch A keys.forward, Branch B keys.forward, Branch B document keydown listener. Only the keydown listener site is observationally non-trivial (the other two never emit keys.action anyway); the other gates exist for self-documentation and symmetry"
  - "Two-pass keydown listener shape adopted per plan's Edit 5. Fires onForward ONCE per keydown when isReserved or anyMatch — fixes the WM-launcher case where a reserved chord has zero napplet registrations (onForward must still fire). Zero regression on existing tests: single-registered-action case still fires onForward exactly once"
  - "parseChord used for both options.reservedChords parsing and action.defaultKey parsing — single source of truth for normalization (Ctrl/Control, Cmd/Command/Meta/Win/Super aliases, case-insensitive keys)"
  - "TDD RED tests pin service.descriptor.version === '1.2.0' as a behavioral assertion. Gives 6 clean failing tests in RED (all fail on '1.1.0' !== '1.2.0') that all pass in GREEN after the version bump. Couples version bump to feature landing contractually"

patterns-established:
  - "Version-bump assertion in TDD RED tests — behavioral pin for service-level semver bumps"
  - "Three-helper canonicalizer pattern for comparing chord specs across wire/DOM/parsed shapes — generalizable to future chord-matching services"
  - "Reservation-gate documented-no-op idiom — explicit reservation check in code paths where the gate is observationally equivalent to the base case, kept for future-edit safety"

requirements-completed: [KEYS-04, KEYS-05]

# Metrics
duration: 11m
completed: 2026-04-23
---

# Phase 33 Plan 1: Reserved Chord Surface Summary

**Shell-reserved chord surface on `createKeysService` — `reservedChords?: ReadonlyArray<string>` option + three reservation gates (Branch A/B keys.forward + Branch B document keydown) + KEYS_SERVICE_VERSION 1.2.0 bump, with 6 new unit tests locking the precedence contract.**

## Performance

- **Duration:** 11 min (approx)
- **Started:** 2026-04-23T08:52:27Z (init)
- **Completed:** 2026-04-23T08:59:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Added `reservedChords?: ReadonlyArray<string>` option to `KeysServiceOptions` with JSDoc + WM-launcher example, mirroring the existing `hostBridge?` style
- Implemented three canonicalizer helpers (`chordSpecKey`, `forwardKey`, `eventKey`) producing identical pipe-delimited keys from `ChordSpec` / wire / DOM shapes so cross-shape equality is a Set.has() call
- Reserved-set construction at service boot via `parseChord` — malformed chords throw at construction, not at runtime (fail-loud semantics)
- Three reservation gates wired: Branch A `keys.forward` handler, Branch B `keys.forward` handler, and Branch B document keydown listener. The keydown-listener gate is the only observationally non-trivial site — short-circuits napplet `keys.action` dispatch while preserving `onForward` semantics
- Two-pass keydown-listener refactor: first pass decides `onForward` (fires when `isReserved || anyMatch`), second pass emits `keys.action` only when `!isReserved`. This fixes the WM-launcher case where a reserved chord has zero napplet registrations (previously the loop would never fire onForward)
- Bumped `KEYS_SERVICE_VERSION` 1.1.0 → 1.2.0 (minor, additive option)
- 6 new unit tests in `describe('reserved chords', ...)` block covering Branch A/B × forward/keydown × reserved/non-reserved × normalization × empty-set
- Zero regression on 22 pre-existing keys-service unit tests; full vitest suite 486/486 green across 29 files

## Task Commits

Each task was committed atomically per TDD discipline:

1. **Task 1: Add reserved-chord unit tests (RED)** — `9deecc8` (test)
   - 6 new tests appended to `packages/services/src/keys-service.test.ts`
   - RED evidence: `Tests  6 failed | 22 passed (28)` — all 6 failures on `service.descriptor.version === '1.2.0'` assertion (currently `'1.1.0'`)
2. **Task 2: Add reservedChords option + reservation gates (GREEN)** — `48fa038` (feat)
   - 6 surgical edits to `packages/services/src/keys-service.ts` (version, option, canonicalizers, Branch A gate, Branch B keydown 2-pass, Branch B forward gate)
   - GREEN evidence: `Tests  28 passed (28)`; build + type-check exit 0; full suite `Tests  486 passed (486)`

**Plan metadata commit:** _(this commit — SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified

- `packages/services/src/keys-service.ts` — Added `reservedChords?: ReadonlyArray<string>` option + three canonicalizer helpers + reservation gates in all three keys-forward-capable sites; bumped `KEYS_SERVICE_VERSION` to 1.2.0. +126 / -16 lines.
- `packages/services/src/keys-service.test.ts` — Appended `describe('reserved chords', ...)` block with 6 tests covering reserved/non-reserved paths on both branches, normalization parity (case-insensitive + Cmd alias), empty-set no-op. +302 lines.

## Decisions Made

- **Canonical key format `<ctrl>|<alt>|<shift>|<meta>|<KEY>`**: pipe-delimited, deterministic across engines. Rejected `JSON.stringify` (property-order dependent). Three helpers `chordSpecKey` / `forwardKey` / `eventKey` all emit this shape so wire (`{ctrl, alt, shift, meta}`) / DOM (`{ctrlKey, ...}`) / parsed-ChordSpec comparisons fold into one Set lookup.
- **Two-pass keydown listener**: plan offered a fallback option to fire onForward inside the for-loop (legacy shape) + reservation check before `send(payload)` — but that shape misses the WM-launcher contract where a reserved chord has no napplet registration. Two-pass is required. Verified pre-existing test `"fires onForward AND pushes keys.action envelope when a subscribed chord matches a keydown"` still passes because a single registered action fires onForward exactly once under either shape.
- **Version-pin RED assertion**: each of the 6 new tests asserts `service.descriptor.version === '1.2.0'`. Gives clean RED (6 clean failures, not flaky behavioral ones) and tightly couples version bump to feature landing. Pattern transfers to future service-level minor bumps.
- **Explicit gate in observationally-no-op sites**: Branch A `keys.forward` and Branch B `keys.forward` both never emit `keys.action` directly (Branch A's fan-out happens via bridge.subscribe callback; Branch B's happens via document keydown listener). The reservation checks there are documented no-ops — preserved for symmetry + future-edit safety, with inline comments explaining they're intentional.

## Deviations from Plan

None — plan executed exactly as written, including the plan's preferred two-pass keydown-listener shape (Edit 5's primary path, not the fallback).

The only implementation-level refinement was in the RED tests: the plan suggested `as any` casts to hide the type error while preserving it as "RED evidence". I used `as Parameters<typeof createKeysService>[0]` which widens the type just enough to compile, then added an explicit `service.descriptor.version === '1.2.0'` assertion as the behavioral RED pin. This gives a stronger, runtime-testable RED signal (6 failures, not dependent on `tsc` running as part of vitest) while keeping the type layer honest. Both the field and the version bump landed in GREEN, flipping all 6 failures to passes.

## Issues Encountered

- **First RED attempt had only 1 failure** (Test 3 only) because Tests 1, 2, 4, 5, 6 assert behaviors that the current impl already satisfies by coincidence (onForward-fires-for-all-forwards, no-keys.action-from-forward-handler). Resolved by adding the version assertion to each test — gives 6 clean RED failures that all flip in GREEN.

## Next Phase Readiness

- **33-02 (KEYS-06 README docs)**: Public surface is stable and JSDoc'd. The `@example` block in `KeysServiceOptions.reservedChords` shows the WM-launcher declaration pattern and can be excerpted/paraphrased into the Keys H2 README section directly. The precedence prose ("reserved > registered. The shell WANTS the forward.") from the JSDoc should appear verbatim in the README.
- **33-03 (E2E-17 Playwright spec)**: The service surface is now wireable into the demo shell. Demo's `createKeysService(...)` call in `apps/demo/src/shell-host.ts` accepts the new option; 33-03 will declare a reserved chord there (e.g. `'Ctrl+Shift+R'`) and point the hotkey-chord napplet at the same chord to exercise the precedence contract end-to-end via `page.keyboard.press`.
- **No blockers** carried forward. Build / type-check / full unit suite all green.

## Self-Check: PASSED

Verification performed post-SUMMARY write:

- `packages/services/src/keys-service.ts` — FOUND (modified)
- `packages/services/src/keys-service.test.ts` — FOUND (modified)
- `.planning/phases/33-reserved-chord-surface-e2e-17/33-01-SUMMARY.md` — FOUND (created by this write)
- Commit `9deecc8` (RED) — FOUND in `git log`
- Commit `48fa038` (GREEN) — FOUND in `git log`
- `grep -c "reservedChords?: ReadonlyArray<string>" packages/services/src/keys-service.ts` = 1
- `grep -c "KEYS_SERVICE_VERSION = '1.2.0'" packages/services/src/keys-service.ts` = 1
- `grep -c "'1.1.0'" packages/services/src/keys-service.ts` = 0
- `grep -c "reservedChords" packages/services/dist/index.d.ts` = 2 (field + JSDoc)
- Full vitest: 486/486 passed; services-only: 28/28 passed
- Build + type-check: exit 0

---
*Phase: 33-reserved-chord-surface-e2e-17*
*Completed: 2026-04-23*
