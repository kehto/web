---
status: complete
date: 2026-06-18
mode: quick-validated
commit: TBD
---

# Quick Task 260618-heo Summary: Remove IFC Vocabulary

## Outcome

Removed the old IFC vocabulary from live tracked code, tests, fixture paths, docs,
and package changelogs. The runtime now exposes only the INC handler and `inc.*`
message surface; NAP-IFC fixture/e2e names are now NAP-INC; no compatibility
registration remains for the old domain.

## Changed Areas

- Renamed the runtime handler from `ifc-handler` to `inc-handler` and removed
  legacy domain/type aliases.
- Updated ACL resolution, runtime dispatch, service dispatch, service handlers,
  shell initialization, playground labels, e2e fixtures, and docs to INC naming.
- Renamed `tests/fixtures/napplets/nap-ifc` to `nap-inc` and
  `tests/e2e/nap-ifc.spec.ts` to `nap-inc.spec.ts`.
- Added a unit migration guard that scans tracked files outside `.planning/` and
  fails on future case-insensitive `ifc` occurrences, allowing only lockfile
  integrity hash false positives.
- Stabilized the playground height e2e check by asserting the CSS variable and
  frame-slot CSS binding instead of a transient layout measurement.

## Verification

- `pnpm build` passed as part of `pnpm test:e2e`.
- `pnpm type-check` passed.
- `pnpm test:unit` passed: 70 files, 1061 tests.
- `pnpm test:e2e` passed: 66 tests.
- `pnpm docs:check` passed.
- `pnpm lint` passed with no configured lint tasks.
- `npx aislop scan` exited 0 with 82/100 and only unrelated pre-existing
  warnings in `apps/playground/src/theme-switcher-host.ts`,
  `apps/playground/src/shell-host.ts`, and `apps/playground/vite.config.ts`.
- `git ls-files -z | perl -0ne 'print unless m{^\\.planning/}' | xargs -0 rg -n -i "ifc" -- | rg -v "integrity:"` returned no matches.

## Remaining Risks

- `.planning/` intentionally retains historical IFC references.
- `pnpm-lock.yaml` still contains an unrelated `ifc` substring inside a package
  integrity hash; the guard and final scanner ignore only integrity lines.
