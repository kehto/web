---
phase: 22-docs-refresh-release-rehearsal
plan: 1
subsystem: docs
tags: [typedoc, docs, api-reference, tooling]

# Dependency graph
requires:
  - phase: 21-fixture-napplets-layer-a-specs
    provides: Final v1.2 API surface stable (no further protocol changes in v1.3)
provides:
  - typedoc@^0.28 installed at root as devDependency
  - Root typedoc.json with entryPointStrategy "packages" covering all 4 @kehto/* packages
  - pnpm docs:api script generating docs/api/ from package JSDoc
  - docs/api/ gitignored (build artifact, not source)
affects: [22-02 package-readmes, 22-03 root-readme, 22-07 e2e-gate]

# Tech tracking
tech-stack:
  added: [typedoc@0.28.19]
  patterns: [root-typedoc-config, packages-entry-point-strategy, generated-docs-gitignored]

key-files:
  created:
    - typedoc.json
    - .planning/phases/22-docs-refresh-release-rehearsal/22-01-SUMMARY.md
  modified:
    - package.json
    - pnpm-lock.yaml
    - .gitignore

key-decisions:
  - "typedoc installed at workspace root, never per-package, per D-01"
  - "entryPointStrategy: packages reads each workspace package's package.json (main/src/index.ts) — consistent with STACK.md §4c"
  - "readme: none — typedoc is mechanical reference; package READMEs handle human narrative via Plan 22-02 cross-links"
  - "skipErrorChecking: true — typedoc runs against live source; real TS errors caught by pnpm type-check, not here"
  - "docs/api/ gitignored — generated artifact, not source; rebuilt on demand via pnpm docs:api"
  - "Not added to turbo.json — docs:api is a manual dev-time tool, not a pipeline step"

patterns-established:
  - "Root-only docs tooling: devDep + config live at workspace root, never duplicated per package"
  - "Generated-docs-gitignored: docs/api/ is a build artifact regenerated on demand, not committed source"
  - "Packages entry-point strategy: typedoc treats each packages/* entry as an independent package with its own JSDoc scope"

requirements-completed: [DOCS-01]

# Metrics
duration: 2min
completed: 2026-04-18
---

# Phase 22 Plan 1: Typedoc Infrastructure Summary

**Installed typedoc@0.28.19 at root with packages entry-point strategy; `pnpm docs:api` emits `docs/api/` for all 4 @kehto/* packages in under 3 seconds.**

## Performance

- **Duration:** ~2 min (97 seconds)
- **Started:** 2026-04-18T11:25:20Z
- **Completed:** 2026-04-18T11:26:57Z
- **Tasks:** 2
- **Files modified:** 3 (package.json, pnpm-lock.yaml, .gitignore)
- **Files created:** 1 (typedoc.json)

## Accomplishments

- typedoc@0.28.19 added as root-only devDependency (no per-package installs)
- `typedoc.json` at repo root with `entryPointStrategy: "packages"` covering packages/{acl,runtime,shell,services}
- `docs:api` script wired into root `package.json` — zero-arg typedoc invocation reads root config
- `docs/api/` added to `.gitignore` so generated output never pollutes git history
- Smoke-run confirmed clean generation: 4 packages converted, 0 errors, 1 minor warning, ~3s wall time
- `docs/api/index.html` + `docs/api/modules/_kehto_{acl,runtime,shell,services}.html` emitted

## Task Commits

Each task was committed atomically:

1. **Task 1: Install typedoc + create typedoc.json** — `8a59bf0` (chore)
2. **Task 2: Add docs:api script + gitignore docs/api + smoke-run typedoc** — `3634333` (chore)

## Files Created/Modified

- `typedoc.json` (created) — Root typedoc config: entryPointStrategy=packages, out=docs/api, readme=none, includeVersion, hideGenerator, skipErrorChecking, excludes tests/dist/node_modules
- `package.json` (modified) — Added `typedoc@^0.28` devDep and `"docs:api": "typedoc"` script (placed alphabetically after `build`)
- `pnpm-lock.yaml` (modified) — typedoc + 23 transitive deps resolved; 1 removed for dedupe
- `.gitignore` (modified) — Appended `docs/api/` (generated build artifact)

## Typedoc Configuration

The exact shape of `typedoc.json`:

```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPointStrategy": "packages",
  "entryPoints": [
    "packages/acl",
    "packages/runtime",
    "packages/shell",
    "packages/services"
  ],
  "out": "docs/api",
  "exclude": ["**/*.test.ts", "**/dist/**", "**/node_modules/**"],
  "readme": "none",
  "includeVersion": true,
  "hideGenerator": true,
  "skipErrorChecking": true
}
```

## Smoke-Run Output

```
[info] Converting project at ./packages/acl
[info] Converting project at ./packages/runtime
[info] Converting project at ./packages/shell
[warning] PendingUpdate, defined in @kehto/shell/src/session-registry.ts,
          is referenced by nappKeyRegistry.__type.getPendingUpdate but not
          included in the documentation
[info] Converting project at ./packages/services
[info] Merging converted projects
[info] html generated at ./docs/api
[warning] Found 0 errors and 1 warnings

real    0m2.987s
```

**Generated artifacts under `docs/api/`:**
- `index.html` (landing page — references all 4 @kehto/* packages by name)
- `modules/_kehto_acl.html`
- `modules/_kehto_runtime.html`
- `modules/_kehto_shell.html`
- `modules/_kehto_services.html`
- `functions/`, `interfaces/`, `types/`, `variables/`, `assets/`, `hierarchy.html`

**Warning noted for Plan 22-02:** `@kehto/shell/src/session-registry.ts` — `PendingUpdate` type is referenced by `nappKeyRegistry.__type.getPendingUpdate` but not exported/included. Plan 22-02 should decide whether to export `PendingUpdate` from the shell package index or restructure the internal reference so typedoc doesn't surface it. This is documentation-surface only — no runtime impact. All four packages otherwise emit cleanly.

## Decisions Made

Followed D-01 (DOCS-01) verbatim:
- Root-only devDep (no per-package typedoc installs)
- `entryPointStrategy: "packages"` — each `entryPoints` element resolved as workspace package via its package.json
- `readme: "none"` — typedoc is the mechanical reference; package READMEs (Plan 22-02) provide human narrative and cross-link to the generated API
- `skipErrorChecking: true` — typedoc reads live source; `pnpm type-check` remains the authoritative TS gate
- `docs/api/` gitignored — rebuilt on demand, never committed
- Not wired into `turbo.json` — manual dev-time tool per STACK.md §4c

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Single typedoc warning about `PendingUpdate` in `@kehto/shell/src/session-registry.ts` being referenced but not documented. Acceptable per plan notes ("warnings about missing JSDoc on specific symbols are acceptable; Plan 22-02 addresses JSDoc coverage"). Logged above for Plan 22-02 follow-up.
- Unrelated peer-dependency warning from `pnpm add` about `oxc-parser` missing `@emnapi/core`/`@emnapi/runtime` — pre-existing, touches `apps/demo` through unocss transitive chain, completely unrelated to typedoc install. Out of scope per deviation-rules scope boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 22-02 (package READMEs)** unblocked: can now reference `docs/api/_kehto_<pkg>.html` links confidently; typedoc output schema is locked.
- **Plan 22-02 also inherits:** the single `PendingUpdate` visibility warning to resolve (either export it from `@kehto/shell` index or hide the internal reference).
- **Plan 22-03 (root README)** unblocked: can link to the typedoc-generated API reference.
- No blockers for downstream release plans (22-04 through 22-07).

## Self-Check: PASSED

- `typedoc.json` exists at repo root — verified.
- `package.json` contains `"typedoc": "^0.28"` in devDependencies and `"docs:api": "typedoc"` in scripts — verified.
- `.gitignore` contains `docs/api/` — verified.
- `docs/api/index.html` exists after smoke-run — verified.
- All 4 @kehto/* packages referenced in `docs/api/index.html` (acl, runtime, shell, services) — verified.
- `docs/api/` not present in `git status --porcelain` output — properly gitignored.
- Commit `8a59bf0` (Task 1) present in `git log` — verified.
- Commit `3634333` (Task 2) present in `git log` — verified.

---
*Phase: 22-docs-refresh-release-rehearsal*
*Completed: 2026-04-18*
