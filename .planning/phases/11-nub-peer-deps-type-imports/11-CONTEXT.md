# Phase 11: Nub Peer Deps & Type Imports - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase migrates kehto onto napplet's new package graph:

1. Bumps the `@napplet/core` peer-dep range from `>=0.1.0` to `^0.2.0` on every `@kehto/*` package.
2. Adds `@napplet/nub-ifc`, `@napplet/nub-relay`, `@napplet/nub-signer`, `@napplet/nub-storage`, and `@napplet/nub-theme` as peer dependencies at the `^0.2.0` range.
3. Replaces every hand-copied NUB message type and constant in kehto source with direct `import type` statements from the matching `@napplet/nub-*` package.
4. Ensures `pnpm build` and `pnpm type-check` succeed on a clean install against the new peer-dep set.

No handler behavior changes in this phase — message dispatch wiring and ACL extension are deferred to Phase 12; theme domain work is Phase 13.

</domain>

<decisions>
## Implementation Decisions

### Peer Dep Strategy
- Version range for all five `@napplet/nub-*` packages: `^0.2.0` — mirrors the `@napplet/core` range and semver posture.
- All four `@kehto/*` packages (acl, runtime, shell, services) list all five nub peer deps, even if a package only imports types from a subset. Nub packages are types-only with zero install footprint; a uniform rule is cheaper to reason about than package-specific subsets.
- `@napplet/core` peer-dep range bumped from `>=0.1.0` to `^0.2.0` on the same four packages.

### Import Strategy
- Direct `import type { ... } from '@napplet/nub-<domain>'` at each use site.
- Delete every kehto local alias / duplicated interface that was hand-copied from a `@napplet/nub-*` type.
- Do not introduce a kehto barrel (`@kehto/runtime/types`) or namespace import (`import * as IfcTypes`) — the direct-import pattern is clearer and matches existing imports from `@napplet/core`.

### Workspace Linking
- Use pnpm `workspace:*` protocol for the five new nub packages via an override entry in the root `package.json` — matches the existing pattern used for `@napplet/core`, `@napplet/shim`, `@napplet/sdk`, `@napplet/vite-plugin`.
- If the existing `@napplet/core` override uses an absolute `link:/home/sandwich/Develop/napplet/packages/core` path (it does), the new nub overrides use the same base path: `link:/home/sandwich/Develop/napplet/packages/nubs/<domain>`. If the planner determines that `workspace:*` works cleanly with the repo layout, they may normalize to that instead — the intent is that nub packages resolve through the same mechanism as @napplet/core.

### Source of Hand-Copied Types (to be located during planning)
- Kehto's v1.1 implementation hand-rolled NubMessage-like types. Known locations to audit:
  - `packages/acl/src/resolve.ts` defines `NubMessage` locally (zero-dep constraint motivation)
  - `packages/runtime/src/types.ts` may reference locally declared nub message types
  - `packages/runtime/src/*-handler.ts` files likely import these locally
  - `packages/services/src/types.ts` and per-service files may have similar duplicates
- `@kehto/acl` must preserve its zero-runtime-dep posture: `@napplet/nub-*` peer deps are types-only, so the constraint is satisfied as long as no runtime value is imported.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/v1.2-NIP-5D-AUDIT.md` — the drift audit from Phase 10 contains rows tagged with `Target Phase: Phase 11` that identify specific hand-copied type locations. Planner should extract those rows and use them as the concrete work list.
- `packages/*/package.json` — current peer-dep declarations for `@napplet/core` live at `"@napplet/core": ">=0.1.0"` (acl, runtime, services) and `"@napplet/core": ">=0.1.0"` (shell).
- Root `package.json` has a `pnpm.overrides` block listing `@napplet/core`, `@napplet/shim`, `@napplet/sdk`, `@napplet/vite-plugin` — nub overrides follow the same shape.

### Established Patterns
- All kehto packages are ESM-only, TypeScript strict, `verbatimModuleSyntax` enabled — `import type` is required for type-only imports.
- Monorepo tooling: pnpm workspaces + turborepo + tsup + changesets.
- File naming: lowercase with hyphens.

### Integration Points
- `pnpm install` after override updates must resolve all five nub packages to the napplet workspace.
- `pnpm build` (turbo) and `pnpm type-check` must pass.
- Phase 12 consumes this phase's output — handler implementations can use the real nub message types immediately.

</code_context>

<specifics>
## Specific Ideas

- A single changeset entry may not be appropriate here because each kehto package bumps its peer-dep set; Phase 15 handles the changeset rollup. Do NOT add changeset files in this phase unless required for build to pass.
- Test suite: v1.1 test count is ~170. Regression gate in Phase 11 execution will run the prior-phase tests. If any fail due to changed types, root-cause before proceeding — types should be structurally identical to what kehto hand-copied.

</specifics>

<deferred>
## Deferred Ideas

- Formalizing a cross-package type-re-export barrel from kehto — deferred unless a concrete consumer emerges.
- Removing the absolute-path `link:` overrides in favor of a fully portable `workspace:*` setup — leave pattern consistent with @napplet/core for this phase; portability work is a future milestone.

</deferred>
