---
quick_id: 261104-kmf
status: complete
base_branch: release/host-firewall-controls
---

# Quick Task 261104-kmf: host firewall and dispatch controls

| Issue | PR | Result |
|-------|----|--------|
| #397 | #405 | `ShellAdapter` forwards `getFocusContext`, `onFirewallEvent` and `firewallPersistence` |
| #398 | #406 | `aclDefaultPolicy`; a configured policy replaces the persisted one on load |
| #399 | #407 | `filterNappletMessage` and `releaseDeferred`; `shell.ready` skips the filter per NAP-SHELL |
| #400 | #408 | `setUnfocusedMultiplier` and `setBurstGuard`, refusing a zero multiplier |

The base branch merges into `main` through #404, which carries the closing
keywords for all four issues.

## Execution note

Ran inline in one worktree per issue instead of spawning planner and executor
agents, because each change was small and fully scoped by its issue.

## Verification

All four branches merged together on a scratch checkout:

- `pnpm build`, `pnpm type-check`, `pnpm docs:check`: pass
- `pnpm test:unit`: 2448 passed in 179 files
- `pnpm test:e2e`: 117 passed, 1 skipped
- `aislop@0.12.0`: 93, unchanged from the base, with the same six warnings

`paja-manifest-kinds.spec.ts:71` failed once in a full run on the #399 branch.
It passed 3 of 3 runs alone and in the combined run. The cause wasn't found.
