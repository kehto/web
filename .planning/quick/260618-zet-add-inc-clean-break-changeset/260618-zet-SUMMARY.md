---
status: complete
date: 2026-06-18
mode: quick-validated
commit: c9c148a
---

# Quick Task 260618-zet Summary: Add INC Clean-Break Changeset

## Outcome

Added the missing changeset for the merged INC clean-break cleanup. The release
metadata bumps `@kehto/acl`, `@kehto/runtime`, `@kehto/services`, and
`@kehto/shell` as minor releases because the cleanup removed legacy protocol
behavior in 0.x packages.

## Verification

- Confirmed no cleanup changeset existed on updated `main`.
- Added `.changeset/inc-clean-break.md`.
- Final forbidden-token scanner passed outside `.planning/`.
