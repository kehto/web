# Phase 11: Nub Peer Deps & Type Imports - Context

**Gathered:** 2026-04-17 (rescoped for 8-nub napplet)
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase migrates kehto onto napplet's new 8-nub package graph:

1. Bumps the `@napplet/core` peer-dep range from `>=0.1.0` to `^0.2.0` on every `@kehto/*` package.
2. Adds `@napplet/nub-identity`, `-ifc`, `-keys`, `-media`, `-notify`, `-relay`, `-storage`, `-theme` as peer dependencies at the `^0.2.0` range (8 packages total).
3. Replaces every hand-copied NUB message type and constant in kehto source with direct `import type` statements from the matching `@napplet/nub-*` package. Deletes the hand-copied `signer.*` type set entirely — those types have no upstream home in the 8-nub world.
4. Ensures `pnpm build` and `pnpm type-check` succeed on a clean install against the new peer-dep set. Where kehto source references the removed `signer` domain (acl/resolve.ts, runtime.ts switch, signer-service.ts, shell-init.ts), intentional `// DRIFT-* — Phase 12` markers stub the compile errors so Phase 12 can close them without re-discovering the sites.

No handler behavior changes in this phase — full dispatch wiring, ACL extension, `window.nostr` removal, and `signer` domain removal are deferred to Phase 12. Theme domain behavior is Phase 13.

</domain>

<decisions>
## Implementation Decisions

### Peer Dep Strategy
- Version range for all eight `@napplet/nub-*` packages: `^0.2.0` — mirrors the `@napplet/core` range and semver posture.
- All four `@kehto/*` packages (acl, runtime, shell, services) list all eight nub peer deps, even if a package only imports types from a subset. Nub packages are types-only with zero install footprint; a uniform rule is cheaper to reason about than per-package subsets.
- `@napplet/core` peer-dep range bumped from `>=0.1.0` to `^0.2.0` on the same four packages.

### Import Strategy
- Direct `import type { ... } from '@napplet/nub-<domain>'` at each use site.
- Delete every kehto local alias / duplicated interface that was hand-copied from a `@napplet/nub-*` type.
- Hand-copied `signer.*` types are deleted outright. Call sites that currently reference them keep compiling via `// DRIFT-* — Phase 12` markers (see below) until Phase 12 migrates them to `identity.*` + shell-mediated `relay.publish`/`publishEncrypted`.
- Do not introduce a kehto barrel (`@kehto/runtime/types`) or namespace import (`import * as IfcTypes`) — the direct-import pattern is clearer and matches existing imports from `@napplet/core`.

### Workspace Linking
- pnpm `overrides` in the root `package.json` map each new `@napplet/nub-*` to `link:/home/sandwich/Develop/napplet/packages/nubs/<domain>`, mirroring the existing `@napplet/core` override pattern.
- Target paths (all confirmed present):
  - `link:/home/sandwich/Develop/napplet/packages/nubs/identity`
  - `link:/home/sandwich/Develop/napplet/packages/nubs/ifc`
  - `link:/home/sandwich/Develop/napplet/packages/nubs/keys`
  - `link:/home/sandwich/Develop/napplet/packages/nubs/media`
  - `link:/home/sandwich/Develop/napplet/packages/nubs/notify`
  - `link:/home/sandwich/Develop/napplet/packages/nubs/relay`
  - `link:/home/sandwich/Develop/napplet/packages/nubs/storage`
  - `link:/home/sandwich/Develop/napplet/packages/nubs/theme`

### Type-Compile Strategy for Signer Removal
- Keep Phase 11 minimal: do not delete runtime source that references the removed `signer` domain.
- Where type errors surface (at `signer.*` type import sites), annotate with `// DRIFT-<ID> — Phase 12: migrate to identity.* / relay.publishEncrypted` comments referencing the DRIFT IDs from `docs/v1.2-NIP-5D-AUDIT.md`. Intentional widening with `unknown` or `any` is acceptable IF annotated; no silent widening.
- Phase 12 deletes these annotations as part of its rewrites.

### Source of Hand-Copied Types (to be located during planning)
- `docs/v1.2-NIP-5D-AUDIT.md` contains DRIFT rows tagged `Target Phase: Phase 11`. Planner/executor use those rows as the concrete work list. Known rows:
  - **DRIFT-CORE-03** — `@napplet/core` peer-dep bump
  - **DRIFT-CORE-04** — add 8 `@napplet/nub-*` peer deps
  - **DRIFT-CORE-05** — replace hand-copied type imports with `@napplet/nub-*` imports
- `@kehto/acl` must preserve its zero-runtime-dep posture: `@napplet/nub-*` peer deps are types-only (`import type` only), so the constraint is satisfied as long as no runtime value is imported.
- Local minimum-shape interfaces (e.g., `packages/acl/src/resolve.ts` may have a `NubMessage { type: string }` structural type predating nub packages) are retained if they exist purely for internal shape-checking — they are not hand-copies of any nub-specific type.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/v1.2-NIP-5D-AUDIT.md` (177 lines, 40 DRIFT rows) — Phase 10's output. Planner extracts rows tagged `Target Phase: Phase 11` as the concrete work list.
- `packages/*/package.json` — current peer-dep declarations for `@napplet/core` at `>=0.1.0`.
- Root `package.json` `pnpm.overrides` block — nub overrides follow the same shape.

### Established Patterns
- All kehto packages are ESM-only, TypeScript strict, `verbatimModuleSyntax` enabled — `import type` is required for type-only imports (which is what nub packages are).
- Monorepo tooling: pnpm workspaces + turborepo + tsup + changesets.
- File naming: lowercase with hyphens.

### Integration Points
- `pnpm install` after override updates must resolve all eight nub packages to the napplet workspace at `/home/sandwich/Develop/napplet/packages/nubs/<domain>`.
- `pnpm build` (turbo) and `pnpm type-check` must pass (with documented drift markers tolerated).
- Phase 12 consumes this phase's output — handler implementations use the real nub message types immediately; signer-removal work mechanically locates its drift sites via the `// DRIFT-* — Phase 12` markers.

</code_context>

<specifics>
## Specific Ideas

- A single changeset entry is NOT appropriate in this phase — each kehto package bumps its peer-dep set; Phase 15 handles the changeset rollup for release prep. Do NOT add changeset files in this phase unless required for build to pass.
- Test suite: v1.1 test count is ~170. Regression gate in Phase 11 execution will run the prior-phase tests. Tests asserting direct `signer.*` behavior will fail compilation or behaviorally — those failures are expected and tracked as `// DRIFT-* — Phase 12` (or `// DRIFT-* — Phase 15` if they're test-only deletions). Do not "fix" signer-related test failures in Phase 11.

</specifics>

<deferred>
## Deferred Ideas

- Formalizing a cross-package type-re-export barrel from kehto — deferred unless a concrete consumer emerges.
- Normalizing `link:/absolute/path` overrides to `workspace:*` protocol — leave consistent with @napplet/core for this phase; portability work is a future milestone.
- Merging signer-service.ts-related changesets — Phase 12 owns the signer removal; Phase 15 owns the release-facing changeset entries.

</deferred>
