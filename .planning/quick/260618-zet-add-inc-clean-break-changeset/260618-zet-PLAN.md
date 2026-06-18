---
status: complete
date: 2026-06-18
mode: quick-validated
---

# Quick Task 260618-zet: Add INC Clean-Break Changeset

## Goal

Add the missing release metadata for the merged INC cleanup without touching
runtime code.

## Tasks

1. Confirm merged `main` does not already contain a changeset for the cleanup.
2. Add a changeset for packages whose shipped behavior changed:
   `@kehto/acl`, `@kehto/runtime`, `@kehto/services`, and `@kehto/shell`.
3. Keep the changeset text compatible with the existing forbidden-token guard.

## Verification

- `git ls-files` based scanner excluding `.planning/` reports zero semantic
  forbidden-token matches.
- Changeset file is present under `.changeset/`.
