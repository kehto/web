---
phase: 11-nub-peer-deps-type-imports
plan: 01
subsystem: infra
tags: [pnpm, peer-dependencies, monorepo, workspace-linking, napplet, nubs]

# Dependency graph
requires:
  - phase: 10-spec-conformance-audit
    provides: DRIFT-CORE-03 and DRIFT-CORE-04 drift IDs identifying the peer-dep bump + nub-declaration gaps
provides:
  - "Root pnpm.overrides mapping all 8 @napplet/nub-* packages to napplet-workspace source directories"
  - "Peer-dep declarations for @napplet/core@^0.2.0 + 8 nubs@^0.2.0 on all 4 @kehto/* packages"
  - "Clean pnpm install resolving all nub peer-deps via link: overrides"
  - "Baseline for Plan 11-02 (import type migration) — real nub packages now resolvable in source"
affects: [11-02, 12-shell-conformance-seven-nub-coverage, 13-theme-nub-implementation, 15-milestone-validation-release-prep]

# Tech tracking
tech-stack:
  added:
    - "@napplet/nub-identity@^0.2.0 (peer dep)"
    - "@napplet/nub-ifc@^0.2.0 (peer dep)"
    - "@napplet/nub-keys@^0.2.0 (peer dep)"
    - "@napplet/nub-media@^0.2.0 (peer dep)"
    - "@napplet/nub-notify@^0.2.0 (peer dep)"
    - "@napplet/nub-relay@^0.2.0 (peer dep)"
    - "@napplet/nub-storage@^0.2.0 (peer dep)"
    - "@napplet/nub-theme@^0.2.0 (peer dep)"
  patterns:
    - "Uniform peer-dep rule: all 4 @kehto/* packages declare all 8 nubs, even if each only imports a subset. Cheap to reason about; nubs are types-only so install footprint is zero."
    - "link:/absolute/path overrides for every @napplet/* workspace package — consistent with pre-existing @napplet/core pattern until npm publish milestone"

key-files:
  created: []
  modified:
    - "package.json (root): 8 new nub link: entries in pnpm.overrides"
    - "packages/acl/package.json: NEW peerDependencies block (core + 8 nubs)"
    - "packages/runtime/package.json: peerDependencies bumped, 8 nubs added"
    - "packages/shell/package.json: peerDependencies bumped, 8 nubs added before nostr-tools"
    - "packages/services/package.json: peerDependencies bumped, 8 nubs added"
    - "pnpm-lock.yaml: +108 lines (8 top-level link specifiers + per-consumer edges)"

key-decisions:
  - "Uniform peer-dep rule: all 4 @kehto/* packages declare all 8 nubs (D-01 from 11-CONTEXT.md)"
  - "@kehto/acl preserved zero-runtime-dep posture via empty dependencies block — nubs are types-only peers"
  - "Per-workspace symlinks (packages/*/node_modules/@napplet/nub-*) are the correct pnpm layout for a workspace consumer, not root-level; lockfile is the authoritative resolution record (40 nub entries)"

patterns-established:
  - "Peer-dep declaration order: @napplet/core first, 8 nubs alphabetically, runtime-deps last (e.g., nostr-tools in shell)"
  - "Every workspace-link override in pnpm.overrides uses absolute path — portability to npm: ranges is a future migration (Phase 15+)"

requirements-completed: [DEPS-01, NUB-01]

# Metrics
duration: 3min
completed: 2026-04-17
---

# Phase 11 Plan 1: Nub Peer Deps Declaration Summary

**Declared `@napplet/core@^0.2.0` + 8 `@napplet/nub-*@^0.2.0` peer-deps on all 4 @kehto/* packages and wired 8 new link: overrides in root pnpm config so `pnpm install` resolves every nub to its napplet-workspace source.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-17T13:58:52Z
- **Completed:** 2026-04-17T14:01:48Z
- **Tasks:** 3
- **Files modified:** 6 (1 root package.json + 4 @kehto/* package.json + pnpm-lock.yaml)

## Accomplishments
- Root `package.json` `pnpm.overrides` now maps every `@napplet/nub-*` package to its absolute workspace path at `/home/sandwich/Develop/napplet/packages/nubs/<domain>`
- All 4 `@kehto/*` packages declare the uniform peer-dep set: `@napplet/core@^0.2.0` + 8 `@napplet/nub-*@^0.2.0` (plus preserved `nostr-tools` on shell)
- `@kehto/acl` gained its first-ever `peerDependencies` block while keeping `"dependencies": {}` — zero-runtime-dep posture intact (D-05 in 11-CONTEXT.md)
- Clean `pnpm install` resolves all 8 nubs via `link:` overrides; 32 per-package symlinks created (8 nubs × 4 packages); ESM import test confirms 94 named nub exports are available to runtime consumer
- DRIFT-CORE-03 and DRIFT-CORE-04 from `docs/v1.2-NIP-5D-AUDIT.md` are unblocked (closeable after Phase 15 audit refresh)

## Task Commits

1. **Task 1: Add 8 nub link: overrides to root package.json pnpm.overrides** - `8cdf60e` (chore)
2. **Task 2: Declare peerDependencies on all 4 @kehto/* packages (core bump + 8 nubs)** - `61ce967` (chore)
3. **Task 3: Run pnpm install and verify clean resolution against new peer-dep set** - `afa85c0` (chore)

**Plan metadata:** committed separately after STATE/ROADMAP/REQUIREMENTS updates.

## Files Created/Modified
- `package.json` — 8 new `@napplet/nub-*` link: entries in pnpm.overrides (existing core/shim/sdk/vite-plugin preserved verbatim)
- `packages/acl/package.json` — NEW peerDependencies block: `@napplet/core@^0.2.0` + 8 nubs@^0.2.0; `dependencies: {}` preserved
- `packages/runtime/package.json` — peerDependencies: `@napplet/core` bumped `>=0.1.0` → `^0.2.0`, 8 nubs added
- `packages/shell/package.json` — peerDependencies: `@napplet/core` bumped, 8 nubs inserted before `nostr-tools: >=2.23.3 <3.0.0` (preserved)
- `packages/services/package.json` — peerDependencies: `@napplet/core` bumped, 8 nubs added
- `pnpm-lock.yaml` — +108 lines, all additive; 8 top-level `link:/home/sandwich/Develop/napplet/packages/nubs/<domain>` specifiers + per-consumer edges for acl/runtime/shell/services

## Decisions Made
- **Uniform peer-dep rule applied across all 4 packages** — even acl (which only imports a handful of nub types) declares all 8, matching the D-01 rationale from 11-CONTEXT.md: "a uniform rule is cheaper to reason about than per-package subsets."
- **acl kept its zero-runtime-dep posture** — `"dependencies": {}` unchanged; nub peer-deps are strictly `import type`-only consumption in Plan 11-02, so the constraint survives (D-05).
- **Peer-dep key order** — `@napplet/core` first, then 8 nubs alphabetically, runtime peers (e.g., `nostr-tools`) last in shell. Establishes a convention for future peer additions.
- **Absolute-path `link:` overrides retained** — matches pre-existing `@napplet/core` style. Normalizing to `workspace:*` or npm semver ranges is deferred to Phase 15+ release-prep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected verification expectation: per-workspace symlinks instead of root-level**
- **Found during:** Task 3 (pnpm install verification)
- **Issue:** The PLAN's automated verify step tested `test -L node_modules/@napplet/nub-*` at the repo root, but pnpm correctly installs peer-dep symlinks at each consumer's `packages/<pkg>/node_modules/@napplet/` (not the root, because the root package.json doesn't declare these as its own deps). This is standard pnpm workspace behavior — the root only hoists what's needed for root devDependencies.
- **Fix:** Re-ran verification at the correct location. Confirmed all 32 expected per-package symlinks exist (8 nubs × 4 @kehto/* packages) plus lockfile has 40 nub entries plus ESM dynamic `import('@napplet/nub-*')` from runtime consumer succeeds for all 8 nubs (94 named exports total).
- **Files modified:** None — pnpm resolution was correct as-is; only the verify command needed adjustment.
- **Verification:** `for pkg in acl runtime shell services; do for d in identity ifc keys media notify relay storage theme; do test -L "packages/$pkg/node_modules/@napplet/nub-$d"; done; done` exits 0. ESM `import('@napplet/nub-*')` check from `packages/runtime/` prints `OK: @napplet/nub-<domain> (N named exports)` for all 8.
- **Committed in:** `afa85c0` (Task 3 commit) — commit message documents the per-package resolution layout.

---

**Total deviations:** 1 auto-fixed (1 bug in plan's verify command)
**Impact on plan:** Zero impact on outcome — pnpm resolution is correct; only the plan's automated verify path was wrong (it checked the wrong directory). Future plans referencing this resolution model should look at `packages/*/node_modules/@napplet/` not `node_modules/@napplet/` at the root.

## Issues Encountered

None encountered during planned work. Pre-existing `@emnapi/core` and `@emnapi/runtime` unmet-peer warnings from `apps/demo → unocss → @unocss/transformer-attributify-jsx → oxc-parser → @oxc-parser/binding-wasm32-wasi → @napi-rs/wasm-runtime` appeared in the install log — these are transitive through `apps/demo` and are not @napplet/*-related. They were present before this plan and are out of scope; track in Phase 15 if they need to be silenced before a release.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready for Plan 11-02** (type-import migration): All 8 nub packages are now resolvable via `import type { ... } from '@napplet/nub-<domain>'` from any @kehto/* source file. The ESM import check in Task 3 confirmed named exports are available (21 from nub-identity, 7 from nub-ifc, 10 from nub-keys, 17 from nub-media, 21 from nub-notify, 10 from nub-relay, 7 from nub-storage, 1 from nub-theme).
- **Prerequisite confirmed for Phase 12** (shell conformance): handler work that needs real nub types now has them.
- **No blockers or concerns.** DRIFT-CORE-03 and DRIFT-CORE-04 closeable; Phase 15 audit refresh will formally tick them off.

## Self-Check: PASSED

- `package.json` pnpm.overrides contains all 8 `@napplet/nub-*` link: entries — verified with `node -e` check (see Task 1 commit `8cdf60e`).
- All 4 @kehto/* `package.json` files declare `@napplet/core@^0.2.0` + 8 nubs@^0.2.0 — verified with batch `node -e` check (see Task 2 commit `61ce967`).
- `pnpm-lock.yaml` has 40 nub entries — verified with `grep -c 'napplet/nub-' pnpm-lock.yaml` (see Task 3 commit `afa85c0`).
- All 32 per-package nub symlinks exist — verified with batch `test -L` loop.
- No `">=0.1.0"` remnant on `@napplet/core` anywhere in `packages/*` — verified with Grep.
- All 5 commits visible in `git log --oneline` for branch main.

---
*Phase: 11-nub-peer-deps-type-imports*
*Completed: 2026-04-17*
