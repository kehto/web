---
phase: 103-identity-and-theme-wire-parity
plan: 02
subsystem: services
tags: [identity, theme, nap-identity, nap-theme, vitest]
requires:
  - phase: 101-session-authentication-and-protocol-entrypoint-hardening
    provides: source-bound runtime dispatch for service messages
provides:
  - Canonical, exactly-once identity service results with safe primary fields
  - Complete normalized theme state and one post-mutation change callback
affects: [runtime, shell, paja, playground, identity, theme]
tech-stack:
  added: []
  patterns:
    - Typed safe-result fallback for optional host identity providers
    - Complete theme normalization before storing or broadcasting state
key-files:
  created: []
  modified:
    - packages/services/src/identity-service.ts
    - packages/services/src/identity-service.test.ts
    - packages/services/src/theme-service.ts
    - packages/services/src/theme-service.test.ts
key-decisions:
  - "NAP-IDENTITY public-key failures always resolve to one correlated empty-pubkey result without error."
  - "Other identity provider failures retain their required safe field and expose only a stable operation-specific error."
  - "Kehto normalizes incomplete theme input to the fixed complete fallback with no error or mixed theme/error result."
patterns-established:
  - "Reference services silently ignore unknown protocol actions rather than fabricating generic error envelopes."
  - "Theme state is assigned before its sole synchronous changed callback."
requirements-completed: [IDENTITY-01, IDENTITY-02, THEME-01, THEME-02, THEME-03, THEME-05]
coverage:
  - id: D1
    description: Canonical public-key result across signer success, absence, and failures
    requirement: IDENTITY-01
    verification:
      - kind: unit
        ref: packages/services/src/identity-service.test.ts#identity.getPublicKey
        status: pass
    human_judgment: false
  - id: D2
    description: Safe matching results for every non-public-key identity read
    requirement: IDENTITY-02
    verification:
      - kind: unit
        ref: packages/services/src/identity-service.test.ts#canonical safe identity read results
        status: pass
    human_judgment: false
  - id: D3
    description: Complete normalized theme reads and post-mutation changed delivery
    requirement: THEME-01
    verification:
      - kind: unit
        ref: packages/services/src/theme-service.test.ts#createThemeService
        status: pass
    human_judgment: false
  - id: D4
    description: Theme service has no error, subscribe, or unsubscribe protocol output
    requirement: THEME-05
    verification:
      - kind: unit
        ref: packages/services/src/theme-service.test.ts#unknown theme action
        status: pass
    human_judgment: false
metrics:
  duration: 6m
  completed: 2026-07-23
status: complete
---

# Phase 103 Plan 02: Identity and Theme Reference Service Summary

**Reference services now send only correlated safe identity results and complete normalized theme state/change envelopes.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-23T21:17:18Z
- **Completed:** 2026-07-23T21:22:53Z
- **Tasks:** 3/3
- **Files modified:** 4

## Accomplishments

- Public-key signer failures, including synchronous lookup/method failures and rejected promises, produce exactly one `identity.getPublicKey.result` with `pubkey: ""` and no error field.
- All other supported identity reads retain their required safe primary fields on missing or failed providers; raw provider errors never reach the wire and unknown identity actions are silent.
- Theme ingress accepts only complete color triples, substitutes Kehto's fixed non-sensitive fallback otherwise, stores state before one synchronous callback, and exposes no subscription-shaped protocol.

## Task Commits

1. **Task 1: Carry public-key failure through the service as one canonical result** — `26f4127` (test), `f2ef3dd` (fix)
2. **Task 2: Complete the safe matching-result matrix for all other identity reads** — `f60c4c8` (test), `fe4f469` (fix)
3. **Task 3: Enforce complete theme state before one change callback** — `f512389` (test), `7736e34` (fix)

## Files Created/Modified

- `packages/services/src/identity-service.ts` — canonical safe result construction and provider-failure handling.
- `packages/services/src/identity-service.test.ts` — identity cardinality, correlation, safe-field, and silent-unknown regressions.
- `packages/services/src/theme-service.ts` — complete theme normalization and narrow theme dispatch.
- `packages/services/src/theme-service.test.ts` — fallback, callback-ordering, and no-subscription regressions.

## Decisions Made

- Checked NAP-IDENTITY, NAP-THEME, and the web projection at `napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f` before implementation. The service behavior is conformant; the complete no-error theme fallback follows the explicit Phase 103 upstream-spec-gap reconciliation.
- Identity provider errors are stable operation names (for example, `identity.getFollows failed`) instead of host exception text.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Runtime and host bridge work can consume canonical reference-service payloads without depending on generic error envelopes or incomplete theme state.

## Self-Check: PASSED

- All four assigned source and test files exist.
- All six task commits are present in git history.
- `pnpm exec vitest run packages/services/src/identity-service.test.ts packages/services/src/theme-service.test.ts` passed (55 tests).
- `pnpm exec tsc --noEmit -p packages/services/tsconfig.json` passed.
