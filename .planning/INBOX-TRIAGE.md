# Open issue audit — 2026-10-15

User-directed audit: evaluate every open issue against current code and protocol
authority. Comment on invalid reports; close fully resolved reports with resolution
references; open a PR with `Resolves #N` for unresolved or partially resolved reports.
This overrides template-only triage. This repository has no issue/PR templates or
CONTRIBUTING.md, so template-completeness scoring does not apply.

Initial snapshot: #304, #302, #301, #300, #293, #292, #280, #271, #257, #237, #187.
Recheck the open list before marking the goal complete.

| Issue | Evaluation | Action |
| --- | --- | --- |
| #304 | Valid; four public reproduction paths fail on main | Fix and eight regressions committed; completing verification and PR |
| #302 | Report read; persistence failure is swallowed on main | Next investigation |
| #301 | Pending | Pending |
| #300 | Pending | Pending |
| #293 | Pending | Pending |
| #292 | Pending | Pending |
| #280 | Pending | Pending |
| #271 | Pending | Pending |
| #257 | Pending | Pending |
| #237 | Pending | Pending |
| #187 | Pending | Pending |

Primary checkout `feat/kernl-rebrand` retains unrelated package.json changes.
Issue #304 worktree: `~/.worktrees/kehto/relay-acl-revocation`.
Protocol refs and verification details are in the matching debug record.
