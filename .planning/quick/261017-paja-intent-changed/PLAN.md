# /gsd:quick — Paja intent availability notifications

Inline GSD quick workflow: no installed GSD command/tool is available.

## Orientation and authority

Base: origin/main 0958a8b1. Primary checkout has unrelated .gitignore,
.nsite/, and nsyte-logs changes; leave them untouched. Work in this repository's
.worktrees/paja-intent-changed on fix/paja-intent-changed.

Checked napplet/naps master 19de5ce1cea40cd4c76089cdd8126e9f87648049,
naps/NAP-INTENT.md (last touched e5308ac92cfd49e4fb026812c60886571515e219;
SHA-256 1063765132336e8f922bfb5c2a83c7daf9d131ca8db9875d9e1f3cda559d70a6).
No-handler is a terminal pre-acceptance rejection. Catalog/default changes SHOULD
emit intent.changed, using archetype slugs and current availability. No wire change
or automatic retry is needed; verified catalog eligibility remains authoritative.

## Plan

1. Carry deduplicated old/new archetypes through catalog notifications, preserving
   the existing catalog-ID argument for invalidation/persistence consumers.
2. Bind catalog notifications to the adapter's real intent-service lifecycle;
   notify on host default changes too. Preserve eligibility filtering and cleanup.
3. Add regressions for failed invoke then installation and explicit retry,
   replacements/removals, defaults, lifecycle and filtered candidates. Add a browser
   regression for an already-open source. Synchronize package docs and changeset.
4. Run focused and full build/types/units/docs/slop/browser checks. Commit explicit
   paths, push, open PR with specification authority and verification details.
