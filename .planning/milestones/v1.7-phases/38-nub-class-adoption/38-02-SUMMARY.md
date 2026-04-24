---
phase: 38-nub-class-adoption
plan: 02
subsystem: runtime
tags: [nub-class, enforce, acl, class-posture, allowlist]

# Dependency graph
requires:
  - phase: 38-nub-class-adoption
    plan: 01
    provides: SessionEntry.class NappletClass type; NubEnforceConfig resolver ready for class extension
provides:
  - "CLASS_CAPABILITY_ALLOWLIST in enforce.ts — class-1 (all 15 caps) and class-2 (all minus relay:write)"
  - "EnforceResult.reason required field — 'allowed' | 'capability-missing' | 'class-forbidden'"
  - "AclCheckEvent.reason optional field — backwards-compatible audit reason (D7)"
  - "NubEnforceConfig.resolveIdentityByWindowId return type extended with class: NappletClass"
  - "createNubEnforceGate enforceNub body: class pre-filter BEFORE capability check (D6)"
  - "runtime.ts wires class: entry.class into the NUB gate from session entry"
affects: [38-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Class pre-filter at single chokepoint (enforce.ts) — no per-handler class checks (C-02 prevention)"
    - "EnforceResult.reason propagated on all return paths — required field, no partial returns"
    - "CLASS_CAPABILITY_ALLOWLIST as ReadonlySet<Capability> per class token — hardcoded, extensible"
    - "null class = permissive bypass — no allowlist lookup when class is null (D2)"

key-files:
  created: []
  modified:
    - "packages/runtime/src/enforce.ts"
    - "packages/runtime/src/runtime.ts"
    - "packages/runtime/src/types.ts"
    - ".planning/phases/38-nub-class-adoption/38-ITERATION-LOG.md"

key-decisions:
  - "CLASS_CAPABILITY_ALLOWLIST uses ReadonlySet<Capability> for O(1) has() lookup (not Array.includes)"
  - "class pre-filter short-circuits before any ACL lookup when class denies — capability check never runs (D6)"
  - "AclCheckEvent.reason is optional (backwards compat); EnforceResult.reason is required (always set)"
  - "createEnforceGate (pubkey/legacy AUTH) gets reason field but NO class pre-filter — class is NIP-5D-only"
  - "Unknown class tokens deny-all (defensive failsafe) — no policy, just safety"

patterns-established:
  - "Class enforcement lives ONLY in enforceNub — grep for nappletClass or CLASS_CAPABILITY_ALLOWLIST outside enforce.ts should return empty"
  - "reason field propagated on every EnforceResult return path without exception"

requirements-completed: [CLASS-03]

# Metrics
duration: 15min
completed: 2026-04-24
---

# Phase 38 Plan 02: Centralized Class Pre-Filter Summary

**CLASS_CAPABILITY_ALLOWLIST in enforce.ts with class-1/class-2 entries; EnforceResult.reason required field; class check before capability check (D6); runtime.ts wires SessionEntry.class into the NUB gate**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-24T12:52:12Z
- **Completed:** 2026-04-24T13:07:00Z
- **Tasks:** 2
- **Files modified:** 4 (+ iteration log)

## Accomplishments

- Added `CLASS_CAPABILITY_ALLOWLIST` const in `packages/runtime/src/enforce.ts` — `class-1` maps to all 15 capabilities; `class-2` maps to all 15 except `relay:write`
- Rewrote `enforceNub` body: class check BEFORE capability check (D6). null class bypasses the filter (D2 permissive default). Unknown class tokens deny-all (failsafe)
- Extended `EnforceResult` with required `reason: 'allowed' | 'capability-missing' | 'class-forbidden'` (D7) — propagated on all 3 return paths
- Added optional `AclCheckEvent.reason?` (same type union) — backwards-compatible; pre-v1.7 audit consumers unaffected
- Extended `NubEnforceConfig.resolveIdentityByWindowId` return type to include `class: NappletClass`
- Updated `runtime.ts` enforceNub wiring to return `class: entry.class` from session entry
- Updated `createEnforceGate` (pubkey/legacy AUTH) to carry `reason` on both return paths (no class pre-filter there)
- `pnpm type-check` + `pnpm build` workspace-wide green (24/24)

## Task Commits

Tasks 1 and 2 committed atomically in a single plan commit (per-task commit + metadata):

1. **Tasks 1+2 combined** — `b5acb5e` (feat: CLASS_CAPABILITY_ALLOWLIST, EnforceResult.reason, runtime.ts wiring)

## Files Created/Modified

- `packages/runtime/src/enforce.ts` — Added ALL_CAPABILITIES + NappletClass imports; CLASS_CAPABILITY_ALLOWLIST const; EnforceResult.reason required; NubEnforceConfig.resolveIdentityByWindowId class return; enforceNub class pre-filter body; createEnforceGate reason propagation
- `packages/runtime/src/runtime.ts` — enforceNub wiring extended with `class: entry.class`
- `packages/runtime/src/types.ts` — AclCheckEvent.reason optional field added
- `.planning/phases/38-nub-class-adoption/38-ITERATION-LOG.md` — Plan 38-02 block appended

## Decisions Made

- Used `ReadonlySet<Capability>` for the allowlist values (O(1) `has()` lookup vs O(n) `Array.includes`)
- No class pre-filter in `createEnforceGate` (pubkey/legacy AUTH) — class posture is NIP-5D-only
- AclCheckEvent.reason optional (backwards compat); EnforceResult.reason required (always present on return)
- Unknown class tokens deny-all as a defensive failsafe — not explicit policy, just maximally restrictive

## Deviations from Plan

None — plan executed exactly as written. No test fixture updates were needed because no test files in `packages/runtime/src/*.test.ts` directly construct `EnforceResult` literals. The gate functions transparently return the new `reason` field.

## Verification Grid

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c "CLASS_CAPABILITY_ALLOWLIST" packages/runtime/src/enforce.ts` | >= 2 | 2 | PASS |
| `grep -c "'class-1'" packages/runtime/src/enforce.ts` | >= 1 | 2 (comment + code) | PASS |
| `grep -c "'class-2'" packages/runtime/src/enforce.ts` | >= 1 | 2 (comment + code) | PASS |
| `grep -c "class-forbidden" packages/runtime/src/enforce.ts` | >= 3 | 4 | PASS |
| `grep -rn "class-forbidden" packages/runtime/src/ --include="*.ts"` files | only enforce.ts + types.ts | enforce.ts + types.ts | PASS |
| `grep -c "CLASS_CAPABILITY_ALLOWLIST" packages/runtime/src/state-handler.ts packages/runtime/src/service-dispatch.ts packages/runtime/src/runtime.ts` | 0 (each) | 0 (each) | PASS |
| `grep -c "entry.class" packages/runtime/src/runtime.ts` | 1 | 1 | PASS |
| `grep -c "reason?: 'allowed' | 'capability-missing'" packages/runtime/src/types.ts` | 1 | 1 | PASS |
| `grep -c "nappletClass !== null" packages/runtime/src/enforce.ts` | 1 | 1 | PASS |
| `grep -c "// CLASS-03" packages/runtime/src/enforce.ts` | >= 1 | 1 | PASS |
| `pnpm type-check` | 0 (10/10) | 0 (10/10) | PASS |
| `pnpm build` | 0 (24/24) | 0 (24/24) | PASS |

## Centralization Argument (C-02 Prevention)

`class-forbidden` as a string literal appears in exactly two files:
- `packages/runtime/src/enforce.ts` — where the class pre-filter lives (the sole enforcement site)
- `packages/runtime/src/types.ts` — where AclCheckEvent.reason and the type unions are declared

Neither `state-handler.ts`, `service-dispatch.ts`, `runtime.ts` handler bodies, nor any other file in `packages/runtime/src/` contains class-posture decision logic. The `nappletClass` variable exists only in `enforceNub`. This satisfies C-02 at the structural level; Plan 38-03's E2E spec validates it at the observable level.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 38-03 (`class-invariant.spec.ts`) is unblocked — the observable enforcement gate is in place
- `class: null` for all 10 DEMO_NAPPLETS means the existing 54/0/0 E2E baseline is unaffected by this plan's changes
- The `window.__setNappletClass__(dTag, class)` test hook (Plan 38-03) will mutate session entry class on the fly and observe `class-forbidden` in the audit callback

---
*Phase: 38-nub-class-adoption*
*Completed: 2026-04-24*
