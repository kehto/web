---
status: complete
date: 2026-06-18
mode: quick-validated
---

# Quick Task 260618-heo: Remove IFC Vocabulary

## Goal

Clean-break the old IFC vocabulary from every live tracked file. NAP-IFC is now
NAP-INC, the wire domain is `inc`, and there is no backward compatibility path.

## Tasks

1. Rename runtime, fixture, and e2e surfaces from IFC to INC.
   - Files: runtime handler/imports, ACL resolver/tests, services, shell init/capability tests, playground debugger labels, fixtures.
   - Done: code has no `ifc` dispatch keys, message types, variable/function names, filenames, or UI labels outside `.planning/`.

2. Rewrite live docs/changelogs/spec notes from IFC to INC or remove obsolete compatibility prose.
   - Files: package READMEs, changelogs, runtime spec, migration docs, fixture docs.
   - Done: tracked live docs outside `.planning/` contain no case-insensitive `ifc` substring except valid non-semantic false positives.

3. Add a unit guard that scans tracked files for forbidden `ifc` substrings.
   - Files: unit test suite.
   - Done: the new test fails with file/line evidence on any unapproved live occurrence and passes after this cleanup.

## Verification

- `git ls-files` based scanner excluding `.planning/` reports zero semantic `ifc` matches.
- `pnpm build` passed via `pnpm test:e2e`
- `pnpm type-check` passed
- `pnpm test:unit` passed: 70 files, 1061 tests
- `pnpm test:e2e` passed: 66 tests
- `pnpm docs:check` passed
- `pnpm lint` passed with no configured lint tasks
- `npx aislop scan` exited 0 with only unrelated pre-existing playground warnings
- Commit, push `chore/eradicate-ifc`, open PR.
