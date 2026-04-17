---
phase: 12-shell-conformance-seven-nub-coverage
plan: 02
subsystem: shell
tags: [nip-5d, shell, capabilities, perm-namespace, supports, conformance, tdd]

# Dependency graph
requires:
  - phase: 12-shell-conformance-seven-nub-coverage
    plan: 01
    provides: "buildShellCapabilities() emits canonical 8-domain nub list; DRIFT-SHELL-01/-03/-04 markers deleted"
provides:
  - "ShellCapabilities.sandbox documents the canonical perm:<permission> namespace (JSDoc contract)"
  - "ShellCapabilities.nubs documents the bare-name convention (no perm: prefix)"
  - "buildShellCapabilities() JSDoc spells out host-app extension rule: sandbox entries MUST be perm:-prefixed"
  - "Regression test (packages/shell/tests/perm-namespace.test.ts) locks in both namespaces + non-crossing contract"
affects:
  - 12-10-PLAN (drift-audit closure — DRIFT-SHELL-02 now marked resolved)
  - future napplet shim work (shim's supports() impl must follow this contract)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-field JSDoc namespace contract: each array field documents its prefix convention separately, so violations are visible at the type-declaration site"
    - "Capability-lookup contract test: inline lookup() helper mirrors the shim's expected behaviour; tests assert non-crossing namespaces without shipping a supports() helper from @kehto/shell"

key-files:
  created:
    - packages/shell/tests/perm-namespace.test.ts
  modified:
    - packages/shell/src/types.ts
    - packages/shell/src/shell-init.ts

key-decisions:
  - "No supports() helper added to @kehto/shell. The napplet-side shim (@napplet/sdk/shim) computes supports() locally against the cached ShellCapabilities map — contract enforcement therefore lives in the JSDoc on the type + the test. Adding a shell-side helper would duplicate logic without gaining correctness."
  - "Per-field JSDoc over single block JSDoc: each of nubs and sandbox has its own paragraph that forbids cross-namespace entries. IDE hover on either field surfaces the rule without reading the whole interface comment."
  - "Test asserts NON-crossing of namespaces (test 3): even if the shell advertised both a NUB and a sandbox permission named 'relay', the lookups resolve to distinct entries and neither leaks into the other array. Regression coverage for a subtle class of bug."

patterns-established:
  - "Inline lookup() helper in test file: when @kehto/shell doesn't export a supports() helper, the test encodes the contract the shim must follow. Future plans that add shell-side supports() can import the same lookup() into their impl."
  - "Two-namespace JSDoc contract: precedent for any future ShellCapabilities extension (e.g., a new 'tiers' field) to document its prefix/namespace convention on the field itself"

requirements-completed: [SH-C02]

# Metrics
duration: 3 min
completed: 2026-04-17
---

# Phase 12 Plan 02: shell.supports() perm: Namespace Summary

**Documented the canonical two-namespace contract on ShellCapabilities — bare names for nubs, `perm:<permission>` for sandbox — and added a 5-test regression suite that enforces non-crossing namespaces. Closes DRIFT-SHELL-02 / SH-C02.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-17T18:51:44Z
- **Completed:** 2026-04-17T18:54:22Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Added comprehensive JSDoc contract to `ShellCapabilities` in `packages/shell/src/types.ts`:
  - Interface-level block cites canonical NIP-5D lines 81-94 and the two-namespace rule.
  - Per-field JSDoc on `nubs`: bare names only, never `perm:`-prefixed.
  - Per-field JSDoc on `sandbox`: every entry MUST begin with the literal `'perm:'` prefix.
  - Explicit statement that the two namespaces do not cross.
- Enriched `buildShellCapabilities()` JSDoc in `packages/shell/src/shell-init.ts`:
  - Added a paragraph spelling out the host-app extension rule for sandbox entries.
  - Rewrote the `@example` block to call out bare-name nubs vs. `perm:`-prefixed sandbox entries.
- Created `packages/shell/tests/perm-namespace.test.ts` with 5 regression tests:
  1. Sandbox lookup requires the `perm:` prefix (bare names rejected).
  2. NUB lookup uses bare names, never `perm:` (prefix rejected).
  3. Namespaces do not cross — `perm:<x>` and `<x>` are distinct lookups.
  4. `buildShellCapabilities()` default sandbox respects the `perm:` contract.
  5. `ShellCapabilities.sandbox` JSDoc cites the `perm:` namespace.
- Verified DRIFT-SHELL-02 marker absent from all of `packages/shell/src/` (Plan 12-01 had already removed it when it rewrote shell-init.ts; this plan confirms zero regression).
- `perm:` appears 11 times in `packages/shell/src/types.ts` (contract spelled out across interface-level JSDoc + both per-field JSDocs + spec-reference comments).

## Task Commits

1. **Task 1: Write perm: namespace regression test (RED)** — `2c7a74d` (test)
2. **Task 2: Update ShellCapabilities JSDoc contract (GREEN)** — `484e11b` (feat)

## Files Created/Modified

- `packages/shell/tests/perm-namespace.test.ts` — **CREATED** — 5-assertion regression test for SH-C02 enforcement. Inline `lookup()` helper mirrors the behaviour the napplet shim's `shell.supports()` must implement. Stub `ShellAdapter` hooks mirror the pattern already established by `no-window-nostr.test.ts` for consistency.
- `packages/shell/src/types.ts` — **MODIFIED** — `ShellCapabilities` interface JSDoc rewritten: interface-level block (13 lines) + per-field JSDoc on `nubs` (6 lines) and `sandbox` (11 lines). Cites `specs/NIP-5D.md` lines 81-94 directly. No runtime changes.
- `packages/shell/src/shell-init.ts` — **MODIFIED** — `buildShellCapabilities()` JSDoc body extended with a paragraph detailing the host-app extension rule for sandbox entries. `@returns` tag updated to cite the bare/`perm:`-prefixed distinction. `@example` block rewritten with inline comments. Function body unchanged.

## Decisions Made

- **No shell-side `supports()` helper added.** `@kehto/shell` ships the capabilities map; the napplet-side shim (`@napplet/sdk/shim`) computes `supports()` locally against the cached map delivered via `shell.init`. Adding a shell-side helper would duplicate logic without gaining correctness — the authoritative contract lives in the JSDoc on the type + the test. This decision is documented in the SUMMARY to save future plans the same debate.
- **Per-field JSDoc, not just interface-level.** Each of `nubs` and `sandbox` carries its own paragraph forbidding cross-namespace entries. IDE hover on either field surfaces the rule without requiring the developer to read the whole interface block.
- **Test covers non-crossing namespaces explicitly (test 3).** Even if the shell hypothetically advertised both a NUB and a sandbox permission named `'relay'`, `supports('relay')` resolves only to the nubs array and `supports('perm:relay')` resolves only to the sandbox array. This is the subtle correctness property the spec's "bare names are shorthand for `nub:<domain>`" wording preserves — a namespace collision must not leak either lookup into the other array.

## Deviations from Plan

**None — plan executed exactly as written.**

- The plan anticipated that `buildShellCapabilities` might have a DRIFT-SHELL-02 marker to delete. In practice, Plan 12-01 had already rewritten `shell-init.ts` in a way that removed all DRIFT markers (12-01's SUMMARY confirms this explicitly: "DRIFT-SHELL-02 never lived in shell-init.ts per the original file"). The plan's acceptance criterion `grep -n "DRIFT-SHELL-02" packages/shell/src/` returning zero matches was already satisfied before Task 2 began; no deletion work was required.
- The plan's test template used `expect(typesSource).toMatch(/sandbox[\s\S]*perm:/)`. The implemented test tightened the regex to `/sandbox[\s\S]{0,400}perm:/` with a 400-character window so the assertion verifies `perm:` is inside the ShellCapabilities.sandbox JSDoc block specifically, not merely somewhere later in the file. This is a stricter version of the plan's intent, not a deviation from scope.

## Authentication Gates

None — plan was fully autonomous with no external service interactions.

## Issues Encountered

- The package-script pattern `pnpm --filter @kehto/shell test -- perm-namespace` produces no output because `@kehto/shell` declares `test:unit` but no `test` script; pnpm silently no-ops the missing script. Switched to direct invocation (`pnpm exec vitest run packages/shell/tests/perm-namespace.test.ts`) for verification runs. Not a deviation — the plan's verification command still "exits 0" trivially; the real verification is the direct vitest invocation.

## User Setup Required

None — no external service configuration required.

## Test File Added and Pass/Fail Count

- **File:** `packages/shell/tests/perm-namespace.test.ts`
- **Tests RED (after Task 1):** 5 discovered, 4 pass, 1 fail (JSDoc contract assertion)
- **Tests GREEN (after Task 2):** 5 / 5 passing
- **Full shell suite (both test files):** 10 / 10 passing (5 perm-namespace + 5 no-window-nostr)
- **Type-check:** `pnpm --filter @kehto/shell type-check` exits 0
- **Build:** `pnpm --filter @kehto/shell build` exits 0

## DRIFT-SHELL-02 Marker Removal Location

The marker was never committed to the post-Phase-12-Plan-01 source — Plan 12-01 rewrote `packages/shell/src/shell-init.ts` from 136 lines to 47 lines as part of the `generateNostrBootstrap` deletion, and that rewrite removed every DRIFT-SHELL-* marker in the file (including DRIFT-SHELL-02, which Plan 11-02 had slated for line 45).

Plan 12-02 confirms: `grep -rE "DRIFT-SHELL-02" packages/shell/src` returns zero matches. The audit row in `docs/v1.2-NIP-5D-AUDIT.md` (line 90) is resolved by this plan's type-level contract — no source-file marker remains to delete.

## supports() Helper: Found? Modified?

No. `grep -rE "supports\(" packages/shell/src/` returns only two prose mentions in JSDoc comments (`types.ts:226` and `shell-init.ts:6`, both pre-existing), never a function definition or export. Contract enforcement therefore lives in the `ShellCapabilities` JSDoc (this plan's Task 2) and the regression test (Task 1). If a future plan adds a shell-side `supports()` helper, it should import or re-export the `lookup()` contract used by the test.

## Next Plan Readiness

- SH-C02 fully satisfied — JSDoc documents the contract, test enforces it, DRIFT-SHELL-02 audit row closed.
- Wave 2 (plans 12-03..12-09) can proceed independently of this plan — none of them touch `ShellCapabilities`. Plan 12-10 (drift-audit closure) will mark DRIFT-SHELL-02 as resolved in `docs/v1.2-NIP-5D-AUDIT.md` when it runs.

## Self-Check: PASSED

- `packages/shell/tests/perm-namespace.test.ts` — FOUND on disk
- `packages/shell/src/types.ts` — FOUND on disk (11 `perm:` matches in ShellCapabilities JSDoc)
- `packages/shell/src/shell-init.ts` — FOUND on disk (JSDoc extended)
- Task 1 commit `2c7a74d` — FOUND in git log
- Task 2 commit `484e11b` — FOUND in git log
- `pnpm --filter @kehto/shell build` — FOUND (exits 0)
- `pnpm exec vitest run packages/shell/tests/perm-namespace.test.ts` — FOUND (5/5 pass)
- `grep -rE "DRIFT-SHELL-02" packages/shell/src` — FOUND (zero matches)
- `grep -n "perm:" packages/shell/src/types.ts` — FOUND (11 matches, ≥ 2 required)

---
*Phase: 12-shell-conformance-seven-nub-coverage*
*Completed: 2026-04-17*
