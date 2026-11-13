---
status: planned
base: b5734145
head_before: 945c7289
---

# Resolve PR 424 conflicts

Live merge index contains conflicts in STATE, firewall exports/README/docs and
runtime README/docs. Keep optional temporal package ownership while adding main's
permission-rule exports and defaultDecision documentation. Preserve both task rows.
Inspect automatic merges of permission runtime and Paja adapter to ensure default
rules coexist with explicit operation/prompt limiters. No protocol changes.

Checked napplet/naps master 43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab projection
identity/trust: host policy remains runtime-owned. Resolution is conformant to that
boundary. Validate build/types/unit/docs/slop and browser integration before pushing
merge, then verify GitHub mergeability at the new head. No package release.
