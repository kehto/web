---
id: 260703-pwi
status: complete
description: Resolve PR #138 conflicts with current main
created: 2026-07-03
---

# Quick Task 260703-pwi: Resolve PR #138 Conflicts

## Issue

PR #138 (`fix/paja-nip5d-kinds`) is open but GitHub reports it as conflicting
with current `main`.

## Scope

- Merge current `origin/main` into the PR branch.
- Resolve conflict files without changing the intended PR behavior: Paja must use
  NIP-5D manifest kinds `5129`, `15129`, and `35129`, and continue rejecting
  neighboring NIP-5A nsite kinds.
- Preserve mainline dependency metadata changes and PR #138's resolver changes.
- Push the repaired branch and verify the live PR status.

## Verification

- Focused Paja resolver tests.
- Full unit suite, docs, build, type-check, slop scan, and whitespace check as
  needed after conflict resolution.
- GitHub PR readback after push.
