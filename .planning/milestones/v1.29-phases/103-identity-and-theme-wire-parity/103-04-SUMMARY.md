---
phase: 103-identity-and-theme-wire-parity
plan: 04
subsystem: shell
tags: [identity, theme, nip-5d, nap-identity, nap-theme, vitest]
requires:
  - phase: 103-01
    provides: canonical runtime identity/theme result handling
  - phase: 103-02
    provides: safe identity and complete theme reference-service payloads
provides:
  - Replacement-resistant readonly identity and theme injected bindings
  - Trusted-parent-only identity/theme request and change delivery
  - Regression coverage for protected namespace reassignment and INC isolation
affects: [shell, paja, playground, identity, theme, inc]
tech-stack:
  added: []
  patterns:
    - Stable frozen canonical domain objects behind guarded namespace assignment
    - Parent-source-gated local push listeners
key-files:
  created:
    - .planning/phases/103-identity-and-theme-wire-parity/103-04-SUMMARY.md
  modified:
    - packages/shell/src/napplet-namespace.ts
    - packages/shell/src/napplet-namespace.test.ts
key-decisions:
  - "The injected identity surface is intentionally limited to four readonly queries plus onChanged, per the Phase 103 contract."
  - "Identity and theme canonical operations are stable frozen objects preserved by both direct-domain and whole-namespace assignment guards."
  - "Only MessageEvents from window.parent can settle requests or reach automatic changed callbacks."
patterns-established:
  - "Protect sensitive injected domains by returning a single frozen canonical object from the existing namespace merge path."
requirements-completed: [IDENTITY-03, IDENTITY-04, THEME-02, THEME-05]
coverage:
  - id: D1
    description: Readonly identity operation shape and trusted-parent-only request/change delivery
    requirement: IDENTITY-03
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#keeps identity read-only, canonical, and parent-authenticated after direct reassignment
        status: pass
    human_judgment: false
  - id: D2
    description: Identity remains isolated from shell, intent, and INC-shaped message content
    requirement: IDENTITY-04
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#keeps theme and identity canonical across whole-namespace replacement without subscriptions
        status: pass
    human_judgment: false
  - id: D3
    description: Theme exposes only get/onChanged and accepts only trusted-parent results and pushes
    requirement: THEME-02
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#keeps theme and identity canonical across whole-namespace replacement without subscriptions
        status: pass
    human_judgment: false
  - id: D4
    description: Theme has automatic local onChanged delivery without subscribe or unsubscribe wire messages
    requirement: THEME-05
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#keeps theme and identity canonical across whole-namespace replacement without subscriptions
        status: pass
    human_judgment: false
metrics:
  duration: 3m
  completed: 2026-07-23
status: complete
---

# Phase 103 Plan 04: Protected Identity and Theme Prelude Summary

**The injected NIP-5D identity and theme bindings now retain a frozen readonly shape across namespace tampering and accept results or changes only from the trusted parent.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-23T21:26:14Z
- **Completed:** 2026-07-23T21:28:26Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Constrained identity to `getPublicKey`, `getRelays`, `getProfile`, `getFollows`, and `onChanged`, each retained on a single frozen canonical object.
- Protected identity and theme against assignment, deletion, redefinition, and whole `window.napplet` replacement while retaining the established shell and INC guards.
- Proved foreign-window, shell, intent, and INC-shaped messages cannot settle identity state; theme produces only `theme.get` requests and local automatic change callbacks.

## Task Commits

1. **Task 1: Protect one identity request and change listener across direct domain reassignment** — `797d657` (fix)
2. **Task 2: Extend protected replacement semantics to theme and whole-namespace assignment without changing INC** — `e1c9083` (test)

## Files Created/Modified

- `packages/shell/src/napplet-namespace.ts` — caches frozen canonical identity/theme domains and preserves them through protected namespace operations.
- `packages/shell/src/napplet-namespace.test.ts` — verifies exact public surfaces, descriptors, reassignment resistance, source provenance, callback cardinality, absence of theme subscriptions, and cross-domain isolation.

## Decisions Made

- Checked NAP-IDENTITY, NAP-THEME, and the web projection at `napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f`. The binding's readonly and trusted-parent behavior conforms to the proposed projection contract; the intentionally narrow identity surface follows Phase 103's stated contract.
- Kept the Phase 102 INC code path intact; protected-domain routing only reuses its existing replacement behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Reused the protected-domain mechanism for theme while hardening identity.**
- **Found during:** Task 1
- **Issue:** Reassignment protection must be consistent for both sensitive injected domains; leaving theme on the generic replacement path would retain a spoofing route.
- **Fix:** Cached and froze the theme domain in the same guarded path, then added the full theme and cross-domain proof in Task 2.
- **Files modified:** `packages/shell/src/napplet-namespace.ts`, `packages/shell/src/napplet-namespace.test.ts`
- **Verification:** `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` and `pnpm --filter @kehto/shell type-check`
- **Committed in:** `797d657`, `e1c9083`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** The required theme protection was installed alongside the shared identity mechanism; no out-of-scope domain behavior changed.

## TDD Gate Compliance

- The identity tracer was observed failing before the production change. Its test and fix were committed together in `797d657`, so the history does not contain a separate RED test commit.
- The Task 2 theme proof passed when introduced because the shared Rule 2 protection was already installed by Task 1.

## Known Stubs

None.

## Issues Encountered

`pnpm exec aislop` could not run because the workspace has no `aislop` executable. The shared Phase 103 ledger records this as an open unrun-verification entry; it does not affect the focused shell test or type-check results.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Paja and playground can rely on a stable parent-authenticated identity/theme prelude. Phase 102's channel-overflow contract blocker and Phase 105 package-adoption gate remain out of scope.

## Self-Check: PASSED

- Both assigned source/test files exist and task commits `797d657` and `e1c9083` are present.
- `pnpm exec vitest run packages/shell/src/napplet-namespace.test.ts` passed (22 tests).
- `pnpm --filter @kehto/shell type-check` passed.
- `git diff --check` passed for this plan's source/test diff.
- `pnpm exec aislop` was attempted and could not run because the executable is unavailable.
