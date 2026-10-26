---
status: resolved
trigger: "PR 336 cannot run CI because its updated head conflicts with main"
created: 2026-10-19
updated: 2026-10-19
---

## Current Focus

Main 47b2f1c8 integrated in 2ae01123, retaining Firewall approvals and merged upload/intent lifecycle fixes. All six conflicts resolved. Unrelated WINDOWS.md restored with an identical diff hash; the temporary stash was removed.

## Evidence

- GitHub reports CONFLICTING / DIRTY and no checks for 727a6eea. CI listens to pull_request and cannot create a merge commit.
- Main adds upload cancellation/error isolation (#313), intent.changed notifications (#332), controller indicators, active titles, filesystem diagnostics, and release metadata.
- Protocol checked before resolving: NAP-UPLOAD f5cc981e527e2cc1572793a7a6e5082e5271ac49; NAP-INTENT fc121fc264615482143eda86125863d2e1f741a2 and main's authority 19de5ce1cea40cd4c76089cdd8126e9f87648049. Retain terminal invoke failures, catalog/default notifications, exact upload owners, and retired-source suppression. Cancellation exception isolation is host policy; no wire changes.
- Main's FS browser probes needed session approval and explicit optional FS declarations. Without declarations the broad development fallback exhausted bounded prompt admission before FS; missing-OPFS must still load without exposing FS. Fixed the fixture in 2b1ced1e; retained native host-click activation/cancellation assertions. Checked NAP-FS bd1b9e912f05203bf38f7a1b04f920744fe6d625 before changes; development metadata remains host policy.
- Upstream upload tests now wait for the prepared asynchronous upload path and use distinct request IDs. Kept the PR's ownership check that rejects unowned status without backend lookup. Exact-owner teardown isolates cancellation failures and invalidates every source before service-removal cancellation callbacks.

## Verification

Combined build, type-check, 2,637 unit tests / 208 files, docs:check, changeset status, diff checks, and pinned AI-slop 100/100 passed. Focused FS browser suite passed 3/3. Full Node 20.20.2 run using CI settings completed all 141 browser tests: 140 passed, one playground-profile-intent initial-page-load test passed on its second retry. An earlier run had unrelated playground page-load timeouts; neither assertions nor timeouts were weakened. Original firewall isolation regression passed on every post-fix run. Latest log: /tmp/kehto-pr336-merge-e2e-ci.log. Result conformant to checked protocol refs; no new protocol gap.
