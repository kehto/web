---
quick_id: 261031-ku0
checked: 2026-10-31
status: passed
blockers: 0
warnings: 3
---

# Plan check: 261031-ku0

## Coverage
Every GOAL.md item is mapped to a task that has an automated verify command and a done criterion: DEL-1..8, HC-1..4, SPEC-1..3 and ACC-1..6 (see the PLAN source coverage audit).

| Gap the planner listed | Fix action |
|---|---|
| no firewall-ask consent test for x- capabilities | Task 1 step 4 (`grep "'ask'"` in verify) |
| no unconfigured spec-gap note at `getShellDomainState` | Task 2 step 4 (sed+grep in verify) |
| no x- section in NIP-5D-CONFORMANCE | Task 2 step 5 (grep `data-kehto-nip5d-extension`) |
| Paja e2e misses `#simulation-status` and `paja.extension.configured` | Task 3 step 3 (greps plus e2e run) |
| no reserved-coverage test | Task 3 step 4 (verify grep added by this check) |
| playground e2e misses ENABLE/DISABLE log entries | Task 4 step 3 (verify grep added by this check) |
| no test that the how-to uses only public exports | Task 6 step 1 (verify grep added by this check) |
| SKILL.md points at `docs/llm.md` | Task 6 step 2 (hosted URL; negative grep added by this check; base `/web/docs/` confirmed in playground-pages.yml) |
| PR body calls the services changeset a patch | Task 7 step 5 (`patch changeset` grep matches the live body text, line 11) |

AGENTS.md: the plan uses an absolute hosted doc link and keeps every changeset minor with none deleted. It adds no new aislop rows or rule disables, opens no new PR, does not force-push, and stages by path.

## Edits made to PLAN.md
- Added these to files_modified: `.changeset/experimental-naps-acl.md`, `packages/acl/src/extensions.ts`, `packages/shell/README.md`, `apps/playground/src/main.ts`. Tasks can touch them, but they were not listed.
- Task 3 verify: grep that the new `PAJA_SIMULATION_DOMAINS` coverage guard exists.
- Task 4 verify: grep for the `ENABLE extension x-echo` assertion.
- Task 6 verify: grep for the how-to public-export test, and a negative grep for `docs/llm.md` in SKILL.md.

## Warnings
1. [scope_sanity] WARNING: one plan has 7 tasks and an estimated 170k tokens (low confidence). The orchestrator and CONTEXT chose this grouping (Claude's discretion), so it is not a blocker. A context reset between Tasks 5 and 6 is advisable.
2. [verify_format] WARNING: Task 2 locates the JSDoc with a fixed line range (`sed -n 90,116p` on shell-init.ts). It breaks if lines shift. A grep anchored on `getShellDomainState` would be sturdier.
3. [verify_format] WARNING: Task 7 runs aislop but does not assert the score or rows in its automated command. The check is manual from `$SCRATCH/aislop.json`. Consider a `node -e` assertion of score >= 95.
