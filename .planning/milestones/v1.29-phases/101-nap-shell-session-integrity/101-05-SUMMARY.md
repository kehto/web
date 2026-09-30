---
phase: 101-nap-shell-session-integrity
plan: 05
subsystem: playground-shell-session-integrity
tags: [playground, nap-shell, origin-identity, srcdoc, immutable-environment, playwright]
requires:
  - phase: 101-03
    provides: "Unary injected shell support and the host-only resolveShellEnvironment API"
provides:
  - "Trusted-identity environment resolution for every playground iframe before verified srcdoc execution"
  - "Disabled-aware live domain and service snapshots shared by the playground prelude and shell.init lifecycle"
  - "Browser proof for frozen concurrent snapshots, unary support, duplicate-ready idempotency, reload, and NIP-5D provenance"
affects: [playground-host, shell-bridge, nip5d-conformance, phase-106-closeout]
tech-stack:
  added: []
  patterns: ["Resolve each frame environment from its registered OriginIdentity", "Apply live disabled controls before manifest requirement intersection", "Verify reload snapshots through the actual srcdoc and bridge lifecycle"]
key-files:
  created: []
  modified:
    - apps/playground/src/demo-hooks.ts
    - apps/playground/src/shell-host.ts
    - tests/unit/playground-gateway-guard.test.ts
    - tests/e2e/gateway-artifact-parity.spec.ts
    - tests/e2e/naps-path-conformance.spec.ts
    - tests/e2e/demo-service-toggle.spec.ts
key-decisions:
  - "The playground resolves its prelude from resolveShellEnvironment using the frozen creation identity, never manifest requirements or gateway material."
  - "A disabled service narrows only environments created after the toggle; existing first-init snapshots remain immutable."
patterns-established:
  - "Host-side disabled controls are supplied to CapabilityHooks at resolution time and cannot mutate a delivered frame environment."
requirements-completed: [SHELL-02, SHELL-05, SHELL-06]
coverage:
  - id: D1
    description: "Each playground iframe receives a fresh identity-bound, disabled-aware environment before executable srcdoc assignment."
    requirement: SHELL-05
    verification:
      - kind: unit
        ref: "tests/unit/playground-gateway-guard.test.ts#derives each frame environment from its trusted creation identity and live host wiring"
        status: pass
      - kind: e2e
        ref: "tests/e2e/gateway-artifact-parity.spec.ts#resolved manifests and hosted supports match napplet contracts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Receiver membership, unary support, and shell.init capability and service snapshots agree for live and disabled services."
    requirement: SHELL-02
    verification:
      - kind: e2e
        ref: "tests/e2e/demo-service-toggle.spec.ts#new registrations reflect disabled live services without mutating concurrent frame snapshots"
        status: pass
      - kind: e2e
        ref: "tests/e2e/naps-path-conformance.spec.ts#profile-viewer receives current injected window.napplet domain objects"
        status: pass
    human_judgment: false
  - id: D3
    description: "Concurrent frame snapshots, duplicate ready, reload registration, and verified-byte srcdoc provenance remain intact."
    requirement: SHELL-06
    verification:
      - kind: e2e
        ref: "tests/e2e/gateway-artifact-parity.spec.ts#playground loads all napplets via verified srcdoc with opaque origins"
        status: pass
      - kind: e2e
        ref: "tests/e2e/demo-service-toggle.spec.ts#new registrations reflect disabled live services without mutating concurrent frame snapshots"
        status: pass
    human_judgment: false
duration: 7min
completed: 2026-07-23
status: complete
---

# Phase 101 Plan 05: Playground Shell Session Integrity Summary

**The playground now resolves immutable NAP-SHELL environments from each frame’s trusted identity and live disabled-aware wiring while preserving verified-byte srcdoc provenance.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-23T14:26:34Z
- **Completed:** 2026-07-23T14:33:34Z
- **Tasks:** 2/2
- **Files modified:** 6

## Accomplishments

- Bound each playground prelude to a frozen creation-time `OriginIdentity` and a fresh host-resolved live environment before `srcdoc` executes.
- Removed the stale `naps`, `protocols`, and manifest-derived receiver construction path; disabled controls now narrow live capabilities before requirement checks.
- Added focused browser proof for unary support, immutable init contents, disabled-service reloads, concurrent snapshot isolation, duplicate ready, and verified `srcdoc` provenance.

## Task Commits

1. **Task 1: Resolve one isolated playground environment per creation identity**
   - `c220596` — test(101-05): add playground environment conformance coverage (RED)
   - `26ea084` — feat(101-05): resolve playground frame environments (GREEN)
2. **Task 2: Prove playground capability truthfulness across concurrent frames**
   - `20ef63c` — test(101-05): prove playground frame integrity

## Files Created/Modified

- `apps/playground/src/demo-hooks.ts` — exposes a host-only, identity-bound resolver wrapper and supplies current disabled domains to shell capabilities.
- `apps/playground/src/shell-host.ts` — resolves the verified frame identity before requirement checks, source registration, and prelude injection.
- `tests/unit/playground-gateway-guard.test.ts` — statically guards the trusted resolver path and removal of legacy capability members.
- `tests/e2e/gateway-artifact-parity.spec.ts` — verifies frozen, domain-only init snapshots alongside verified-byte srcdoc provenance.
- `tests/e2e/naps-path-conformance.spec.ts` — asserts the injected unary `supports(domain)` function shape.
- `tests/e2e/demo-service-toggle.spec.ts` — proves live disabled-service reload behavior, concurrent snapshot isolation, and duplicate-ready idempotency.

## Decisions Made

- The manifest remains an eligibility check only: `resolveShellEnvironment` computes availability from concrete host wiring and disabled controls before the manifest requirements are intersected.
- Existing frames retain their delivered immutable environment after a control change; a newly registered frame receives a new snapshot derived from current live wiring.

## Verification

- PASS `pnpm exec vitest run tests/unit/playground-gateway-guard.test.ts` — 11 tests.
- PASS `pnpm exec playwright test tests/e2e/gateway-artifact-parity.spec.ts tests/e2e/naps-path-conformance.spec.ts tests/e2e/demo-service-toggle.spec.ts --workers=1` — 7 tests, run with the locally installed Google Chrome because the committed `/usr/bin/chromium` path is unavailable on this macOS host; the configuration was restored unchanged.
- PASS `pnpm test:unit` — 104 files / 1,317 tests.
- PASS `pnpm type-check`.
- PASS `pnpm build`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The committed Playwright configuration points to `/usr/bin/chromium`, which is absent on this host. The focused suite was run against the locally installed Google Chrome without committing any configuration change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 101 is complete: the shell package, Paja, and playground all consume the same trusted-identity, domain-only environment contract.
- The known Paja package-version-row mismatch remains deferred to Phase 106 as directed.

## Self-Check: PASSED

- Confirmed all six planned source and test artifacts plus this summary exist.
- Confirmed task commits `c220596`, `26ea084`, and `20ef63c` are present in git history.
