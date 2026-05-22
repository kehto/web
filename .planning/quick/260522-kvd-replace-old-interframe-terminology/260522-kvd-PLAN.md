---
quick_id: 260522-kvd
status: in_progress
date: 2026-05-22
---

# Quick Task 260522-kvd: Remove old inter-frame terminology

## Goal

Replace active project-facing old inter-frame terminology with `ifc`/`IFC`, especially in the playground debugger and tests. Do not spend this task rewriting archived milestone history.

## Tasks

1. Update playground protocol path labels, ACL copy, system messages, and E2E assertions from the old acronym to `ifc`.
2. Update active source comments and live docs/readmes so developer-facing text no longer teaches the old acronym.
3. Verify with a scoped active-surface grep plus the relevant type/test commands.
