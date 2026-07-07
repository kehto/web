---
status: complete
completed: 2026-07-07
branch: chore/jsr-score-improvements
---

# Quick Task 260707-l2v Summary

Improved repo-owned JSR score inputs across the Kehto public packages without
changing runtime behavior.

## Changed

- Added missing `@module` docs for exported JSR entrypoints in `@kehto/acl`,
  `@kehto/nip`, `@kehto/paja`, and `@kehto/services`.
- Added public API docs for low-coverage packages: `@kehto/cli`, `@kehto/paja`,
  and `@kehto/wm`.
- Extended `@kehto/paja` docs to exported browser/dev helper modules included
  in its JSR source publish set.
- Removed slow-type diagnostics in `@kehto/nip`, `@kehto/paja`, and
  `@kehto/shell` by adding explicit public types and parameter annotations.
- Exported the new shell singleton interfaces from `@kehto/shell` so TypeDoc
  can resolve public references.
- Fixed stale docs package version rows for `@kehto/cli` `0.2.12` and
  `@kehto/paja` `0.6.4`.
- Added a patch changeset for `@kehto/acl`, `@kehto/cli`, `@kehto/nip`,
  `@kehto/paja`, `@kehto/services`, `@kehto/shell`, and `@kehto/wm`.

## Evidence

- `pnpm build`: passed.
- `pnpm type-check`: passed.
- `pnpm test:unit`: passed, 102 test files and 1299 tests.
- `pnpm docs:check`: passed.
- `pnpm lint`: passed; turbo found no package lint tasks to execute.
- `git diff --check`: passed.
- `npx aislop scan`: passed with exit 0 at 93/100. Remaining warnings are in
  untouched `packages/shell/src/napplet-namespace.ts`.
- JSR dry-runs: passed for `@kehto/acl`, `@kehto/firewall`, `@kehto/nip`,
  `@kehto/paja`, `@kehto/runtime`, `@kehto/services`, `@kehto/shell`, and
  `@kehto/wm`.
- Final `@kehto/paja` JSR dry-run passed after the browser/dev helper module
  doc pass.
- `@kehto/cli` JSR dry-run still fails because live JSR does not yet have
  `@kehto/paja@^0.6.4`.

## Operator Guide

As of 2026-07-07T13:25:27Z, live JSR metadata still reports:

- `@kehto/cli`: latest `0.2.11` while repo version is `0.2.12`.
- `@kehto/paja`: latest `0.6.3` while repo version is `0.6.4`.

Release `@kehto/paja@0.6.4` before `@kehto/cli@0.2.12`; the CLI JSR dry-run
depends on that registry version being visible.

For package-score factors that cannot be changed from this branch, update each
JSR package's settings page:

- Add package descriptions where missing.
- Mark compatible runtimes for browser-oriented packages and Node-compatible
  CLI packages.
- Ensure the GitHub repository link points at `kehto/web`.
- Confirm OIDC provenance appears after publishing from the registered GitHub
  Actions workflow.
