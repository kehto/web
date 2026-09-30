---
status: complete
completed: 2026-06-19
---

# Fix flaky Playwright service activity counters

## Outcome

Completed and shipped. Commit `bfcd7af` changed the Playwright poll to wait until
storage, relay, and identity counters are all at least one while retaining explicit
assertions. The change reached the default branch through merge commit `bdb15b6`
(PR #63); `5a0ae84` recorded the original closeout metadata.

## Verification

The current `tests/e2e/shell-ui-state-surfaces.spec.ts` retains the conjunctive poll
and explicit counter assertions.
