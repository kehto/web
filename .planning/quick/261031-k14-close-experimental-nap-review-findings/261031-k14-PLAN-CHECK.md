---
quick_id: 261031-k14
status: issues_found
checked: 2026-10-31
blockers: 1 (fixed in PLAN.md by checker)
warnings: 2
---

# Plan check: 261031-k14

## Coverage

| Finding | Task | files/action/verify/done | Verify concrete |
|---------|------|--------------------------|-----------------|
| IN-01, IN-02, IN-08 | 1 | yes | yes (vitest + type-check + stale-string grep) |
| IN-06, IN-07, IN-09 | 2 | yes | yes (vitest + type-check + grep) |
| IN-03, IN-04, IN-05 | 3 | yes | yes (vitest + build + Chromium playwright) |
| Services README + changeset | 4 | yes | yes (file/grep checks + docs:check) |

There are 4 tasks, one wave and no dependencies. Every finding has a named regression test.

## Blockers

**1. [context_compliance / key_links] The IN-04 fallback depended on the block flag (FIXED in PLAN.md)**
- Plan: 261031-k14-01, Task 3, plus must_haves truth IN-04 and the acl-panel key_link.
- What was wrong: when no decision exists, the plan fell back to `adapter.check(windowId, cap)`. `PlaygroundAccessControls.check` calls `aclState.check` for the real identity, and that returns false for every capability while the identity is blocked. A panel rendered after a reload while blocked would keep stale false x- toggles after unblock. That breaks tests/e2e/playground-usability-controls.spec.ts:144-147 ('8 allowed' / '1 blocked').
- Changes made to the plan:
  - The fallback is now `adapter.defaultCheck(cap)`. This is a new JSDoc'd `DemoAclAdapter` member in apps/playground/src/playground-access-controls.ts. It returns `aclState.check('__kehto-playground-default-policy__', '', '', cap)`, a read-only check against an identity with no entry, which creates no entry and ignores the block flag.
  - The action now says explicitly that `adapter.check` must not be used as the fallback.
  - The must_haves truth, key_link and Decision coverage row are updated. The unit test is renamed and its stub wording is fixed.
  - Task 3 verify now also runs `tests/e2e/playground-usability-controls.spec.ts` and greps that acl-panel.ts uses `adapter.defaultCheck(cap)`.

## Warnings

**1. [claude_md_compliance] The slop gate threshold is below the project target**
- Plan: Task 4. It accepts an aislop score of at least 95 with five pre-existing rows. CLAUDE.md asks for 100/100.
- Fix: keep the threshold, but record in SUMMARY and the PR comment why the five complexity rows are existing debt.

**2. [verification] The IN-04 unit test cannot prove block independence**
- `extensionToggleEnabled` takes a closure, so the unit test only checks how decisions take precedence. Only the e2e run proves block independence, which is why playground-usability-controls.spec.ts was added to verify.

```yaml
issues:
  - plan: "261031-k14-01"
    dimension: context_compliance
    severity: blocker
    task: 3
    description: "IN-04 no-decision fallback used block-gated adapter.check; stale toggles after unblock"
    fix_hint: "Fallback to adapter.defaultCheck(cap) = aclState.check('__kehto-playground-default-policy__','','',cap); run playground-usability-controls.spec.ts (applied)"
  - plan: "261031-k14-01"
    dimension: claude_md_compliance
    severity: warning
    task: 4
    description: "aislop threshold >=95 vs CLAUDE.md target 100"
    fix_hint: "Record the five complexity rows as existing debt in SUMMARY/PR"
  - plan: "261031-k14-01"
    dimension: verification_derivation
    severity: warning
    task: 3
    description: "IN-04 block independence proven only by e2e"
    fix_hint: "Keep usability-controls spec in Task 3 verify (applied)"
```
