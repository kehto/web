---
phase: 12-shell-conformance-seven-nub-coverage
plan: 01
subsystem: shell
tags: [nip-5d, shell, capabilities, window-nostr-removal, conformance, tdd]

# Dependency graph
requires:
  - phase: 11-nub-peer-deps-type-imports
    provides: "@napplet/nub-* peer-deps declared and types resolvable on @kehto/shell"
provides:
  - "generateNostrBootstrap() deleted from @kehto/shell — no NIP-07 proxy injection into napplet iframes"
  - "buildShellCapabilities() emits canonical 8-domain nub list (relay gated on relayPool hook)"
  - "'signer' NUB removed from shell capability advertisement"
  - "Regression test (packages/shell/tests/no-window-nostr.test.ts) locks in the canonical-spec posture"
  - "vitest include pattern widened to packages/*/tests/** (enables per-package tests/ directories)"
affects:
  - 12-02-PLAN (runtime signer domain removal — no longer has a shell counterpart)
  - 12-03-PLAN (services signer-service deletion — no longer has a shell counterpart)
  - 12-08-PLAN (relay.publishEncrypted — completes DRIFT-SHELL-03 alongside this plan)
  - 12-11-PLAN (shell barrel cleanup — signer exports already removed here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canonical-spec regression tests: assert source-text absence via readFileSync + regex, not just behavior"
    - "Per-package tests/ directory pattern: packages/<name>/tests/*.test.ts discovered by shared vitest.config.ts"
    - "DRIFT marker discipline: every Phase 12 closure deletes its marker comment as part of the change that resolves it"

key-files:
  created:
    - packages/shell/tests/no-window-nostr.test.ts
  modified:
    - packages/shell/src/shell-init.ts
    - packages/shell/src/index.ts
    - packages/shell/src/types.ts
    - vitest.config.ts

key-decisions:
  - "Hard delete, zero back-compat: generateNostrBootstrap removed without alias — reverses the v1.1 SH-I02 decision per canonical NIP-5D Security §6"
  - "CANONICAL_NUB_DOMAINS constant holds the 7 non-relay domains; relay is prepended conditionally on hooks.relayPool presence"
  - "Regression test asserts via source-text read, not runtime introspection — guards against dead-code resurrection even if an export signature happens to still compile"
  - "vitest include pattern widened to packages/*/tests/** rather than moving the test into packages/shell/src/ — plan explicitly specified the packages/shell/tests/ path"

patterns-established:
  - "Source-text regression pattern: readFileSync(new URL('../src/<file>.ts', import.meta.url)) + regex assertions for forbidden substrings"
  - "Canonical-domain list exported as `as const` readonly tuple, spread into conditional prefix-gated array"

requirements-completed: [SH-C01, SH-C03]

# Metrics
duration: 3 min
completed: 2026-04-17
---

# Phase 12 Plan 01: Shell window.nostr Removal + Canonical 8-Domain Nubs Summary

**Deleted 79-line generateNostrBootstrap function, removed 'signer' from shell capability advertisement, and established regression test asserting napplet iframes never see a shell-provided NIP-07 proxy — closes DRIFT-SHELL-01/-04 and partially closes DRIFT-SHELL-03.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-17T18:45:38Z
- **Completed:** 2026-04-17T18:48:31Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified) + 1 config (vitest.config.ts)

## Accomplishments

- Hard-deleted `generateNostrBootstrap()` and its 79 lines of window.nostr / `_shellRequest('signer.*')` proxy bootstrap
- Rewrote `buildShellCapabilities()` to emit the canonical 8-domain list: `relay` (gated on `hooks.relayPool`), `identity`, `storage`, `ifc`, `theme`, `keys`, `media`, `notify`
- Pruned `@kehto/shell` barrel — `generateNostrBootstrap` no longer re-exported from `packages/shell/src/index.ts`
- Updated `ShellCapabilities.nubs` JSDoc to cite the canonical 8 domains instead of the stale `['relay','signer','storage','ifc']` list
- Deleted all three DRIFT-SHELL-01 / -03 / -04 marker comments (the remediation they annotated is now in place)
- Added `packages/shell/tests/no-window-nostr.test.ts` with 5 assertions covering source-text absence, barrel non-export, signer-domain omission, and canonical 8-domain emission
- Widened root `vitest.config.ts` include pattern to pick up `packages/*/tests/**/*.test.ts`

## Task Commits

1. **Task 1: Write regression test for window.nostr absence (RED)** — `d547d0e` (test)
2. **Task 2: Delete generateNostrBootstrap + rewrite buildShellCapabilities (GREEN)** — `a37cdaa` (feat)

## Files Created/Modified

- `packages/shell/tests/no-window-nostr.test.ts` — **CREATED** — 5-assertion regression test for SH-C01 / SH-C03 enforcement
- `packages/shell/src/shell-init.ts` — **REWRITTEN** — 136 lines → 47 lines. Only exports `buildShellCapabilities`. Header JSDoc now states that canonical NIP-5D forbids shell-provided NIP-07 proxies. `CANONICAL_NUB_DOMAINS` constant holds the 7 non-relay domains. `generateNostrBootstrap` and its entire body deleted.
- `packages/shell/src/index.ts` — **MODIFIED** — Barrel line 55 changed from `export { generateNostrBootstrap, buildShellCapabilities } from './shell-init.js';` to `export { buildShellCapabilities } from './shell-init.js';`
- `packages/shell/src/types.ts` — **MODIFIED** — `ShellCapabilities.nubs` JSDoc rewritten to cite canonical 8-domain set; DRIFT-SHELL-04 marker removed
- `vitest.config.ts` — **MODIFIED** — include array extended with `'packages/*/tests/**/*.test.ts'` so per-package `tests/` directories are discovered

## Decisions Made

- **Hard delete, zero back-compat:** `generateNostrBootstrap` was not aliased, soft-deprecated, or wrapped — it was removed outright. The v1.1 `SH-I02` decision that added it is reversed; canonical NIP-5D spec Security §6 forbids any shell-provided NIP-07 proxy on napplet iframes.
- **Conditional relay prefix, unconditional seven non-relay domains:** `buildShellCapabilities()` prepends `'relay'` only when `hooks.relayPool` is truthy; the other 7 domains (identity/storage/ifc/theme/keys/media/notify) are always advertised. Runtime dispatch for each lands in Wave 2 plans (Plans 12-02..12-09).
- **Source-text regression test, not runtime introspection:** `readFileSync` + regex assertions against the on-disk source catch dead code even if an export signature happens to still compile. Complements the barrel-export assertion.
- **Kept plan-specified test path:** Plan frontmatter locked the test at `packages/shell/tests/no-window-nostr.test.ts`. Rather than co-locating it in `packages/shell/src/` (current convention), the plan path was honored and the shared `vitest.config.ts` was widened to discover it. This establishes `packages/*/tests/` as a valid pattern for later plans that need the src/tests separation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extend vitest include pattern to cover packages/*/tests/**
- **Found during:** Task 1 (RED phase — running the newly created test)
- **Issue:** Root `vitest.config.ts` `test.include` was limited to `packages/*/src/**/*.test.ts` and `tests/unit/**/*.test.ts`. The plan locked the new test at `packages/shell/tests/no-window-nostr.test.ts`, which neither pattern matches. Without the fix, `pnpm exec vitest run packages/shell/tests/no-window-nostr.test.ts` would silently skip the file.
- **Fix:** Added `'packages/*/tests/**/*.test.ts'` to the include array.
- **Files modified:** `vitest.config.ts`
- **Verification:** Vitest now picks up the file (5 tests discovered, 5 FAIL in RED, 5 PASS in GREEN).
- **Committed in:** `d547d0e` (Task 1 RED commit — shipped alongside the test file so the test and the discovery mechanism land atomically)

**2. [Rule 3 - Blocking] Reword shell-init.ts header to avoid literal `window.nostr` substring**
- **Found during:** Task 2 (GREEN phase — checking acceptance criterion `grep -n "generateNostrBootstrap\|window\.nostr\|_shellRequest" packages/shell/src/shell-init.ts returns zero matches`)
- **Issue:** First pass of the new header JSDoc contained the phrase "Canonical NIP-5D forbids shell-provided window.nostr (specs/NIP-5D.md line 44 + Security §6)" — a prose reference, not code, but the literal substring tripped the acceptance grep.
- **Fix:** Reworded to "Canonical NIP-5D forbids the shell from injecting a NIP-07 proxy object on the napplet iframe's global scope" — same information, no forbidden substring.
- **Files modified:** `packages/shell/src/shell-init.ts`
- **Verification:** `grep -n "generateNostrBootstrap\|window\.nostr\|_shellRequest" packages/shell/src/shell-init.ts` now returns zero; all 5 tests still pass.
- **Committed in:** `a37cdaa` (Task 2 GREEN commit — the reword was folded into the same task before the commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 - Blocking)
**Impact on plan:** Neither deviation changed scope. Both were mechanical unblockers to let the plan's explicit acceptance criteria pass as written. No architectural change.

## Authentication Gates

None — plan was fully autonomous with no external service interactions.

## Issues Encountered

None — plan executed as written once the two blocking deviations were resolved inline.

## User Setup Required

None - no external service configuration required.

## Signer-facade Exports in Barrel

Plan output spec asked whether any signer-facade exports remain in `packages/shell/src/index.ts` after this plan. **Zero remain** — the barrel no longer references `generateNostrBootstrap` or any signer-related symbol. (Plan 12-03 handles the deletion of the `signer-service.ts` module itself and its barrel export from `@kehto/services`.)

## Lines Deleted

- `packages/shell/src/shell-init.ts`: ~89 lines net removed (136 → 47) — the entire `generateNostrBootstrap` body (79 lines), plus 3 DRIFT-SHELL-01/-02/-03/-04 marker comments (Note: DRIFT-SHELL-02 was NOT a target of this plan and remains, tied to SH-C02 / `perm:` namespace work which Plan 12-02 or later handles), plus the stale file header referencing "two mechanisms".
  - *Correction:* DRIFT-SHELL-02 never lived in shell-init.ts per the original file — only -01, -03, -04 did. All three were deleted. DRIFT-SHELL-02 lives conceptually in `shell.supports()` call sites (not this plan's scope).
- `packages/shell/src/index.ts`: 1 line modified (dropped `generateNostrBootstrap` from the re-export list).
- `packages/shell/src/types.ts`: 3 lines (DRIFT-SHELL-04 marker comment + stale single-line JSDoc) replaced with a 4-line multi-line JSDoc block.

## DRIFT Markers Removed

- ✅ `DRIFT-SHELL-01` — Phase 12: delete generateNostrBootstrap() and all window.nostr injection → **DELETED (this plan)**
- ✅ `DRIFT-SHELL-03` — Phase 12: signing moves into shell-owned relay-publish paths → **Marker deleted here**, with full closure landing alongside Plan 12-08 `relay.publishEncrypted` wiring. This plan handled the marker-comment removal and the signer-surface removal from the capability advertisement; Plan 12-08 closes the runtime-side half.
- ✅ `DRIFT-SHELL-04` — Phase 12: replace nub list with canonical 8-domain list → **DELETED (this plan)**

DRIFT-SHELL-02 (perm: namespace in shell.supports()) is NOT this plan's scope — it remains for whichever Phase 12 plan owns SH-C02 work.

## Test File Added and Pass/Fail Count

- **File:** `packages/shell/tests/no-window-nostr.test.ts`
- **Tests:** 5 / 5 passing (GREEN)
- **Coverage:** source-text absence of `window.nostr =` and `_shellRequest`, barrel non-export of `generateNostrBootstrap`, nubs-list omission of `'signer'`, nubs-list equality with canonical 8-domain set

## Next Plan Readiness

- SH-C01 fully satisfied. Regression test committed.
- SH-C03 partially satisfied (`signer` capability removed). Full satisfaction requires Plan 12-08 (`relay.publishEncrypted` wiring) and Plan 12-03 (signer-service deletion).
- Plans 12-02 through 12-09 can now proceed — shell-side of every canonical domain now advertises correctly, so runtime dispatch wiring (Wave 2) can match without conflicts.

## Self-Check: PASSED

- `packages/shell/tests/no-window-nostr.test.ts` — exists on disk
- `packages/shell/src/shell-init.ts` — exists on disk (rewritten to 47 lines)
- `packages/shell/src/index.ts` — exists on disk (barrel pruned)
- `packages/shell/src/types.ts` — exists on disk (JSDoc updated)
- `vitest.config.ts` — exists on disk (include pattern widened)
- Task 1 commit `d547d0e` — present in git log
- Task 2 commit `a37cdaa` — present in git log

---
*Phase: 12-shell-conformance-seven-nub-coverage*
*Completed: 2026-04-17*
