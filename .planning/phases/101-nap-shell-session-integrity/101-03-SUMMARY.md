---
phase: 101-nap-shell-session-integrity
plan: 03
subsystem: shell
tags: [nap-shell, nip-5d, immutable-environment, conformance]
requires:
  - phase: 101-02
    provides: Domain-only ShellCapabilities and host-only environment resolution
provides:
  - Unary exact injected shell support over the trusted first init snapshot
  - Cross-surface type, wire, injected API, static guard, and README conformance proof
affects: [101-04-paja-integration, 101-05-playground-integration]
tech-stack:
  added: []
  patterns: [validate-copy-freeze injected environments, exact local domain membership]
key-files:
  created: []
  modified:
    - packages/shell/src/napplet-namespace.ts
    - packages/shell/src/napplet-namespace.test.ts
    - packages/shell/src/shell-supports-conformance.test.ts
    - tests/unit/nip5d-conformance-guard.test.ts
    - packages/shell/README.md
key-decisions:
  - "Treat only a parent init with an array-valued domains field as cacheable; the first valid snapshot wins."
  - "Keep resolveShellEnvironment as a host-only barrel export and exclude it from the injected napplet API."
patterns-established:
  - "The injected prelude validates, de-duplicates, copies, and freezes domain/service arrays before exposing them."
requirements-completed: [SHELL-01, SHELL-02, SHELL-05]
coverage:
  - id: D1
    description: Unary exact local support over one immutable parent-bound environment.
    requirement: SHELL-02
    verification:
      - kind: unit
        ref: packages/shell/src/napplet-namespace.test.ts#installs the NAP-SHELL receiver before signaling ready and caches one immutable unary environment
        status: pass
    human_judgment: false
  - id: D2
    description: Public type, shell.init payload, injected API, static guard, and package documentation share the domain-only contract.
    requirement: SHELL-01
    verification:
      - kind: unit
        ref: packages/shell/src/shell-supports-conformance.test.ts#keeps the public type, shell.init environment, and injected unary results aligned
        status: pass
      - kind: unit
        ref: tests/unit/nip5d-conformance-guard.test.ts#keeps active NAP-SHELL support domain-only and host resolution out of injected APIs
        status: pass
    human_judgment: false
duration: 7 min
completed: 2026-07-23
status: complete
---

# Phase 101 Plan 03: Unary Injected Shell Support Summary

**Unary `shell.supports(domain)` now performs exact local membership over a frozen, parent-origin, first-init environment with package-level contract evidence.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-23T14:01:08Z
- **Completed:** 2026-07-23T14:08:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Replaced the injected binary support function with a unary exact membership lookup that returns false before init and for invalid runtime values without emitting query traffic.
- Validated, copied, de-duplicated, and froze each cached domain/service snapshot; forged sources, malformed init, later parent init, and sibling windows cannot change it.
- Added public/wire/injected conformance coverage, active-surface negotiation guards, and README guidance for host-only `resolveShellEnvironment(hooks, identity)`.

## Task Commits

1. **Task 1: Make the injected shell cache unary, exact, immutable, and parent-bound**
   - `758004b` — test(101-03): add unary shell namespace coverage (RED)
   - `9f15a34` — feat(101-03): harden injected shell environment (GREEN)
2. **Task 2: Seal public type, wire, injected API, static, and README consistency**
   - `7f617c2` — test(101-03): add shell contract conformance coverage (RED)
   - `5c865de` — feat(101-03): document domain-only shell support (GREEN)

## Files Created/Modified

- `packages/shell/src/napplet-namespace.ts` — unary, exact, immutable injected support snapshot.
- `packages/shell/src/napplet-namespace.test.ts` — source trust, invalid input, ordering, and isolation matrix.
- `packages/shell/src/shell-supports-conformance.test.ts` — public/wire/injected API agreement proof.
- `tests/unit/nip5d-conformance-guard.test.ts` — narrow active-surface contract guard with history exclusions.
- `packages/shell/README.md` — domain-only init/support guidance and host-only resolver documentation.
- `packages/paja/src/parity.test.ts` — domain-only fixture correction required by the Plan 02 type change.
- `.planning/phases/101-nap-shell-session-integrity/deferred-items.md` — unrelated Paja docs-version issue.

## Decisions Made

- Cache only a parent `shell.init` whose capabilities provide a domains array, then keep that first valid snapshot immutable.
- Treat `resolveShellEnvironment` as host-integrator-only; it remains exported from the package barrel but absent from `window.napplet` and shim-facing surfaces.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected stale Paja ShellCapabilities fixture**
- **Found during:** Task 2 verification
- **Issue:** Typedoc failed because `packages/paja/src/parity.test.ts` constructed removed `protocols`, `naps`, and `sandbox` properties after Plan 02 made `ShellCapabilities` domain-only.
- **Fix:** Reduced the fixture to its current `domains` field.
- **Files modified:** `packages/paja/src/parity.test.ts`
- **Verification:** Focused Paja parity test, full unit suite, type-check, and build pass.
- **Committed in:** `5c865de`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The minimal fixture update restores required type-documentation generation without adding later-phase runtime behavior.

## Issues Encountered

- `pnpm docs:check` completed API generation after the fixture correction but its final audit still fails because `docs/packages/paja.md` lacks the required `| Version | \`0.8.1\` |` row. This unrelated documentation mismatch is recorded in `deferred-items.md`; no out-of-scope docs were changed.
- The repository’s configured AI-slop executable is not installed locally, so that gate could not run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04 can consume the final unary injected API and host-only environment resolver for Paja integration.
- Plan 05 can consume the same immutable domain-only contract for playground integration.

## Self-Check

PASSED — all seven listed files exist and all four task commits (`758004b`, `9f15a34`, `7f617c2`, `5c865de`) are present in git history.

---
*Phase: 101-nap-shell-session-integrity*
*Completed: 2026-07-23*
