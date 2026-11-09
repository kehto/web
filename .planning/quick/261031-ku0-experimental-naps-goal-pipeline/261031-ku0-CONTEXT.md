# Quick Task 261031-ku0: experimental NAPs goal, full pipeline pass - Context

**Gathered:** 2026-10-31
**Status:** Ready for planning
**Mode:** `/gsd:quick --full` over the **entire** goal in GOAL.md (its final prompt block, starting
"Make it possible for downstream developers to build experimental NAPs…"). No interactive questions,
because the goal forbids pausing; its text already locks every decision.

<domain>
## Task Boundary
Every deliverable (1–8), hard constraint, spec-check item and acceptance item in GOAL.md, on branch
`feat/experimental-naps` (PR #363). Earlier tasks 261031-ia2 and 261031-k14 implemented most of it. This pass
plans the whole goal, executes each task by proving or implementing it on the branch (fixing any gap it
finds), and verifies it, in pipeline order.
</domain>

<decisions>
## Implementation Decisions
- Treat GOAL.md as authoritative; the decisions recorded in 261031-ia2-CONTEXT.md and 261031-ia2-PLAN.md
  (x- prefix, `AclEntry.ext` decisions, scoped push, per-binding scripts, Paja `extensions` entries,
  playground demo hooks, skill shipped in the repo and the @kehto/shell tarball) remain locked.
- Each plan task must name concrete verify commands; a task is done only when its evidence is captured.
- The executor commits only real fixes plus the planning artifacts, and comments on PR #363 instead of opening a new PR.

### Claude's Discretion
Task grouping and order.
</decisions>

<canonical_refs>
## Canonical References
- GOAL.md (this directory); napplet/naps master `43cb3a4` (NAP-SHELL, projections/web.md, README registry)
- .planning/quick/261031-ia2-experimental-naps-on-kehto/ and .planning/quick/261031-k14-close-experimental-nap-review-findings/
</canonical_refs>
