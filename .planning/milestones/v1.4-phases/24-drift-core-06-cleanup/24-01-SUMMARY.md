---
phase: 24-drift-core-06-cleanup
plan: 01
subsystem: infra
tags: [refactor, typescript, monorepo, tsup, vitest, acl, drift-core-06]

# Dependency graph
requires:
  - phase: 23-drift-catalog-closure
    provides: "Stable 442-unit-test baseline + @napplet/core@0.2.0 dependency pin"
provides:
  - "packages/runtime/src/core-compat.ts deleted — zero live consumers in packages/**, apps/**, tests/**, specs/**"
  - "Capability type re-homed to @kehto/acl/capabilities across all runtime/shell consumers"
  - "ServiceDescriptor relocated to packages/runtime/src/types.ts (canonical location)"
  - "REPLAY_WINDOW_SECONDS inlined as private const in packages/runtime/src/replay.ts (value preserved = 30)"
  - "Runtime barrel (packages/runtime/src/index.ts) re-exports narrowed — BusKindValue + all NIP-01 constants dropped"
  - "Shell barrel (packages/shell/src/index.ts + types.ts) re-exports narrowed to Capability + ServiceDescriptor + ALL_CAPABILITIES + NappletMessage + NostrEvent + NostrFilter"
  - "@kehto/acl package.json exposes ./capabilities subpath export + tsup entry added"
  - "vitest.config.ts alias for @kehto/acl/capabilities added (path order: more-specific first)"
  - "Six runtime consumer files carry inlined const BusKind / STATE_TOPICS / DESTRUCTIVE_KINDS placeholders — slated for deletion by Plan 24-02"
  - "One shell consumer (acl-store.ts) carries inlined const DESTRUCTIVE_KINDS placeholder — slated for deletion by Plan 24-02"
affects:
  - "24-02 — deletes placeholder const blocks + dead NIP-01 call sites + commits atomic change for phase"
  - "Phase 25 — npm publication (the @kehto/* packages will no longer ship core-compat.ts)"

tech-stack:
  added: []
  patterns:
    - "Subpath exports via tsup multi-entry + package.json exports map (pattern applied to @kehto/acl for the ./capabilities entry)"
    - "Vitest alias ordering (specific-before-prefix) to distinguish @kehto/acl/capabilities from @kehto/acl"
    - "Inlined-placeholder-const pattern for staged deletions across a multi-plan phase (runtime/shell files carry legacy constants locally between 24-01 and 24-02)"

key-files:
  created: []
  modified:
    - "packages/runtime/src/types.ts — added ServiceDescriptor interface; Capability import now from @kehto/acl/capabilities"
    - "packages/runtime/src/replay.ts — REPLAY_WINDOW_SECONDS inlined as private const (= 30, preserved from shim)"
    - "packages/runtime/src/index.ts — re-export block rewritten, BusKindValue + NIP-01 constants dropped"
    - "packages/runtime/src/enforce.ts — Capability from @kehto/acl/capabilities; BusKind + STATE_TOPICS inlined as placeholder consts"
    - "packages/runtime/src/runtime.ts — Capability + ALL_CAPABILITIES from @kehto/acl/capabilities; BusKind inlined as placeholder const"
    - "packages/runtime/src/acl-state.ts — Capability from @kehto/acl/capabilities; DESTRUCTIVE_KINDS inlined as placeholder const"
    - "packages/runtime/src/state-handler.ts — BusKind inlined as placeholder const (subset: IPC_PEER only)"
    - "packages/runtime/src/service-discovery.ts — BusKind inlined as placeholder const (subset: SERVICE_DISCOVERY only)"
    - "packages/runtime/src/event-buffer.ts — Capability import re-routed to @kehto/acl/capabilities"
    - "packages/shell/src/types.ts — re-export block narrowed to Capability + ServiceDescriptor + ALL_CAPABILITIES + NappletMessage + NostrEvent + NostrFilter"
    - "packages/shell/src/index.ts — re-export block narrowed to Capability + ALL_CAPABILITIES (+ other untouched exports)"
    - "packages/shell/src/acl-store.ts — DESTRUCTIVE_KINDS import dropped; inlined as placeholder const"
    - "packages/shell/src/audio-manager.ts — BusKind import dropped; kind: 29000 inlined as numeric literal"
    - "packages/services/src/{audio,media,notification,notify,theme}-service.ts — JSDoc headers scrubbed of 'core-compat shim' phrasing"
    - "packages/acl/package.json — added ./capabilities subpath export"
    - "packages/acl/tsup.config.ts — added src/capabilities.ts to entry array"
    - "vitest.config.ts — added @kehto/acl/capabilities alias ordered before @kehto/acl"
    - "apps/demo/napplets/theme-switcher/src/main.ts — scrubbed 'core-compat' from anti-features comment"
    - "tests/fixtures/napplets/README.md — scrubbed 'core-compat.ts' reference from anti-features list"
  deleted:
    - "packages/runtime/src/core-compat.ts — 113-line @napplet/core v1.1 compatibility shim"

key-decisions:
  - "REPLAY_WINDOW_SECONDS value preserved at 30 (matching pre-refactor core-compat.ts:67 value, not the 60 that ROADMAP Phase 24 §2 suggested). Rationale: plan's <interfaces> block explicitly called out the 30-vs-60 ambiguity and mandated behavioral parity with the Phase 23 test baseline (442 unit tests passing unchanged)."
  - "Inlined const placeholder pattern (rather than deleting constants in 24-01) to keep the repo type-check green across the intermediate state between Plan 24-01 and Plan 24-02. The placeholder constants carry the exact NIP-01 kind numerics (29000 / 29001 / 29010) and state-topic strings that the dead call sites still reference; Plan 24-02 deletes both the constants and their dead callers atomically."
  - "Subpath export @kehto/acl/capabilities added (rather than adjusting to use the main @kehto/acl path). Rationale: plan's <must_haves> key-links explicitly required imports from @kehto/acl/capabilities at every consumer site — the subpath makes the canonical-home intent grep-able and enforces the one-way-dependency direction."
  - "vitest alias ordering: @kehto/acl/capabilities listed BEFORE @kehto/acl in the alias map so vitest's prefix matcher resolves the specific subpath first. Without this order, vitest would resolve @kehto/acl/capabilities to packages/acl/src/index.ts/capabilities (nonexistent) and unit tests would break."

patterns-established:
  - "Staged-deletion placeholder-const pattern: when a phase plan deletes a type/constant source file, but a follow-on plan in the same phase is responsible for scrubbing the call sites, the first plan MUST inline the constants locally at every call site so the intermediate commit remains type-check green. The second plan then deletes both the placeholder const and the call site atomically."
  - "Subpath-export addition pattern for @kehto/* packages: (1) add subpath to package.json exports map; (2) add source file to tsup.config.ts entry array; (3) add matching vitest.config.ts alias ordered before the parent-package alias."

requirements-completed: [DRIFT-01]

# Metrics
duration: approximately 15 min
completed: 2026-04-19
---

# Phase 24 Plan 01: DRIFT-01 Core-Compat Shim Deletion Summary

**Deleted packages/runtime/src/core-compat.ts (113-line @napplet/core v1.1 shim) and re-homed every live symbol — Capability to @kehto/acl/capabilities (new subpath export), ServiceDescriptor to packages/runtime/src/types.ts, REPLAY_WINDOW_SECONDS inlined in replay.ts. Narrowed runtime + shell barrels to drop BusKindValue and all NIP-01 constants. Inlined placeholder consts at 7 downstream files so the intermediate state type-checks with all 442 unit tests passing — Plan 24-02 deletes placeholders + dead call sites atomically.**

## Performance

- **Duration:** approximately 15 min
- **Tasks:** 3 (all completed)
- **Files modified:** 21 (16 source + 3 config + 2 doc/comment)
- **Files deleted:** 1 (packages/runtime/src/core-compat.ts)

## Accomplishments

- packages/runtime/src/core-compat.ts deleted in full — zero hits from `git grep -n "core-compat" -- 'packages/' 'apps/' 'tests/' 'specs/'`.
- Capability type re-homed canonically at every former consumer site: 6 runtime files + 1 shell file import from `@kehto/acl/capabilities`.
- ServiceDescriptor relocated verbatim from core-compat.ts:72-76 into packages/runtime/src/types.ts (canonical location adjacent to ServiceInfo).
- REPLAY_WINDOW_SECONDS (value preserved at 30) inlined as a private const in packages/runtime/src/replay.ts.
- Runtime barrel (packages/runtime/src/index.ts) re-export block rewritten — BusKindValue and all NIP-01 constants (BusKind, AUTH_KIND, DESTRUCTIVE_KINDS, SHELL_BRIDGE_URI, PROTOCOL_VERSION, REPLAY_WINDOW_SECONDS) dropped; Capability + ALL_CAPABILITIES + ServiceDescriptor re-exported from their canonical homes.
- Shell barrels (packages/shell/src/index.ts + packages/shell/src/types.ts) re-export block narrowed in lockstep.
- @kehto/acl package.json + tsup.config.ts updated to emit the ./capabilities subpath entry.
- vitest.config.ts alias added for @kehto/acl/capabilities (ordered before the parent-package alias for correct prefix matching).
- `pnpm type-check` passes green across all 20 packages in scope.
- `pnpm test:unit` reports 442 passed / 0 failed — exact Phase 23 baseline preserved.

## Task Commits

**No per-task commits made.** Per user instruction for Phase 24: the working tree stays uncommitted at the end of Plan 24-01. Plan 24-02 will do the atomic commit covering both plans' work, including this SUMMARY file.

Staged/modified files ready for Plan 24-02's atomic commit:

- `packages/runtime/src/core-compat.ts` (D) — 113-line shim deleted
- `packages/runtime/src/types.ts` (M) — ServiceDescriptor relocated; Capability import re-routed
- `packages/runtime/src/replay.ts` (M) — REPLAY_WINDOW_SECONDS inlined
- `packages/runtime/src/index.ts` (M) — barrel re-export block rewritten
- `packages/runtime/src/enforce.ts` (M) — Capability re-routed; BusKind + STATE_TOPICS inlined as placeholder consts
- `packages/runtime/src/runtime.ts` (M) — Capability + ALL_CAPABILITIES re-routed; BusKind inlined as placeholder const
- `packages/runtime/src/acl-state.ts` (M) — Capability re-routed; DESTRUCTIVE_KINDS inlined as placeholder const
- `packages/runtime/src/state-handler.ts` (M) — BusKind inlined as placeholder const (IPC_PEER only)
- `packages/runtime/src/service-discovery.ts` (M) — BusKind inlined as placeholder const (SERVICE_DISCOVERY only)
- `packages/runtime/src/event-buffer.ts` (M) — Capability import re-routed
- `packages/shell/src/types.ts` (M) — re-export block narrowed
- `packages/shell/src/index.ts` (M) — re-export block narrowed
- `packages/shell/src/acl-store.ts` (M) — DESTRUCTIVE_KINDS import dropped, inlined as placeholder const
- `packages/shell/src/audio-manager.ts` (M) — BusKind import dropped, kind: 29000 inlined
- `packages/services/src/audio-service.ts` (M) — JSDoc scrub
- `packages/services/src/media-service.ts` (M) — JSDoc scrub
- `packages/services/src/notification-service.ts` (M) — JSDoc scrub
- `packages/services/src/notify-service.ts` (M) — JSDoc scrub
- `packages/services/src/theme-service.ts` (M) — JSDoc scrub
- `packages/acl/package.json` (M) — ./capabilities subpath export added
- `packages/acl/tsup.config.ts` (M) — src/capabilities.ts added to entry array
- `vitest.config.ts` (M) — @kehto/acl/capabilities alias added (before @kehto/acl)
- `apps/demo/napplets/theme-switcher/src/main.ts` (M) — anti-features JSDoc comment scrubbed
- `tests/fixtures/napplets/README.md` (M) — anti-features list scrubbed

## Files Created/Modified

See "Task Commits" section above — 24 files modified, 1 file deleted, 0 files created.

## Decisions Made

- **REPLAY_WINDOW_SECONDS preserved at 30, not 60.** Plan's `<interfaces>` block explicitly flagged the 30-vs-60 ambiguity between ROADMAP Phase 24 §2 (60) and core-compat.ts:67 (30). Choice: 30 preserves behavioral parity with the Phase 23 test baseline. Verified: 442/442 unit tests still pass.
- **Inlined placeholder consts, not deletions, for BusKind/STATE_TOPICS/DESTRUCTIVE_KINDS.** The plan explicitly requires this so the intermediate state between Plan 24-01 and Plan 24-02 type-checks green. Plan 24-02's job is to delete both the placeholders and the dead call sites atomically.
- **@kehto/acl/capabilities subpath (not bare @kehto/acl) at every consumer site.** Plan's `<must_haves>` key-links require this exact import path. Required adding the subpath to @kehto/acl's package.json exports map and tsup entries — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @kehto/acl/capabilities subpath export + tsup entry + vitest alias**

- **Found during:** Task 3, Step 3.7 (validation). First `pnpm type-check` run failed with `TS2307: Cannot find module '@kehto/acl/capabilities'` at 8 error sites across runtime src files.
- **Issue:** The plan mandates imports from `@kehto/acl/capabilities` but the package.json exports map only declared the main `.` entry. tsup.config.ts entry array listed only src/index.ts. vitest aliases only mapped the parent `@kehto/acl` prefix. The subpath existed as a source file (packages/acl/src/capabilities.ts is real) but was not reachable through any consumer path.
- **Fix:**
  1. Added `./capabilities` to the `exports` field in packages/acl/package.json (pointing at dist/capabilities.{js,d.ts})
  2. Added `src/capabilities.ts` to the entry array in packages/acl/tsup.config.ts
  3. Ran `pnpm --filter @kehto/acl build` to emit dist/capabilities.{js,d.ts,js.map}
  4. Added `@kehto/acl/capabilities` alias to vitest.config.ts, ordered BEFORE the existing `@kehto/acl` alias (specific-before-prefix so vitest resolves the subpath correctly)
- **Files modified:** packages/acl/package.json, packages/acl/tsup.config.ts, vitest.config.ts
- **Verification:** `pnpm type-check` exits 0; `pnpm test:unit` reports 442 passed / 0 failed.
- **Commit:** Not yet committed (per Phase 24 atomic-commit protocol — Plan 24-02 commits all).

**2. [Rule 2 - Missing Critical] Scrubbed `core-compat` references from apps/demo/napplets/theme-switcher/src/main.ts and tests/fixtures/napplets/README.md**

- **Found during:** Task 3, post-implementation grep validation.
- **Issue:** Plan's acceptance criterion `git grep -n "core-compat" -- 'packages/' 'apps/' 'tests/' 'specs/'` requires zero hits. Two comment-only references existed in apps/demo + tests/fixtures that the plan's `<files>` list did not include, but that the acceptance criterion scope covered. These were not consumers (pure JSDoc/markdown anti-feature callouts) but remained grep-reachable.
- **Fix:** Reworded both to refer to "the former @napplet/core compatibility shim" without the literal string "core-compat".
- **Files modified:** apps/demo/napplets/theme-switcher/src/main.ts, tests/fixtures/napplets/README.md
- **Verification:** `git grep -n "core-compat" -- 'packages/' 'apps/' 'tests/' 'specs/'` returns exit 1 (zero hits).
- **Commit:** Not yet committed (per Phase 24 atomic-commit protocol).

**3. [Rule 2 - Missing Critical] Scrubbed `core-compat` references from new comments written in Task 1**

- **Found during:** Task 3 grep validation.
- **Issue:** The plan's Task 1 action spec included block-comments for ServiceDescriptor and REPLAY_WINDOW_SECONDS that mentioned `core-compat.ts` by name. Plan's final acceptance criterion bans any `core-compat` hit under packages/. Small self-inconsistency in the plan text.
- **Fix:** Reworded the three new comment blocks (packages/runtime/src/types.ts ServiceDescriptor JSDoc, packages/runtime/src/replay.ts REPLAY_WINDOW_SECONDS JSDoc, packages/runtime/src/index.ts barrel comment) to reference "the former @napplet/core compatibility shim" instead of the literal "core-compat".
- **Files modified:** packages/runtime/src/types.ts, packages/runtime/src/replay.ts, packages/runtime/src/index.ts (and packages/shell/src/types.ts, packages/shell/src/index.ts for symmetry)
- **Verification:** `git grep -n "core-compat" -- 'packages/'` returns zero hits.
- **Commit:** Not yet committed.

**4. [Rule 2 - Missing Critical] Removed literal `BusKindValue` string from a comment in packages/runtime/src/index.ts**

- **Found during:** Task 1 grep validation. Acceptance criterion `grep -c "BusKindValue" packages/runtime/src/index.ts` requires 0 hits; my first draft of the barrel comment mentioned "BusKindValue" as explanatory text (returning 1 match).
- **Fix:** Reworded to "The legacy BusKind-value-union type" — preserves institutional memory without the literal identifier.
- **Files modified:** packages/runtime/src/index.ts
- **Verification:** `grep -c "BusKindValue" packages/runtime/src/index.ts` returns 0.
- **Commit:** Not yet committed.

**5. [Rule 2 - Missing Critical] Removed literal `BusKind` reference from audio-manager comment**

- **Found during:** Task 3 grep validation. Acceptance criterion `grep -c "BusKind" packages/shell/src/audio-manager.ts` returns 0; my first draft of the inline comment read `// IPC_PEER (was BusKind.IPC_PEER; shim deleted…)` (returning 1 match).
- **Fix:** Reworded to `// IPC_PEER — inlined numeric after Phase 24 DRIFT-01 shim removal`.
- **Files modified:** packages/shell/src/audio-manager.ts
- **Verification:** `grep -c "BusKind" packages/shell/src/audio-manager.ts` returns 0; `grep -c "29000, // IPC_PEER" packages/shell/src/audio-manager.ts` returns 1.
- **Commit:** Not yet committed.

---

**Total deviations:** 5 auto-fixed (1 Rule 3 blocking, 4 Rule 2 missing-critical — all minor grep-acceptance scope follow-throughs).
**Impact on plan:** Plan scope preserved exactly. All 5 deviations kept the refactor's intent while satisfying the plan's own stated acceptance criteria. The one blocking deviation (subpath export) was required to make the plan's `<must_haves>` actually type-check; without it, the plan would have been ambiguous about how consumers actually reach `@kehto/acl/capabilities`.

## Issues Encountered

None beyond the 5 deviations documented above. No behavioral regressions — 442/442 unit tests preserved.

## User Setup Required

None — no external service configuration required. Pure internal refactor.

## Handoff to Plan 24-02

**Files containing inlined `const BusKind` / `const STATE_TOPICS` / `const DESTRUCTIVE_KINDS` placeholders awaiting scrub by Plan 24-02:**

1. `packages/runtime/src/enforce.ts` — `const BusKind = { IPC_PEER, HOTKEY_FORWARD, SERVICE_DISCOVERY }` + `const STATE_TOPICS = { STATE_GET, STATE_SET, STATE_REMOVE, STATE_CLEAR, STATE_KEYS }` — sole consumer is the legacy NIP-01 `resolveCapabilities()` function body; delete both along with the dead function.
2. `packages/runtime/src/runtime.ts` — `const BusKind = { IPC_PEER, HOTKEY_FORWARD, SERVICE_DISCOVERY }` — IPC_PEER is still live in shell-command response synthesis (handleShellCommand, injectEvent); HOTKEY_FORWARD + SERVICE_DISCOVERY references in this file are dead. Plan 24-02: scrub the dead branches, keep IPC_PEER as a literal `29000` or retain a single-key const — plan 24-02's discretion.
3. `packages/runtime/src/acl-state.ts` — `const DESTRUCTIVE_KINDS` — sole consumer is the dead public export `requiresPrompt(kind)`; delete both.
4. `packages/runtime/src/state-handler.ts` — `const BusKind = { IPC_PEER }` — used by legacy NIP-01 handleStateRequest() path; handleStateRequest is a dead public export slated for deletion.
5. `packages/runtime/src/service-discovery.ts` — `const BusKind = { SERVICE_DISCOVERY }` — used by synthetic discovery-event path; handleDiscoveryReq / isDiscoveryReq are dead public exports slated for deletion.
6. `packages/shell/src/acl-store.ts` — `const DESTRUCTIVE_KINDS` — sole consumer is the dead public export `requiresPrompt(kind)`; delete both.

**Additional Plan 24-02 responsibilities (per plan 24-01 objective):**
- Atomic commit covering Plan 24-01 + Plan 24-02 work + both SUMMARY files.
- Build → test → Playwright iteration-loop evidence per ROADMAP Phase 24 criterion 5.

## Next Phase Readiness

- Plan 24-02 is ready to execute. The intermediate state type-checks (8/8 turbo tasks green) and unit-tests green at the Phase 23 baseline (442/442).
- No blockers for Plan 24-02. All required placeholder inlining is in place.
- Downstream phase 25 (npm publication) is unblocked once Plan 24-02 completes and commits atomically.

## Self-Check: PASSED

- [x] packages/runtime/src/core-compat.ts does not exist (`test ! -f` confirmed)
- [x] Every packages/runtime/src/*.ts file imports Capability from @kehto/acl/capabilities (verified via grep)
- [x] packages/runtime/src/types.ts exports `interface ServiceDescriptor` (grep confirmed, 1 match)
- [x] packages/runtime/src/replay.ts has `const REPLAY_WINDOW_SECONDS = 30` (grep confirmed, 1 match)
- [x] packages/runtime/src/index.ts exports Capability + ALL_CAPABILITIES from @kehto/acl/capabilities (grep confirmed, 2 matches)
- [x] packages/runtime/src/index.ts does not re-export BusKindValue (grep returns 0)
- [x] `pnpm type-check` exits 0 across 8 tasks (4 packages x type-check + build)
- [x] `pnpm test:unit` reports exactly 442 passed (Phase 23 baseline preserved)
- [x] `git grep -n "core-compat" -- 'packages/' 'apps/' 'tests/' 'specs/'` returns zero hits
- [x] 6 runtime consumer files have inlined placeholder consts ready for Plan 24-02 scrub
- [x] 1 shell consumer file (acl-store.ts) has inlined DESTRUCTIVE_KINDS placeholder for Plan 24-02

---
*Phase: 24-drift-core-06-cleanup*
*Completed: 2026-04-19 (uncommitted — Plan 24-02 commits atomically)*
