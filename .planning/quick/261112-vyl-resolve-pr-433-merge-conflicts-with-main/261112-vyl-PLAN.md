---
quick_id: 261112-vyl
title: Resolve PR 433 merge conflicts with main
status: planned
---

Merge origin/main (226b4ad4) into PR #433 without rewriting its history.
Execute inline under gsd-quick; preserve unrelated primary-checkout changes.

1. Resolve the signer test conflict by retaining both the obsolete NIP-07
   property regression and main's signer preference/lifecycle regressions.
   Combine planning records from both branches and use the latest activity.
2. Review automatically merged Paja source/docs and run build, type-check,
   unit, docs, pinned AI-slop and browser gates. Record any existing failures
   without expanding this conflict-resolution task into a separate bug fix.
3. Commit the merge, record completion in STATE.md and this task's summary,
   push the existing PR branch, and confirm GitHub reports no conflicts.

Protocol authority: napplet/naps master at
43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab, naps/NAP-IDENTITY.md,
rechecked via GitHub API before edits. identity.getRelays remains available;
unsupported queries may return empty results. Preserve the PR's conformant
behavior and main's disconnected signer handling; add no protocol changes.

Acceptance: both test sets retained, no conflict markers/unmerged entries,
PR branch includes current main, changeset retained, pushed PR mergeable.
