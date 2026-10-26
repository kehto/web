---
status: resolved
trigger: "merged 309, https://github.com/kehto/web/actions/runs/38952091537 is failing."
created: 2026-10-16
updated: 2026-10-16
---

# AI Slop badge publication

## Symptoms

Expected: the main-branch scan updates the README score successfully.
Actual: run 38952091537 calculated 95/100, then failed to push its badge commit.
Error: GH013, changes to main must be made through a pull request.
Reproduction: main push at c3a19015fb705569eb1ca7fe297bf5a535bb3214 after PR #309.

## Current Focus

hypothesis: the badge action's direct source-branch push conflicts with branch protection.
next_action: open the PR; main's first run after merge creates the badges branch.

## Evidence

- The failed run completed the scan and created a badge commit before GitHub rejected the push.
- Both active repository rulesets apply to the default branch and require PRs.
- The README currently consumes JSON from main; the action enables commit-badge on main.
- The primary checkout's package.json workspace edit predates this task and is documented as unrelated WIP. This fix uses a fresh origin/main worktree.

## Resolution

Publish generated JSON to the dedicated badges branch using the branch-publishing action; disable the scanner's own commit/push. Only main runs may publish. Update the README endpoint. No package output or NAP surface changes.

Verification: actionlint passed; pnpm build, pnpm type-check, pnpm test:unit (2,168 tests), and pnpm docs:check passed. Changed-file aislop 0.12.0 scored 100/100 with zero diagnostics; git diff --check passed. The scan used an already installed 0.12.0 CLI after pnpm dlx encountered local EBADF download errors. Publication itself requires the fixed workflow to land on main; the historic failed run cannot be repaired by rerunning its old workflow.
