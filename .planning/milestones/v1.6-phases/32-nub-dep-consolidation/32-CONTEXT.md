# Phase 32: NUB Dep Consolidation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart discuss skipped)

<domain>
## Phase Boundary

Every `@kehto/*` package consumes exactly one `@napplet/nub@^0.2.1` peer/dev dep via subpath imports — the dual-instance pitfall that lands two copies of every NUB module in downstream shells is structurally eliminated, not just renamed.

Scope-in:
- `packages/{acl,runtime,shell,services}/package.json` peer/dev deps
- Every TS import reading from `@napplet/nub-{identity,ifc,keys,media,notify,relay,storage,theme}` in `packages/`, `apps/`, `tests/`
- `pnpm-lock.yaml` post-install state
- 4 `.changeset/v1-6-dep-<pkg>.md` files
- Fresh-install smoke: `pnpm clean && pnpm install && pnpm build && pnpm test:e2e`

Scope-out:
- Any code behavior change — this is a pure rename/consolidation
- `@kehto/wm` (new package, Phase 36) or `@kehto/nip66` (new package, Phase 35) dep declarations
- `@napplet/core` dep version — unchanged at ^0.2.1
- `nostr-tools` peer — unchanged

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices at Claude's discretion — pure infrastructure / dep-migration phase.

Key technical decisions the plan phase should make explicit:
- Subpath form for each domain: `@napplet/nub/identity` (root) vs `@napplet/nub/identity/types` (types-only) vs `/shim` vs `/sdk` — pick per-import based on what the existing `@napplet/nub-<domain>` import was pulling. When uncertain, mirror `@napplet/nub`'s package.json exports map (v0.2.1).
- Changeset bump: **minor** — peer surface changed (per REQUIREMENTS.md DEP-04). Not patch.
- Single-pass migration: one commit per package OR one atomic commit covering all 4. Decide in planning based on whether intermediate states type-check.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@napplet/nub@0.2.1` exports map (reference: `/home/sandwich/Develop/napplet/packages/nub/package.json`) — 10 domains × up to 4 subpaths each (`/<domain>`, `/<domain>/types`, `/<domain>/shim`, `/<domain>/sdk`)
- v1.4 Plan 24-01/24-02 established the "peer-dep rewire + barrel narrow" pattern — same mechanical shape, different package surface
- `.changeset/v1-2-{acl,runtime,shell,services}.md` — templates for per-package changeset prose from the v1.2 NUB domain consolidation

### Established Patterns
- `pnpm.overrides` at workspace root — no overrides needed here (dep is already published)
- `turbo run build` + `pnpm test:e2e` iteration-loop — canonical evidence pattern (v1.3-v1.5)
- No `pnpm.overrides` with `link:` — kehto consumes `@napplet/*` from registry directly

### Integration Points
- `pnpm-workspace.yaml` — unchanged; no new workspace entries
- `packages/*/package.json` peer + dev deps — 4 files touched
- `packages/*/src/**/*.ts` imports — grep target for rewrite
- `apps/demo/*/package.json` — may have split-dep declarations; rewrite if found
- `tests/e2e/**` + `tests/fixtures/**` — may import via test-only split deps; rewrite if found
- `.changeset/*.md` — 4 new files authored

</code_context>

<specifics>
## Specific Ideas

- **Grep audit anchor**: `grep -rn '@napplet/nub-' packages/ apps/ tests/ .changeset/` must return 0 matches post-migration (DEP-02 / DEP-03 success criteria).
- **Dual-instance proof**: after `pnpm install`, `pnpm ls @napplet/nub` across the workspace should show exactly one resolved version; `pnpm ls '@napplet/nub-*'` should return no matches.
- **Baseline preservation**: E2E iteration loop must report **53 passed / 0 failed / 0 skipped** — same as v1.5 close. Any regression is a migration error, not accepted scope.
- **Changeset prose**: cite DEP-01..05 REQ-IDs and issue kehto#4; minor bump rationale: public peer-dep surface changed.

</specifics>

<deferred>
## Deferred Ideas

None — phase scope is the migration. Future phases will consume the consolidated surface.

</deferred>
