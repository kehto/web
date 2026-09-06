---
phase: 103-identity-and-theme-wire-parity
plan: 05
subsystem: paja
tags: [paja, theme, nap-theme, shell-bridge, playwright, vitest]
requires:
  - phase: 103-02
    provides: complete ThemeService state-before-callback behavior
  - phase: 103-03
    provides: authenticated eligible-session ShellBridge theme delivery
  - phase: 103-04
    provides: protected parent-authenticated theme binding
provides:
  - A one-time Paja ThemeService-to-ShellBridge broadcast link
  - State-before-forward and exact-cardinality regression coverage
  - Opaque-origin browser proof for immediate theme changed/get parity
affects: [paja, shell, theme, playground]
tech-stack:
  added: []
  patterns:
    - Adapter-before-bridge construction uses an explicit one-time internal attachment seam
    - Hosts mutate ThemeService once and use its callback as the only theme delivery path
key-files:
  created:
    - packages/paja/src/theme-broadcast.ts
  modified:
    - packages/paja/src/browser-adapter.ts
    - packages/paja/src/browser-host.ts
    - packages/paja/src/browser-host.test.ts
    - tests/e2e/paja-single-window.spec.ts
key-decisions:
  - "Paja rejects a ThemeService callback before bridge attachment or a replacement bridge rather than buffering/replaying host theme state."
  - "Paja's setThemeMode mutates its simulation then calls the retained ThemeService once; only the service callback may reach ShellBridge.publishTheme."
patterns-established:
  - "For a service constructed before a host bridge, retain a private callback link and attach the bridge once before exposing interactive state."
requirements-completed: [THEME-03, THEME-05]
coverage:
  - id: D1
    description: Paja stores a complete theme before one eligible ShellBridge forwarding call
    requirement: THEME-03
    verification:
      - kind: unit
        ref: packages/paja/src/browser-host.test.ts#forwards one stored theme through one attached bridge without replay or replacement
        status: pass
      - kind: e2e
        ref: tests/e2e/paja-single-window.spec.ts#applies simulation config and compact theme adjustment
        status: pass
    human_judgment: false
  - id: D2
    description: Paja uses automatic protected theme change delivery without theme subscribe or unsubscribe traffic
    requirement: THEME-05
    verification:
      - kind: e2e
        ref: tests/e2e/paja-single-window.spec.ts#applies simulation config and compact theme adjustment
        status: pass
    human_judgment: false
metrics:
  duration: 5m
  completed: 2026-07-23
status: complete
---

# Phase 103 Plan 05: Paja Theme Broadcast Parity Summary

**Paja now sends one complete stored theme through its authenticated ShellBridge path, and its real opaque-origin target proves the automatic changed event immediately matches a protected theme read.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-23T22:32:00Z
- **Completed:** 2026-07-23T22:37:00Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments

- Added a private, single-attachment Paja broadcast link that rejects premature callbacks and bridge replacement, then forwards `ThemeChangedMessage.theme` once through `ShellBridge.publishTheme`.
- Replaced Paja's no-op ThemeService callback while retaining `ThemeService.publishTheme` as the sole state mutation and fan-out trigger for `setThemeMode`.
- Extended the sandboxed target proof to register the protected local `theme.onChanged`, immediately call `theme.get` in that callback, and assert one changed delivery with no theme subscription traffic.

## Task Commits

1. **Task 1: Trace one retained ThemeService update through one eligible ShellBridge publish** — `357d599` (test), `ac0e062` (feat)
2. **Task 2: Prove immediate theme changed/get parity in the real sandboxed Paja target** — `30271ad` (test)

## Files Created/Modified

- `packages/paja/src/theme-broadcast.ts` — private one-time link from ThemeService callbacks to the authenticated bridge.
- `packages/paja/src/browser-adapter.ts` — injects the live broadcast callback into the retained ThemeService.
- `packages/paja/src/browser-host.ts` — creates and attaches the link before browser state is exposed; keeps one service publish in `setThemeMode`.
- `packages/paja/src/browser-host.test.ts` — proves callback-time state ordering, exact forwarding, pre-attachment failure, and no direct host fan-out.
- `tests/e2e/paja-single-window.spec.ts` — proves automatic changed/get parity and no subscription traffic in the opaque-origin target.

## Decisions Made

- Checked `NAP-THEME.md` and `projections/web.md` at `napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f`. This implementation conforms to its automatic `theme.changed` model, complete color payloads, and prohibition on theme subscription/unsubscription.
- The link deliberately has no queue or replay behavior: Paja attaches it before interactive state exposure, and an impossible lifecycle violation fails explicitly rather than duplicating or silently losing a delivery.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Task 1's focused test failed before `theme-broadcast.ts` existed, then passed after the implementation commit.
- Task 2's browser test failed before the target fixture exposed automatic theme callback evidence, then passed after the test fixture was extended to observe the protected public binding.

## Known Stubs

None.

## Issues Encountered

None. The Paja build emits an existing `@kehto/nip` side-effect warning, but the build completed successfully and no package metadata changed.

## User Setup Required

None.

## Next Phase Readiness

Paja now depends only on Phase 103's shared eligible-session ShellBridge delivery. The Phase 102 symmetric-channel ambiguity and Phase 105 package-adoption gate remain untouched.

## Self-Check: PASSED

- All five assigned source/test files and this summary exist.
- Task commits `357d599`, `ac0e062`, and `30271ad` exist.
- Focused Vitest, Paja type-check/build, IPv6-isolated Playwright, and `git diff --check` passed.
