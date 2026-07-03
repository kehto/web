---
status: complete
completed: 2026-07-03T22:45:00Z
quick_id: 260704-0v1
---

# Summary

Updated `AGENTS.md` release instructions to require a target-SHA test/docs
preflight before pushing release tags or manually dispatching `release.yml`.

## Changed

- Added a Version Packages PR preflight requiring matching `docs/packages/*.md`
  version rows and `pnpm docs:check`.
- Added a release preflight requiring the actual target `main` SHA to have a
  successful GitHub CI run, or local fallback gates plus CI repair before
  releasing.
- Explicitly blocked tagging or release dispatch when CI/docs/Pages/Publish
  prerequisite state is failed, pending, stale, or unexpectedly skipped.

## Verification

- `git diff --check`
- `pnpm docs:check`
