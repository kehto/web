---
phase: 24-drift-core-06-cleanup
plan: 02
subsystem: infra
tags: [refactor, typescript, monorepo, acl, nip-5d, drift-core-06]

# Dependency graph
requires:
  - phase: 24-drift-core-06-cleanup (Plan 24-01)
    provides: "core-compat.ts deleted + Capability/ServiceDescriptor/REPLAY_WINDOW_SECONDS re-homed + placeholder-const blocks inlined at 7 downstream files"
provides:
  - "packages/runtime/src/enforce.ts narrowed — resolveCapabilities() deleted along with the runtime-flavored CapabilityResolution interface (@kehto/acl retains its own LIVE CapabilityResolution)"
  - "packages/runtime/src/state-handler.ts narrowed — handleStateRequest() deleted; only handleStorageNub + cleanupNappState remain"
  - "packages/runtime/src/service-discovery.ts file deleted entirely (synthetic kind-29010 discovery path had zero NIP-5D callers)"
  - "packages/runtime/src/acl-state.ts narrowed — requiresPrompt(kind) method + DESTRUCTIVE_KINDS placeholder deleted"
  - "packages/shell/src/acl-store.ts narrowed — requiresPrompt(kind) method + DESTRUCTIVE_KINDS placeholder deleted"
  - "packages/runtime/src/runtime.ts — BusKind placeholder deleted; IPC_PEER inlined as numeric literal 29000 at all 3 live call sites; resolveCapabilities + createServiceDiscoveryEvent imports dropped; local boolean isBusKind renamed to isShellKind"
  - "packages/runtime/src/index.ts barrel narrowed — resolveCapabilities, CapabilityResolution (runtime flavor), handleStateRequest, createServiceDiscoveryEvent, handleDiscoveryReq, isDiscoveryReq, DiscoverySubscription all dropped"
  - "packages/shell/src/index.ts lines 62-63 rewritten — dropped resolveCapabilities + CapabilityResolution; added createNubEnforceGate + NubEnforceConfig + NubMessage (live NUB-flavored enforcement surface)"
  - "packages/runtime/README.md + packages/shell/README.md scrubbed — dead-symbol bullets removed; Service-discovery-kind-29010 section deleted entirely"
  - "24-ITERATION-LOG.md records E2E-11 iteration-loop evidence per ROADMAP Phase 24 success criterion 5"
  - "Atomic commit covers Plan 24-01 + Plan 24-02 source work + both SUMMARY files + iteration log"
affects:
  - "Phase 25 — Release Publication (the @kehto/* packages will ship without core-compat.ts, without dead NIP-01 dispatch paths, and with READMEs that match the narrowed barrel exports)"
  - "Downstream consumers of @kehto/runtime / @kehto/shell — narrowed barrel surface; migration steps documented in the commit body"

tech-stack:
  added: []
  patterns:
    - "Atomic deletion pattern for dead code: Plan N inlines placeholder consts to preserve intermediate type-check greenness; Plan N+1 deletes both the placeholders and the dead call sites in a single commit. Source-truth baseline is always a fully-green commit."
    - "Manual clean substitution pattern for missing pnpm clean script (Phase 22 precedent): rm -rf packages/*/dist .turbo trees equivalent to turbo cache invalidation. Verified by Cached: 0 cached / 20 total on subsequent pnpm build."

key-files:
  created:
    - ".planning/phases/24-drift-core-06-cleanup/24-ITERATION-LOG.md — E2E-11 iteration-loop evidence per ROADMAP Phase 24 SC5"
    - ".planning/phases/24-drift-core-06-cleanup/24-02-SUMMARY.md — this file"
  modified:
    - "packages/runtime/src/enforce.ts — deleted runtime-flavored CapabilityResolution + resolveCapabilities() + BusKind/STATE_TOPICS placeholder consts; rewrote file-header JSDoc"
    - "packages/runtime/src/runtime.ts — deleted BusKind placeholder; inlined 29000 (// IPC_PEER) at 3 live sites; dropped resolveCapabilities + createServiceDiscoveryEvent imports; renamed local boolean isBusKind → isShellKind"
    - "packages/runtime/src/acl-state.ts — deleted DESTRUCTIVE_KINDS placeholder + requiresPrompt(kind) method + interface entry"
    - "packages/runtime/src/state-handler.ts — deleted handleStateRequest() + sendResponse + sendError helpers + BusKind placeholder; only handleStorageNub + cleanupNappState remain"
    - "packages/runtime/src/index.ts — narrowed barrel (dropped resolveCapabilities, CapabilityResolution, handleStateRequest, createServiceDiscoveryEvent, handleDiscoveryReq, isDiscoveryReq, DiscoverySubscription); scrubbed comment references to deleted symbols"
    - "packages/shell/src/index.ts — rewrote lines 62-63: dropped resolveCapabilities + CapabilityResolution; added createNubEnforceGate + NubEnforceConfig + NubMessage"
    - "packages/shell/src/acl-store.ts — deleted DESTRUCTIVE_KINDS placeholder + requiresPrompt(kind) method"
    - "packages/runtime/README.md — deleted resolveCapabilities bullet (Enforcement gate section), handleStateRequest bullet (State handler section), and the entire Service discovery (kind 29010) subsection (header + createServiceDiscoveryEvent + handleDiscoveryReq + isDiscoveryReq bullets)"
    - "packages/shell/README.md — rewrote Enforcement re-exports line to the live NUB-flavored surface (createEnforceGate + createNubEnforceGate + formatDenialReason + EnforceResult + EnforceConfig + NubEnforceConfig + IdentityResolver + AclChecker + NubMessage)"
    - "packages/runtime/src/dispatch.test.ts — updated stale comment at line 165 to reflect renamed variable isShellKind"
  deleted:
    - "packages/runtime/src/service-discovery.ts — 143-line file; synthetic kind-29010 discovery event synthesis + handleDiscoveryReq + isDiscoveryReq all deleted together"

key-decisions:
  - "Renamed local boolean `isBusKind` → `isShellKind` in runtime.ts. Plan's <must_haves> demands zero 'BusKind' references in packages/runtime/src/** (grep-clean). A local variable name was a residual reference; the new name reflects the filter intent (shell-bus kind range 29000-29999). Zero behavior change — variable is scoped inside handleRelayMessage."
  - "Manual clean substituted for `pnpm clean` (missing script). Phase 22-08's iteration log established this precedent exactly. Behavior is fully equivalent to what the plan described — cold rebuild with 0 cache hits, verified by Cached: 0 cached / 20 total after the manual rm -rf sweep."
  - "Comment scrubs for residual symbol references. Plan 24-01 already encountered this pattern (4 of its 5 deviations were grep-scope follow-throughs on comments). Task 1's acceptance greps surfaced 3 more comments that mentioned deleted identifiers by name; rewrote each to describe the deletion generically without the literal identifier."
  - "Preserved `@kehto/acl`'s LIVE `CapabilityResolution` interface untouched. Only the runtime-flavored duplicate in `packages/runtime/src/enforce.ts` was deleted. The acl-flavored one at `packages/acl/src/resolve.ts:46` is the return type of the live `resolveCapabilitiesNub` function and remains in 22 test files + the full acl barrel. Scope for `CapabilityResolution` grep assertion: `packages/runtime/src packages/shell/src` ONLY."

patterns-established:
  - "Atomic-commit discipline across a 2-plan phase: Plan N's SUMMARY is uncommitted until Plan N+1 commits both plans' work together, preserving the green-bar floor at every intermediate step and making the full refactor atomically revertible via a single `git revert`."
  - "Local-variable acceptance-grep hygiene: when a deletion plan uses `grep -rEn \"SymbolName\"` as an acceptance criterion, local identifier usages (variable names, comment mentions) also trigger the grep. Rename or rewrite these in the same commit as the symbol deletion — do not leave them for a follow-up."

requirements-completed: [DRIFT-02]

# Metrics
duration: approximately 7 min
completed: 2026-04-19
---

# Phase 24 Plan 02: DRIFT-CORE-06 Cleanup — Dead NIP-01 Code Path Deletion Summary

**Deleted all dead NIP-01 dispatch code from @kehto/runtime and @kehto/shell — `resolveCapabilities()` + runtime-flavored `CapabilityResolution`, `handleStateRequest()`, `service-discovery.ts` (file), `requiresPrompt(kind)` (both runtime AclStateContainer + shell acl-store), all `BusKind` / `AUTH_KIND` / `DESTRUCTIVE_KINDS` / `STATE_TOPICS` symbols, and all placeholder const blocks Plan 24-01 inlined as intermediate scaffolding. Narrowed `@kehto/runtime` barrel + rewrote `@kehto/shell` enforcement re-export block to the live NUB-flavored surface (`createNubEnforceGate` + `NubEnforceConfig` + `NubMessage`). Scrubbed runtime + shell READMEs. Recorded E2E-11 iteration loop: 442 unit / 47 e2e green on cold rebuild — Phase 23 baseline preserved exactly. Single atomic commit covers Plan 24-01 + Plan 24-02 work — DRIFT-01 + DRIFT-02 closed together.**

## Performance

- **Duration:** approximately 7 min (Plan 24-02 only; atomic commit captures combined Plan 24-01 + 24-02 work)
- **Started:** 2026-04-19T12:21:24Z
- **Completed:** 2026-04-19T12:28:45Z
- **Tasks:** 2 (all completed)
- **Files modified (Plan 24-02 only):** 10 (8 source + 2 README + 1 test-comment update)
- **Files deleted (Plan 24-02 only):** 1 (packages/runtime/src/service-discovery.ts)
- **Files created (Plan 24-02 only):** 2 (24-ITERATION-LOG.md + 24-02-SUMMARY.md)

## Accomplishments

- Deleted the last live reference to every NIP-01 bus-kind dispatch constant (BusKind, AUTH_KIND, DESTRUCTIVE_KINDS, STATE_TOPICS) from `packages/runtime/src/**` and `packages/services/src/**` — grep-clean across both trees.
- Deleted the dead `resolveCapabilities()` NIP-01 capability-resolution function and its runtime-flavored `CapabilityResolution` interface; preserved the LIVE `@kehto/acl`-flavored `CapabilityResolution` (distinct return type for `resolveCapabilitiesNub`, consumed by 22 acl tests).
- Deleted the dead `handleStateRequest()` NIP-01 state handler from `state-handler.ts`; retained `handleStorageNub` (canonical NIP-5D path) and `cleanupNappState` (lifecycle helper).
- Deleted `packages/runtime/src/service-discovery.ts` in its entirety — synthetic kind-29010 discovery event synthesis has zero NIP-5D callers (NubHandler dispatch routes `service.*` via `@napplet/core`'s `createDispatch().registerNub('media', ...)` etc.).
- Deleted `requiresPrompt(kind)` method from both `AclStateContainer` (runtime) and the shell's `acl-store` object; both were unused public API surfaces gating dead NIP-01 signer-consent branches.
- Narrowed `@kehto/runtime` barrel (`packages/runtime/src/index.ts`): dropped `resolveCapabilities`, runtime-flavored `CapabilityResolution`, `handleStateRequest`, `createServiceDiscoveryEvent`, `handleDiscoveryReq`, `isDiscoveryReq`, `DiscoverySubscription`.
- Rewrote `@kehto/shell` enforcement re-export block (`packages/shell/src/index.ts` lines 62-63): dropped the deleted `resolveCapabilities` + `CapabilityResolution` references; added `createNubEnforceGate` + `NubEnforceConfig` + `NubMessage` (live NUB-flavored surface).
- Inlined `kind: 29000` (with `// IPC_PEER — inlined numeric after Phase 24 shim deletion` trailing comments) at all three live IPC_PEER call sites in `runtime.ts`: `handleShellCommand.sendInterPaneReply`, `shell:send-dm` reply synthesis, `injectEvent`. Also dropped the Plan 24-01 inlined `const BusKind` placeholder block.
- Renamed local boolean `isBusKind` → `isShellKind` in `runtime.ts` (filter-predicate variable, scope: `handleRelayMessage`) so the `grep -rEn "BusKind" packages/runtime/src` acceptance criterion is grep-clean.
- Scrubbed `packages/runtime/README.md`: deleted the `resolveCapabilities` bullet, the `handleStateRequest` bullet, and the entire `Service discovery (kind 29010)` subsection (header + 2 bullets).
- Scrubbed `packages/shell/README.md`: rewrote the `Enforcement re-exports (from @kehto/runtime)` line to the live NUB-flavored surface.
- Recorded full E2E-11 iteration loop in `24-ITERATION-LOG.md`: manual clean → cold `pnpm build` (5.369s, 0 cached) → `pnpm test:unit` (442 passed / 29 test files) → `pnpm test:e2e` (47 passed / 0 failed / 0 skipped / 14.2s). ROADMAP Phase 24 success criterion 5 satisfied.
- Atomic commit covering all 24 files from Plan 24-01's uncommitted working tree + 10 Plan 24-02 source edits + 1 file deletion + both SUMMARYs + iteration log. DRIFT-01 + DRIFT-02 closed together.

## Task Commits

**Single atomic commit for the entire phase (Plan 24-01 + Plan 24-02 combined), per phase-level commit discipline described in Plan 24-01's SUMMARY handoff section.**

- **Phase 24 atomic commit:** `refactor(24): delete core-compat.ts and dead NIP-01 code paths (DRIFT-01 + DRIFT-02)` — covers 24 Plan 24-01 files (already staged/modified) + 10 Plan 24-02 source edits + 1 file deletion + 2 SUMMARY files + 1 iteration log.

## Files Created/Modified

### Created (Plan 24-02)

- `.planning/phases/24-drift-core-06-cleanup/24-ITERATION-LOG.md` — ROADMAP Phase 24 SC5 evidence (E2E-11 iteration-loop canon).
- `.planning/phases/24-drift-core-06-cleanup/24-02-SUMMARY.md` — this file.

### Modified (Plan 24-02)

- `packages/runtime/src/enforce.ts` — deleted runtime-flavored `CapabilityResolution` + `resolveCapabilities()` + the `const BusKind`/`const STATE_TOPICS` placeholder block inlined by Plan 24-01; rewrote file-header JSDoc to describe the NIP-5D-only enforcement posture without mentioning deleted identifiers by name.
- `packages/runtime/src/runtime.ts` — deleted the `const BusKind` placeholder block; inlined `29000, // IPC_PEER — inlined numeric after Phase 24 shim deletion` at 3 live call sites; dropped `resolveCapabilities` + `createServiceDiscoveryEvent` imports; renamed local boolean `isBusKind` → `isShellKind` (6 occurrences).
- `packages/runtime/src/acl-state.ts` — deleted the `const DESTRUCTIVE_KINDS` placeholder block + the `requiresPrompt(kind)` interface entry + the `requiresPrompt(kind)` method implementation.
- `packages/runtime/src/state-handler.ts` — deleted the `const BusKind` placeholder block + `sendResponse()` helper + `sendError()` helper + `handleStateRequest()` function entirely (lines 84-165 + dependencies). `handleStorageNub` + `cleanupNappState` retained with their own internal `sendResult`/`sendErrorNub` helpers (unchanged).
- `packages/runtime/src/index.ts` — pruned `resolveCapabilities` + `CapabilityResolution` from enforce.ts re-export (value + type); pruned `handleStateRequest` from state-handler.ts re-export; deleted the entire `// ─── Service Discovery ───` block (3 lines: section comment + value re-export + type re-export); rewrote the `Re-exports from canonical homes` comment to describe the deletions generically.
- `packages/shell/src/index.ts` — rewrote lines 62-63: value re-export now `createEnforceGate, createNubEnforceGate, formatDenialReason`; type re-export now `EnforceResult, EnforceConfig, NubEnforceConfig, IdentityResolver, AclChecker, NubMessage`. Line 65 `ConsentRequest` re-export preserved unchanged.
- `packages/shell/src/acl-store.ts` — deleted the `const DESTRUCTIVE_KINDS` placeholder block + the `requiresPrompt(kind)` method.
- `packages/runtime/README.md` — deleted 4 bullet-lines (Enforcement gate `resolveCapabilities`, State handler `handleStateRequest`, Service discovery section header + 2 bullets).
- `packages/shell/README.md` — rewrote line 87 of the Enforcement re-exports section to match the post-24-02 shell barrel surface.
- `packages/runtime/src/dispatch.test.ts` — updated stale comment at line 165 (`// Empty filters: isBusKind is false …` → `// Empty filters: the shell-kind fast path is false …`). No test-behavior change.

### Deleted (Plan 24-02)

- `packages/runtime/src/service-discovery.ts` — 143-line file containing `createServiceDiscoveryEvent()` + `handleDiscoveryReq()` + `isDiscoveryReq()` + `DiscoverySubscription` interface + the `const BusKind = { SERVICE_DISCOVERY: 29010 }` placeholder. All consumers are dead NIP-01 branches; NIP-5D dispatch routes `service.*` via `@napplet/core`'s `NubHandler` registration.

### Staged/Modified from Plan 24-01 (captured by the atomic commit)

All 24 files from Plan 24-01's uncommitted working tree — see `.planning/phases/24-drift-core-06-cleanup/24-01-SUMMARY.md` for the full list.

## Decisions Made

See `key-decisions` frontmatter above. Three explicit decisions:

1. **Renamed local `isBusKind` → `isShellKind`** — grep-clean scope compliance without changing behavior.
2. **Manual clean substituted for `pnpm clean`** — Phase 22 precedent; missing root script; behavior verified equivalent (0 cache hits).
3. **Scrubbed comment references to deleted symbols** — same pattern as Plan 24-01's deviations; word-boundary grep acceptance needs comments clean too.
4. **Preserved `@kehto/acl`'s LIVE `CapabilityResolution` interface untouched** — distinct from the deleted runtime-flavored duplicate; live return type for `resolveCapabilitiesNub`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual clean substituted for `pnpm clean` (root script not defined).**

- **Found during:** Task 2, Step 2.2 (fresh-build iteration loop).
- **Issue:** Plan specifies `pnpm clean && pnpm build && pnpm test:e2e`. Running `pnpm clean` at repo root returned `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "clean" not found`. Root `package.json` does not define a `clean` script.
- **Fix:** Used manual `rm -rf packages/*/dist packages/*/.turbo tests/fixtures/napplets/*/dist tests/e2e/harness/dist tests/e2e/harness/.turbo apps/*/dist apps/*/.turbo` + recursive `.turbo` purge. Matches Phase 22-08's established precedent (`22-ITERATION-LOG.md:823`, same exact pattern).
- **Files modified:** None (shell cleanup only; no source changes).
- **Verification:** Subsequent `pnpm build` reported `Cached: 0 cached, 20 total` — confirmed cold rebuild with 0 cache hits, fully equivalent to what `pnpm clean` would trigger.
- **Committed in:** Atomic Phase 24 commit.

**2. [Rule 2 - Missing Critical] Renamed local boolean `isBusKind` → `isShellKind` in runtime.ts.**

- **Found during:** Task 1, Step 1.11 (type-check validation + grep acceptance).
- **Issue:** Plan's `<must_haves>` requires zero `BusKind` references in `packages/runtime/src/**`. A local boolean `const isBusKind = filters.length > 0 && filters.every((f) => f.kinds?.every((k) => k >= 29000 && k < 30000))` at `runtime.ts:502` is a residual identifier-level reference (6 usage sites inside `handleRelayMessage`).
- **Fix:** Renamed identifier to `isShellKind` (name reflects filter semantics: shell-bus kind range 29000-29999). Replace-all updates 6 usage sites.
- **Files modified:** `packages/runtime/src/runtime.ts`.
- **Verification:** `grep -rEn "BusKind" packages/runtime/src packages/services/src` returns 0 hits. `pnpm type-check` passes 8/8. `pnpm test:unit` 442/442.
- **Committed in:** Atomic Phase 24 commit.

**3. [Rule 2 - Missing Critical] Scrubbed residual comment references to deleted symbols (enforce.ts, runtime/index.ts, shell/index.ts).**

- **Found during:** Task 1, Step 1.11 + final grep sweep.
- **Issue:** Three JSDoc / explanatory comments mentioned deleted identifiers by name:
  - `enforce.ts:8` file-header: "deleted the legacy resolveCapabilities() function along with its BusKind / STATE_TOPICS dispatch table"
  - `runtime/index.ts:82-84` Re-exports-from-canonical-homes comment: "The legacy BusKind-value-union type and the NIP-01 constants (BusKind, AUTH_KIND, DESTRUCTIVE_KINDS, STATE_TOPICS, …) are no longer exported"
  - `dispatch.test.ts:165`: "Empty filters: isBusKind is false …"
  Plan's word-boundary grep acceptance criteria would match these (same pattern as Plan 24-01's deviations #3/#4/#5).
- **Fix:** Rewrote each to describe the deletion generically without the literal identifier:
  - `enforce.ts`: "deleted the legacy capability-resolution function along with its dead kind + topic dispatch table"
  - `runtime/index.ts`: "The legacy bus-kind value-union type and the NIP-01 kind + topic + auth + destructive-kind constants are no longer exported"
  - `dispatch.test.ts`: "the shell-kind fast path is false"
- **Files modified:** `packages/runtime/src/enforce.ts`, `packages/runtime/src/index.ts`, `packages/runtime/src/dispatch.test.ts`.
- **Verification:** `grep -rEn "BusKind|AUTH_KIND|DESTRUCTIVE_KINDS|STATE_TOPICS|\\bresolveCapabilities\\b|\\bCapabilityResolution\\b" packages/runtime/src packages/shell/src packages/services/src` returns 0 hits.
- **Committed in:** Atomic Phase 24 commit.

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking, 2 Rule 2 missing-critical).
**Impact on plan:** Plan scope preserved exactly. All 3 deviations are grep-acceptance scope follow-throughs (identical mechanism to Plan 24-01's deviation pattern). Zero behavioral regressions — 442/442 unit tests + 47/47 e2e tests pass on the post-refactor cold rebuild, exactly matching Phase 23 baseline.

## Issues Encountered

None beyond the 3 deviations documented above. No behavioral regressions.

## User Setup Required

None — pure internal refactor. No external service configuration required.

## ROADMAP Phase 24 Success Criteria Verification

| SC | Statement | Check | Status |
|----|-----------|-------|--------|
| 1 | core-compat shim gone | `test ! -f packages/runtime/src/core-compat.ts` + `git grep -n "core-compat" -- packages/ apps/ tests/ specs/` returns 0 hits | PASS |
| 2 | Live types re-homed | `Capability` → `@kehto/acl/capabilities`; `ServiceDescriptor` → `packages/runtime/src/types.ts`; `REPLAY_WINDOW_SECONDS` inlined in `replay.ts` | PASS |
| 3 | Dead NIP-01 constants gone | `grep -rEn "BusKind\|AUTH_KIND\|DESTRUCTIVE_KINDS\|STATE_TOPICS" packages/runtime/src packages/services/src` returns 0 hits | PASS |
| 4 | Behavioral parity | `pnpm test:unit` → 442 passed / 0 failed / 0 skipped (Phase 23 baseline unchanged) | PASS |
| 5 | Iteration loop recorded | `24-ITERATION-LOG.md` contains full cold-rebuild e2e evidence (47 passed / 0 failed / 0 skipped / 14.2s) | PASS |

**All 5 ROADMAP Phase 24 success criteria satisfied.** DRIFT-01 + DRIFT-02 both closed. Phase 24 COMPLETE.

## Handoff to Phase 25 (Release Publication)

Phase 25's `pnpm changeset publish` will ship the narrowed barrels. Pre-publish sanity checks:

1. **`@kehto/runtime` package.json exports map:** Confirm `"./package.json"`, main `"."` entry, and any subpath entries (none added in Phase 24) point at files that actually exist in `dist/`. Run `pnpm dlx publint packages/runtime` — should report `All good!` (same as Phase 22-04 baseline; the narrowed barrel is a pure deletion, no new entries).
2. **`@kehto/shell` package.json exports map:** Same check. `publint` should remain clean — lines 62-63 of `src/index.ts` changed but the `.` export target (`dist/index.js` + `dist/index.d.ts`) is unchanged in shape.
3. **README sync:** Both `packages/runtime/README.md` and `packages/shell/README.md` were scrubbed of dead-symbol bullets — verify no remaining links point at `_kehto_runtime.resolveCapabilities.html` / `_kehto_runtime.handleStateRequest.html` / `_kehto_runtime.createServiceDiscoveryEvent.html` etc. (typedoc will not generate those pages since the exports are gone — would produce broken doc links).
4. **`@napplet/core` peer-dep range:** Unchanged from Phase 22-05 rehearsal (`^0.2.0`). No Phase 24 edits touched any `package.json` peerDependencies / dependencies.
5. **Changesets:** v1-3-*.md changesets staged per Phase 22-06 remain unchanged. If Phase 25 opens a v1.4 minor bump (warranted by the breaking public-API removal: `resolveCapabilities`, runtime-flavored `CapabilityResolution`, `handleStateRequest`, `createServiceDiscoveryEvent`, `handleDiscoveryReq`, `isDiscoveryReq`, `DiscoverySubscription` all exported before Phase 24, deleted in Phase 24), author new v1-4-*.md files per Phase 22-06 conventions.
6. **attw `--profile esm-only`:** Re-run to confirm still clean (same discipline as Phase 22-04).

## Next Phase Readiness

- **Phase 25 (npm publication) unblocked.** Clean barrel surface. Zero dead code in the dist artifacts.
- **No new blockers.** All tests pass on cold rebuild. Plan 24-01's staged work is now committed atomically with 24-02's deletions.
- **Downstream consumers outside the repo:** None — this is a pre-v1.4 milestone. v1.3 published unchanged core-compat.ts; v1.4 will publish without it. Migration guidance for external consumers already belongs in the v1.4 changesets (authored in Phase 25).

## Self-Check: PASSED

- [x] `packages/runtime/src/service-discovery.ts` does not exist (`test ! -f` confirmed)
- [x] `packages/runtime/src/enforce.ts` no longer declares `CapabilityResolution` or `resolveCapabilities` (grep returns 0)
- [x] `packages/runtime/src/acl-state.ts` no longer declares `requiresPrompt` or `DESTRUCTIVE_KINDS` (grep returns 0)
- [x] `packages/runtime/src/state-handler.ts` no longer declares `handleStateRequest` or `BusKind` (grep returns 0)
- [x] `packages/runtime/src/runtime.ts` has 3 occurrences of `kind: 29000` (inlined IPC_PEER sites)
- [x] `packages/runtime/src/runtime.ts` has 0 occurrences of `BusKind` (const + variable both scrubbed)
- [x] `packages/runtime/src/index.ts` barrel contains `createNubEnforceGate` but NOT `resolveCapabilities` / `CapabilityResolution` / `handleStateRequest` / `createServiceDiscoveryEvent` / `handleDiscoveryReq` / `isDiscoveryReq` / `DiscoverySubscription`
- [x] `packages/shell/src/index.ts` line 62 contains `createNubEnforceGate` and NOT `resolveCapabilities`
- [x] `packages/shell/src/index.ts` line 63 type re-export does NOT contain `CapabilityResolution`
- [x] `packages/shell/src/acl-store.ts` no longer declares `requiresPrompt` or `DESTRUCTIVE_KINDS` (grep returns 0)
- [x] `packages/runtime/README.md` contains 0 hits for `resolveCapabilities`, `handleStateRequest`, `createServiceDiscoveryEvent`, `handleDiscoveryReq`, `isDiscoveryReq`; the `Service discovery (kind 29010)` section is deleted
- [x] `packages/shell/README.md` contains 0 hits for `resolveCapabilities` or `CapabilityResolution`; enforcement re-exports line matches the narrowed shell barrel surface
- [x] `pnpm type-check` exits 0 across 8 tasks
- [x] `pnpm test:unit` reports exactly 442 passed / 0 failed / 0 skipped
- [x] `pnpm test:e2e` on cold rebuild reports exactly 47 passed / 0 failed / 0 skipped (Phase 23 baseline preserved)
- [x] `24-ITERATION-LOG.md` exists and contains `pnpm build`, `pnpm test:e2e`, `442`, `47` (all required evidence markers)
- [x] `@kehto/acl`'s LIVE `CapabilityResolution` interface at `packages/acl/src/resolve.ts:46` is untouched (grep confirms 35+ legitimate usages across the acl package and its tests)
- [x] Atomic commit message contains `refactor(24):` + `DRIFT-01` + `DRIFT-02` markers

---
*Phase: 24-drift-core-06-cleanup*
*Completed: 2026-04-19 (atomic commit)*
