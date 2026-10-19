---
status: fixing
trigger: "PR 336 cannot run CI because its updated head conflicts with main"
created: 2026-10-19
updated: 2026-10-19
---

## Current Focus

Integrate main 47b2f1c8 without losing Firewall approvals or merged upload and intent lifecycle fixes. Six conflicted files; preserve unrelated WINDOWS.md through a path-specific stash and restore it after merging.

## Evidence

- GitHub reports CONFLICTING / DIRTY and no checks for 727a6eea. CI listens to pull_request and cannot create a merge commit.
- Main adds upload cancellation/error isolation (#313), intent.changed notifications (#332), controller indicators, active titles, filesystem diagnostics, and release metadata.
- Protocol checked before resolving: NAP-UPLOAD f5cc981e527e2cc1572793a7a6e5082e5271ac49; NAP-INTENT fc121fc264615482143eda86125863d2e1f741a2 and main's authority 19de5ce1cea40cd4c76089cdd8126e9f87648049. Retain terminal invoke failures, catalog/default notifications, exact upload owners, and retired-source suppression. Cancellation exception isolation is host policy; no wire changes.

## Verification

Pending combined build, types, units, browser, docs, quality gates.
