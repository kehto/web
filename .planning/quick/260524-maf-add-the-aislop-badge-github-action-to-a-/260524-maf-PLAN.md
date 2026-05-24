---
quick_id: 260524-maf
slug: add-the-aislop-badge-github-action-to-a-
status: completed
created: 2026-05-24
---

# Quick Task 260524-maf: Add the aislop-badge GitHub Action

## Goal

Add `sandwichfarm/aislop-badge` to GitHub Actions so the primary branch recalculates the badge when source code or scanner-relevant configuration changes.

## Constraints

- Primary branch for `kehto/web` is `main`.
- Stop and file an upstream issue at `sandwichfarm/aislop-badge` if action integration itself has issues.
- Do not use this workflow for pull-request writes.
- Avoid badge commit loops.
- Preserve unrelated dirty files already present in the worktree.

## Tasks

1. Check upstream action contract
   - Files: `sandwichfarm/aislop-badge` action metadata and README
   - Action: confirm action inputs, permissions, and recommended workflow usage
   - Verify: `gh api`/`gh repo view` returns action metadata and README
   - Done: [x]

2. Add source-change badge workflow
   - Files: `.github/workflows/aislop-badge.yml`
   - Action: create a `main` push workflow scoped to source/config paths with manual dispatch and badge commits enabled only on `main`
   - Verify: YAML parses and local `aislop` run succeeds through the selected package runner
   - Done: [x]

3. Record quick-task completion
   - Files: `.planning/quick/260524-maf-add-the-aislop-badge-github-action-to-a-`, `.planning/STATE.md`
   - Action: summarize implementation and update quick-task state
   - Verify: git diff and status show only intended quick-task additions for this task
   - Done: [x]
