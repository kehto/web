---
status: in_progress
created: 2026-07-03T22:37:15.303Z
quick_id: 260704-0v1
---

# Quick Task: Release Preflight Instructions

## Goal

Update `AGENTS.md` so release work explicitly checks test and docs gates before
tagging or dispatching `release.yml`.

## Scope

- Document the pre-release verification sequence in the Releases section.
- Call out stale docs package version rows as a required Version Packages PR
  preflight because that failure has repeatedly blocked `publish.yml`.
- Keep the change policy-only; no workflow or package metadata changes.

## Verification

- `git diff --check`
- `pnpm docs:check`
- PR CI readback after pushing
