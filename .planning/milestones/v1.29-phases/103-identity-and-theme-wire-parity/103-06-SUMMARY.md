---
phase: 103-identity-and-theme-wire-parity
plan: 06
subsystem: playground-host
tags: [nap-identity, nap-theme, shell-bridge, playwright]
requires:
  - phase: 103-02
    provides: canonical identity/theme services
  - phase: 103-03
    provides: eligible ShellBridge push primitives
  - phase: 103-04
    provides: protected injected identity/theme APIs
provides:
  - One state-first ThemeService-to-ShellBridge delivery path in the playground
  - Exact signer connection, repeat, and sign-out identity change cardinality
  - IPv6 browser proofs against real protected injected APIs
affects: [103-07, phase-verification]
tech-stack:
  added: []
  patterns: [service-state-before-eligible-push, signer-transition-deduplication, injected-api-e2e]
key-files:
  created: []
  modified:
    - apps/playground/src/demo-hooks.ts
    - apps/playground/src/main-preferences.ts
    - apps/playground/src/shell-host.ts
    - apps/playground/src/main-signer.ts
    - tests/unit/playground-gateway-guard.test.ts
    - tests/e2e/nap-identity.spec.ts
    - tests/e2e/nap-theme.spec.ts
    - tests/e2e/theme-broadcast.spec.ts
key-decisions:
  - "ThemeService.publishTheme is the playground's sole state mutation and push entry point."
  - "A disconnected or connecting signer snapshot is not an identity transition; only a real connected value or later sign-out is published."
  - "Browser assertions run against the real injected API on an isolated IPv6 host, never a fabricated parent protocol message."
patterns-established:
  - "Host updates use the service callback to reach ShellBridge, never direct iframe postMessage loops."
  - "Identity tests exercise the real signer controller and observe frame-local protected APIs."
requirements-completed: [IDENTITY-03, IDENTITY-04, THEME-03, THEME-05]
coverage:
  - id: D1
    description: Playground theme updates store state before one eligible ShellBridge delivery.
    requirement: THEME-03
    verification:
      - kind: unit
        ref: tests/unit/playground-gateway-guard.test.ts#keeps playground identity and theme delivery on one service-to-bridge path
        status: pass
      - kind: e2e
        ref: tests/e2e/theme-broadcast.spec.ts#clicking host dark button stores then pushes one complete theme through the injected API
        status: pass
    human_judgment: false
  - id: D2
    description: Playground identity changes use the signer transition path exactly once for connect and sign-out.
    requirement: IDENTITY-03
    verification:
      - kind: e2e
        ref: tests/e2e/nap-identity.spec.ts#nap-identity: only real signer transitions publish one normal and one sign-out change
        status: pass
    human_judgment: false
  - id: D3
    description: Protected theme and identity APIs have only sanctioned get/onChanged surfaces and route through the real browser binding.
    requirement: THEME-05
    verification:
      - kind: e2e
        ref: tests/e2e/nap-theme.spec.ts#nap-theme: the injected API exposes one complete get result and automatic changes only
        status: pass
      - kind: e2e
        ref: tests/e2e/nap-identity.spec.ts#nap-identity: only real signer transitions publish one normal and one sign-out change
        status: pass
    human_judgment: false
status: complete
---

# Phase 103 Plan 06: Playground Identity and Theme Delivery Summary

**The playground now mutates theme state once before a single eligible ShellBridge push, and emits identity changes only for real signer connect and sign-out transitions.**

## Performance

- **Duration:** ~13 minutes
- **Started:** 2026-07-23T21:38:53Z
- **Completed:** 2026-07-23T21:52:00Z
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- Routed the retained ThemeService callback through `ShellBridge.publishTheme`, with preferences using `publishTheme` as its only delivery path.
- Removed raw iframe theme posts and shell-host timeout/request-tap identity publishers.
- Added real IPv6 browser coverage for exact identity connect/repeat/sign-out delivery and theme API/state parity.

## Task Commits

1. **Task 1: Trace one playground preference change through ThemeService state to one eligible push** - `3b28928` (test), `cad1016` (feat)
2. **Task 2: Remove duplicate identity retries and prove normal/sign-out plus exact injected theme parity** - `0a7ba04` (fix)

## Files Created/Modified

- `apps/playground/src/demo-hooks.ts` - wires ThemeService broadcasts to the host callback.
- `apps/playground/src/main-preferences.ts` - uses the retained ThemeService as the only theme publish route.
- `apps/playground/src/shell-host.ts` - removes duplicate identity synchronization and forwards the service callback to ShellBridge.
- `apps/playground/src/main-signer.ts` - ignores connecting/initial disconnected snapshots for identity change delivery.
- `tests/unit/playground-gateway-guard.test.ts` - guards the sole service-to-bridge route and absence of raw identity/theme fan-out.
- `tests/e2e/nap-identity.spec.ts` - proves normal, repeated-equivalent, and sign-out transitions from the real signer controller.
- `tests/e2e/nap-theme.spec.ts` - proves the protected theme API shape and complete read result.
- `tests/e2e/theme-broadcast.spec.ts` - proves one complete changed event equals the later injected get result.

## Decisions Made

- Checked `napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f`: NAP-IDENTITY requires `pubkey: ""` for sign-out and NAP-THEME requires automatic change notification without subscribe/unsubscribe. This implementation is conformant.
- The repeat-equivalent signer assertion reinvokes the same host `connectNip07` controller after the initial UI-driven connect; it does not manufacture a parent/iframe protocol message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented a transient connecting snapshot from publishing `identity.changed("")`**
- **Found during:** Task 2
- **Issue:** `connectNip07()` emits an intermediate connecting state, which the existing callback treated as a sign-out before publishing the real pubkey.
- **Fix:** Ignore connecting snapshots and record an initial disconnected value without pushing it.
- **Files modified:** `apps/playground/src/main-signer.ts`, `tests/e2e/nap-identity.spec.ts`
- **Verification:** Focused IPv6 identity browser test proves exactly `[pubkey]` after connect/repeat and `[pubkey, ""]` after disconnect.
- **Committed in:** `0a7ba04`

**2. [Rule 1 - Bug] Restored the topology's signer-state import after removing duplicate identity helpers**
- **Found during:** Task 1 IPv6 tracer
- **Issue:** `getDemoTopologyInputs()` still needs `getSignerConnectionState`; removing its import caused playground boot to fail before topology render.
- **Fix:** Retained the import while deleting only the obsolete raw identity publisher helpers.
- **Files modified:** `apps/playground/src/shell-host.ts`
- **Verification:** Isolated IPv6 theme tracer and all three focused browser specs pass.
- **Committed in:** `cad1016`

**Total deviations:** 2 auto-fixed Rule 1 bugs.

## Verification

- `pnpm type-check` — passed.
- `pnpm exec vitest run tests/unit/playground-gateway-guard.test.ts` — 13 passed.
- `KEHTO_PLAYGROUND_BASE_URL=http://[::1]:4174 pnpm exec playwright test tests/e2e/nap-identity.spec.ts tests/e2e/nap-theme.spec.ts tests/e2e/theme-broadcast.spec.ts --workers=1` — 3 passed.
- `git diff --check` — passed.

## Next Phase Readiness

Plan 103-07 can perform the final documentation and release-boundary sweep. Phase 102's channel-overflow ambiguity and Phase 105's unpublished package adoption remain untouched.

## Self-Check: PASSED

- Required source and browser test files exist.
- Task commits `3b28928`, `cad1016`, and `0a7ba04` are present.
