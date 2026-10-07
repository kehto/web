---
phase: quick-261007-md2
plan: "01"
subsystem: ui
tags: [paja, resource-servers, sidebar, vitest, playwright]
status: complete
requires:
  - phase: quick-261007-jux
    provides: Existing resource server settings and dedicated localStorage persistence
provides:
  - Resource servers immediately below Messages as the final sidebar element in both modes
  - Exact concise helper with preserved accessible controls and Save wiring
affects: [paja]
tech-stack:
  added: []
  patterns: [Shared HTML template, both-mode markup regression]
key-files:
  created: [".planning/quick/261007-md2-move-paja-resource-servers-to-sidebar-bo/261007-md2-RED.json"]
  modified: [packages/paja/src/host-page.ts, packages/paja/src/host-page.test.ts]
key-decisions:
  - Preserve the existing dedicated localStorage implementation; no duplicate persistence.
  - Retain existing changesets for the same unmerged feature.
requirements-completed: []
plan_head_before: a0a81e341e5e90556be1461ddb19334b17143da6
actuals:
  tokens: 909
  tasks: 2
  commits: 2
duration: 6min
completed: 2026-10-07
---

# Quick Task 261007-md2: Resource Servers Sidebar Bottom Summary

**Resource servers now follows Messages at the sidebar bottom, with exactly “Extra Blossom lookup servers, one per line. Domains use HTTPS.”**

## Accomplishments

- Moved the existing shared form intact in target-URL and runtime-pointer modes; changed only its helper literal.
- Both-mode tests require exactly one form, exact helper text, Messages adjacency, final-sidebar placement and existing accessibility/Save/status attributes.
- Preserved existing settings validation, Save listener, persistence, resource lookup, CSS, runtime policy and wire behavior.

## Task Commits

1. Task 1 RED: `9bbaa7b8` — `test(261007-md2): require resource settings at sidebar bottom`
2. Task 1 GREEN: `a27b55b8` — `feat(261007-md2): move resource servers below Messages`
3. Task 2: all gates and summary complete; planning metadata left for the parent workflow to commit. No push or PR action performed by this executor.

Both code commits include agent credit. No refactor needed. Measured commit count is 2 from the persisted plan ledger; realized committed diff is 3,634 characters (909 tokens, rounded upward on chars/4 scale).

## Verification

| Gate | Result | Log under /tmp/opencode/ |
|------|--------|--------------------------|
| Focused RED | Intentional assertion failure on old helper; 1 failed, 4 passed; exit 1 | md2-red.log, md2-red-tap.log |
| RED evidence validator | RED_EVIDENCE_OK; nested Vitest TAP normalized transparently in persisted RED JSON | 261007-md2-RED.json in this directory |
| Focused GREEN and tracer rerun | 5/5 passed in each run | md2-green.log, md2-tracer.log |
| pnpm build | 32/32 tasks successful | md2-build.log |
| pnpm type-check | 17/17 tasks successful | md2-type-check.log |
| pnpm test:unit | 154 files, 1,863 tests passed | md2-unit.log |
| pnpm docs:check | 9 public package docs, routes, TypeDoc targets and docs wiring passed | md2-docs.log |
| Pinned cached aislop scan | 100/100, 0 errors; 2 existing file-size warnings | md2-slop-iteration.log, md2-slop.log |
| Full pnpm test:e2e | 89 passed, 2.4 minutes; exit 0 | md2-e2e.log |
| git diff --check a0a81e34 and working-tree check | Passed | command output |

Full e2e used `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome` with tool timeout disabled. No skipped tests or incomplete verification commands. Existing resource-settings browser tests already scroll as needed; no e2e adaptation was necessary. Desktop/mobile screenshot checks also passed. No additional manual visual sign-off is claimed.

## Existing localStorage Persistence Proof

No persistence source changed. `packages/paja/src/browser-resource-settings.ts` retains the dedicated `kehto:paja:resource-servers` key.

- `browser-resource-settings.test.ts:17–25` saves normalized values, reconstructs settings from the same store and verifies serialized values under that key.
- Lines 52–59 prove clearing removes only that key and restores an empty list, preserving unrelated storage.
- Lines 91–117 prove drafts are not persisted, submit saves, invalid saves preserve prior values and listener disposal prevents later saves.
- Full browser suite passed both resource-settings cases at `tests/e2e/paja-runtime-pointer.spec.ts:280`: storage available and blocked. Lines 327–348 Save via Enter, reject invalid input without losing saved values, reload and restore `https://extra.example`. Lines 358–375 clear extras and reload to an empty textarea. Verified bytes remain live without frame reload; blocked persistence reports session-only behavior.

## Scope, Documentation and Specification References

Committed diff against `a0a81e34` contains only `host-page.ts` and `host-page.test.ts` (13 insertions, 9 deletions). All existing changesets remain intact; no extra changeset, version bump, package install or configuration weakening.

Scoped tracked-document search across root README, Paja README, package docs and local-authoring guide found no exact old helper literal or promised sidebar ordering. Existing normalization/persistence prose remains accurate; wording such as “bare domains use HTTPS” describes unchanged behavior, not a stale quotation. No product-doc update needed.

Carried forward the prior NAP-RESOURCE checks at `napplet/naps@9511232f69313aa7953d110e35d32cc28d506f66` and PR #80 head `fa6bcc6935aa19e7b70ab2a2c721dafca77c78e1`. This presentation-only follow-up does not migrate the packaged wire contract, alter the previously bounded findings, or claim full NAP/browser network conformance.

## Deviations from Plan

None in implementation. Parent workflow owns shipment and planning commits; this executor stays on `feat/paja-local-index-html`, leaves planning artifacts uncommitted and does not change ROADMAP. RED evidence normalization is explicitly recorded because the validator expects node TAP summaries rather than Vitest's nested TAP.

## Known Stubs and Threat Surface

No new stubs, TODOs, skipped tests or new security-relevant surfaces. Existing empty status markup is wired by the unchanged settings controller; it is not a stub. Existing two slop file-size warnings remain out of scope.

## Next Steps

Parent workflow ships through existing PR #278 using these passing gates.

User additionally confirmed public `http://` Blossom entries were desired. The
orchestrator rechecked pinned NAP-RESOURCE `9511232f69313aa7953d110e35d32cc28d506f66`:
each server entry MUST be a public HTTPS origin. HTTP acceptance is not implemented
because it conflicts with that checked contract; upstream specification change is
required. This does not affect the completed sidebar/persistence work.

## Self-Check: PASSED

Verified both modified files, persisted RED evidence and summary exist; both task commits are present in git history. Diff hygiene and existing changeset preservation passed.
