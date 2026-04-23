# Phase 35: WM Skeleton + README Cleanup - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Downstream shells can declare `@kehto/wm` as a dep today and pin the canonical type vocabulary / factory signature — without waiting on a real WM implementation (deferred to v1.7+). Root README's stale `pnpm.overrides link:` consumer story and `@napplet/core not yet on npm` claim are removed; integration example matches what hyprgate v2.0 actually pins.

Scope-in:
- Squash-merge PR #7 (`wm-package-skeleton` branch, in-repo, mergeable: true) into main
- Verify `turbo run build` + `turbo run type-check` green after merge (turbo task count: 23 → 24)
- Edit root `README.md` line 93: remove stale `@napplet/core not yet on npm` / `pnpm.overrides link:` claim; replace with accurate current state (registry install + note the transitive pnpm.overrides pin from Phase 32 Decision: `@napplet/nub>@napplet/core: ^0.2.1`)
- Verify Quick-Integration Example (README lines 30-57) type-checks against current dep graph — it already uses `@kehto/shell`, `@kehto/runtime`, `@kehto/services`; post-v1.2 consolidation surface
- Iteration loop: `pnpm test:e2e` stays at 54/0/0 (no E2E delta; no demo wiring)

Scope-out:
- Freshening "Current milestone: v1.3" line — milestone close (Phase 36 → milestone-complete) updates that
- Full `@kehto/wm` implementation — PR #7 explicitly scopes to skeleton; BSP/master-stack/floating layout primitives are v1.7+
- Demo wiring of `@kehto/wm` — no consumer napplet in kehto-land needs it; hyprgate runs its own local impl
- Changeset for `@kehto/wm@0.0.0` — skeleton is pre-publish (`version: 0.0.0`); no changeset needed until first real version

</domain>

<decisions>
## Implementation Decisions

### Merge Approach (user-locked)

- **Squash merge via `gh pr merge 7 --squash`**: preserves dskvr (PR author) attribution. Single clean commit on main. PR auto-closes. This is the standard pattern for in-repo skeleton PRs from external contributors.
- PR #7 head ref: `wm-package-skeleton`, SHA `f43a48b076be4ff488930d1e71250ecbda46616b`, mergeable.
- After merge: pull main, verify `packages/wm/` present (4 files: `package.json`, `tsconfig.json`, `src/index.ts` 88 lines, `README.md` 35 lines).

### README Scope (user-locked)

- **DOCS-04/05 only** — don't touch the stale "Current milestone: v1.3" line in this phase. Milestone-close will refresh it (Phase 36 → `/gsd:complete-milestone`).
- Specifically rewrite line 93 of `README.md`: replace the `@napplet/core not yet on npm` + `pnpm.overrides link:` architecture-note bullet with accurate current-state prose (registry install is the canonical path; `pnpm.overrides` is now for `@napplet/nub>@napplet/core: ^0.2.1` transitive pin — Phase 32 Decision).

### Claude's Discretion
- Exact replacement prose for line 93 — keep it short (1-2 sentences) to match the surrounding Architecture Notes bullet list density.
- Whether the Quick-Integration Example needs an edit: the example already uses registry-install-compatible imports (`@kehto/shell`, `@kehto/runtime`, `@kehto/services`). If it type-checks against current deps, leave it. If not, rewrite to match hyprgate v2.0's pin pattern (`pnpm add @kehto/runtime @kehto/shell @kehto/services @napplet/nub @napplet/shim nostr-tools`).
- Whether to add a pointer to `@kehto/wm` in the Packages table. It's a skeleton at `0.0.0` — worth mentioning? Probably yes, with a `(draft skeleton — see package README)` suffix. Discretion.
- Whether to add a pointer to `@kehto/nip66` in the Packages table. Phase 34 shipped it at `0.1.0` publish-ready. Same structure as WM mention. Discretion.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **PR #7 content (already reviewed)**: 4 files, 175 additions, 0 deletions. `packages/wm/src/index.ts` is a well-structured skeleton with:
  - Generic types: `WindowId`, `WorkspaceId`, `Rect`, `Layout`
  - `WmHostHooks` interface: `selectLayout`, `onWindowCreated`, `onWindowDestroyed`, `onWindowMoved`
  - `WmService` interface: `window.{create,close,focus,move}`, `workspace.{switch,list}`, `state.get()`, `destroy()`
  - `createWmService({ hooks })` factory — throws with pointer to hyprgate design note
  - JSDoc on every public export
- **PR #7 package.json**: `@kehto/wm@0.0.0`, ESM-only, zero runtime deps, `tsc --noEmit` scripts, `sideEffects: false`, `publishConfig: { access: public }`.
- **Root README current state** (lines 88-93): Architecture Notes section with 4 bullets; line 93 is the stale claim to rewrite.

### Established Patterns
- `gh pr merge N --squash`: squash-merge pattern — used by `@napplet` repo for similar skeleton PRs.
- turbo.json `build` + `type-check` pipeline auto-includes any workspace package with those scripts.
- PR #7 uses `tsc --noEmit` for both `build` and `type-check` — noop build (no dist output, skeleton is src-only). Turbo still invokes both tasks, and they both succeed.

### Integration Points
- `packages/wm/` — new workspace landing via squash merge
- `pnpm-workspace.yaml` — unchanged; `packages/*` glob auto-picks up new pkg
- `turbo.json` — unchanged; existing `build` / `type-check` tasks cover it
- `README.md` line 93 — architecture-note bullet edit

</code_context>

<specifics>
## Specific Ideas

- **Merge command**: `gh pr merge 7 --squash` (dskvr authorship preserved via co-author attribution in the squashed commit, or via default GitHub squash behavior).
- **After merge**: `git pull origin main`, verify `ls packages/wm/` returns 4 files, run `pnpm install` (no dep changes but regenerates lockfile entries for the new workspace), run `pnpm build` expecting 24 turbo tasks (23 baseline + 1 new WM).
- **README line 93 replacement prose** (draft — plan may refine):
  - Remove: `**\`@napplet/core\` is not yet on npm.** Workspace uses \`pnpm.overrides\` \`link:\` entries to \`/home/sandwich/Develop/napplet/*\`. See \`package.json\` for the override map.`
  - Replace with: `**Registry install.** \`@napplet/*\` ships to npm; consume \`@kehto/*\` directly from the registry. Workspace pins one transitive \`pnpm.overrides\` for \`@napplet/nub>@napplet/core: ^0.2.1\` (upstream publish-time workspace-specifier bug; Phase 32 Decision — see \`package.json\`).`
- **Packages table additions** (discretionary — plan phase decides):
  - Add `@kehto/nip66` row: `Standalone kind-30166 relay discovery aggregator (framework-agnostic; v0.1.0).`
  - Add `@kehto/wm` row: `Generic window manager service contract for NIP-5D shells (skeleton at v0.0.0 — see package README).`

</specifics>

<deferred>
## Deferred Ideas

- **@kehto/wm full implementation** (BSP/master-stack/floating layout primitives): explicitly deferred to v1.7+ per PR #7's own scope note. Hyprgate continues to run its local impl at `apps/shell/src/lib/services/wm.ts`.
- **@kehto/wm changeset / first publish**: skeleton is pre-publish (`version: 0.0.0`). First changeset + publish lands with the first real implementation, whenever that milestone starts.
- **Freshening "Current milestone: v1.3" line in README**: milestone-close workflow handles this. Not Phase 35's scope.
- **Quick-Integration Example rewrite**: only needed if the current example fails to type-check against v1.6 dep surface. Plan phase verifies this via a clean-install smoke; if green, no rewrite.

</deferred>
