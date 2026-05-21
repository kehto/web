---
id: SEED-001
status: resolved
planted: 2026-04-23
planted_during: v1.6 Phase 32 (NUB Dep Consolidation)
trigger_when: Next @napplet/nub version bump on kehto (0.2.1 → 0.2.x or 0.3.x)
scope: small
resolved: 2026-05-21
resolved_during: v1.8 Phase 44 (Upstream Consumption + Validator Parity)
---

# SEED-001: File upstream issue — `@napplet/nub@0.2.1` ships unresolved `workspace:*` for `@napplet/core`

## Resolution

Resolved during v1.8 Phase 44. Upstream `@napplet/nub@0.3.0` publishes with `@napplet/core@^0.3.0` instead of the unresolved `workspace:*` edge, so kehto removed the root `pnpm.overrides @napplet/nub>@napplet/core` workaround and re-resolved the lockfile successfully.

Evidence:

- `.planning/phases/44-upstream-consumption-validator-parity/44-01-SUMMARY.md`
- `.planning/phases/44-upstream-consumption-validator-parity/44-VERIFICATION.md`
- Root `package.json` no longer contains the override.
- `pnpm install`, `pnpm build`, `pnpm test:unit`, and `pnpm test:e2e` passed after the dependency swap.

## Why This Matters

During Phase 32 NUB dep consolidation, Plan 32-01 migrated `@kehto/*` from 8 split `@napplet/nub-*` peers to the consolidated `@napplet/nub@0.2.1` subpath package. The iteration loop failed because `@napplet/nub@0.2.1` was **published** with `"@napplet/core": "workspace:*"` unresolved in its `package.json` — pnpm's `publishConfig` workspace-specifier rewrite didn't fire at publish time. Result: downstream consumers get a dependency edge they can't resolve from the npm registry.

**Workaround in kehto (Rule 3 auto-fix, committed at `bb1061e`):** added `pnpm.overrides` in `/home/sandwich/Develop/kehto/package.json`:

```json
"pnpm": {
  "overrides": {
    "@napplet/nub>@napplet/core": "^0.2.1"
  }
}
```

This mirrors the Decision #11 pattern (v1.3 `pnpm.overrides` for `@napplet/core` dedup) and is documented in all 4 `.changeset/v1-6-dep-*.md` files as a downstream-consumer advisory.

**Why upstream matters:** every consumer of `@napplet/nub@0.2.1` hits this. Kehto worked around it; hyprgate will have to do the same; every new NIP-5D shell will re-discover the same bug. Upstream fix is one `publishConfig` tweak in `packages/nub/package.json` of the napplet monorepo (or equivalent build step that rewrites `workspace:*` → `^X.Y.Z` before publish).

**Why a seed, not an issue right now:** The user deferred filing until the next kehto NUB version bump — if upstream has already fixed it by then, the seed self-retires; if not, the seed surfaces with fresh context and the issue gets filed with empirical evidence from two repos.

## When to Surface

**Trigger:** Next `@napplet/nub` version bump on kehto (0.2.1 → 0.2.2 or 0.3.0+).

This seed should be presented during `/gsd:new-milestone` or `/gsd:plan-phase` when the scope matches any of these conditions:
- Roadmap phase mentions `@napplet/nub` version bump / dep update
- CONTEXT.md references consuming a newer napplet release
- User invokes dep-update workflow on `@napplet/*` packages
- A downstream (hyprgate or other NIP-5D shell) reports the same packaging bug

**On surface, the action is trivial:**
1. Verify whether upstream fixed it (`npm view @napplet/nub@latest dependencies."@napplet/core"` should return `^0.2.1` or newer, NOT `workspace:*`).
2. If fixed → remove `pnpm.overrides` from `package.json`, delete the advisory paragraphs from future changesets, close this seed as superseded.
3. If still broken → file one upstream issue at `napplet/napplet` (or `napplet/nubs` if that repo gains issue-enable by then) with:
   - Repro: `npm view @napplet/nub@X.Y.Z dependencies`
   - Expected: semver range; Actual: `workspace:*`
   - Reference: this seed + kehto commit `bb1061e` (Phase 32-01)
   - Suggested fix: pnpm `publishConfig` rewrite or tsup build-step that resolves the workspace specifier

## Scope Estimate

**Small** — a few minutes.

File one upstream issue with exact repro + link to kehto's workaround commit. If the upstream maintainer ships a fix, remove the override in a single commit. If the upstream decision is "won't fix" / intentional, document that and promote the override to a permanent architectural decision in PROJECT.md Key Decisions.

## Breadcrumbs

- `/home/sandwich/Develop/kehto/package.json:28-33` — live `pnpm.overrides` block
- `/home/sandwich/Develop/kehto/pnpm-lock.yaml:7-8` — lockfile override recording
- `/home/sandwich/Develop/kehto/.changeset/v1-6-dep-acl.md:9-17` — consumer advisory prose (same prose in runtime/shell/services changesets)
- `/home/sandwich/Develop/kehto/.planning/phases/32-nub-dep-consolidation/32-01-SUMMARY.md:13,19` — Rule 3 auto-fix documentation + Decision #11 pattern extension note
- Commit `bb1061e` — "feat(32-01): consolidate @kehto/* NUB peer deps onto @napplet/nub subpaths (DEP-01..03)" — the atomic migration that introduced the override
- `/home/sandwich/Develop/napplet/packages/nub/package.json` — upstream source of the bug (check whether `"@napplet/core": "workspace:*"` has been corrected)
- Related upstream tracking: previously-filed `napplet/napplet#3` — receive-side NIP-44 decrypt NUB design (unrelated capability; confirms `napplet/napplet` is the correct issue home since `napplet/nubs` has issues disabled)

## Notes

**Connection to Decision #11 (PROJECT.md):** The `@napplet/core` dedup pattern was established at v1.3 via a different `pnpm.overrides` entry (`@napplet/core: link:` at the time). The current Phase 32 override extends the same mechanism to a new edge — transitive-version pinning rather than link-mode forcing. Both entries coexist cleanly; the seed only affects the `@napplet/nub>@napplet/core` edge.

**Hyprgate relevance:** hyprgate#4 (the dep-consolidation issue hyprgate filed) — hyprgate will hit the same packaging bug when they ship v2.0. Worth preemptively mentioning in the upstream issue to strengthen the case ("two downstream repos now require this override").

**On filing now vs. filing at trigger:** The user's call. Filing at trigger avoids duplicate issues if upstream fixes it in the meantime, and gives fresh repro evidence if the bug persists. Filing now surfaces the problem to the maintainer earlier but costs a little context if the bug self-resolves before anyone reads the issue.
