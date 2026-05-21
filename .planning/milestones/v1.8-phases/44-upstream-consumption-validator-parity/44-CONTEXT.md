# Phase 44: Upstream Consumption + Validator Parity - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Mode:** Smart discuss with execution-time audit (scope adjusted twice)

<domain>
## Phase Boundary

Consume `@napplet/nub@^0.3.0` + `@napplet/core@^0.3.0` across all 4 `@kehto/*` packages, retire the `pnpm.overrides` SEED-001 workaround, reclassify the three `provisional-*.ts` files away from "pending upstream publish" framing (audit revealed upstream and kehto model different concepts in all three domains — see PROJECT.md Decision #31), and record the canonical origin-validator decision (#32).

**Pre-execution audits performed:**
- `npm view @napplet/nub@0.3.0` confirms published with proper `^0.3.0` semver for `@napplet/core` (SEED-001 fix landed).
- All 46 `@napplet/nub` subpaths (class, connect, resource, identity, ifc, keys, media, notify, relay, storage, theme, config) live on npm.
- Tarball inspection of upstream class/connect/resource type surfaces — all three diverge from kehto's provisional shapes (different concepts or different field names + error vocabularies).
- `grep -rn 'normalizeConnectOrigin' packages/ apps/` returns zero matches — kehto has no local implementation to migrate.

</domain>

<decisions>
## Implementation Decisions

### DEP-01 / DEP-02: Peer dep bumps

- Bump `@napplet/nub` peer dep `^0.2.1` → `^0.3.0` across `@kehto/acl`, `@kehto/runtime`, `@kehto/shell`, `@kehto/services`.
- Bump `@napplet/core` peer dep `^0.2.0`/`^0.2.1` → `^0.3.0` across the same 4 packages.
- `@kehto/nip66` keeps its `nostr-tools` peer dep unchanged (not a NUB consumer).
- `@kehto/wm` has no `@napplet/*` peer dep.

### DEP-03: Override retirement

- Delete the entire `pnpm` block from root `package.json`:
  ```json
  "pnpm": { "overrides": { "@napplet/nub>@napplet/core": "^0.2.1" } }
  ```
- After `pnpm install`, confirm the lockfile no longer carries the override.
- SEED-001 (`.planning/seeds/SEED-001-napplet-nub-core-packaging-bug.md`) is satisfied — move to `archived/` or delete.

### DEP-04 / DEP-05 / DEP-06: Reclassify provisionals (all three)

**Pattern for all three files:**
1. Rename `packages/shell/src/types/provisional-<domain>.ts` → `packages/shell/src/types/internal-<domain>.ts` (drop "provisional" prefix; signal "kehto-internal model" intent).
2. Rewrite the file header: remove the "TODO: swap import to @napplet/nub/<domain> when published" line and the v1.7 milestone-close-policy promise. Replace with a one-paragraph note explaining the concept divergence vs upstream (cite PROJECT.md Decision #31).
3. Update every import site (`./types/provisional-<domain>.js` → `./types/internal-<domain>.js`).
4. Update every prose reference to the old path in source code comments + JSDoc.

**Files touching each:**

- `provisional-class.ts` consumers: `packages/shell/src/{types.ts, shell-bridge.ts, index.ts}`, `packages/runtime/src/types.ts` (re-declares its own `NappletClass`), `apps/playground/src/shell-host.ts`.
- `provisional-connect.ts` consumers: `packages/shell/src/{index.ts, connect-store.ts}`.
- `provisional-resource.ts` consumers: `packages/shell/src/index.ts`, `packages/services/src/resource-service.ts`.

### DEP-07: Changesets

- 4 minor-bump changesets — one per affected package: `@kehto/{acl, runtime, shell, services}`.
- Body mentions: dep bump `^0.2.1` → `^0.3.0`, override retired, three provisionals reclassified (kehto-internal types kept; no API break to consumers since the import path change is internal to `@kehto/shell`).
- No `@kehto/nip66` or `@kehto/wm` changeset (no surface change).

### VALIDATOR-01 / VALIDATOR-02

- Audit complete: zero local `normalizeConnectOrigin` matches in `packages/` or `apps/`.
- Record in PROJECT.md Decision #32 (already added): upstream `@napplet/nub/connect#normalizeConnectOrigin` is canonical for any future kehto origin-validation work.
- No code change.

### Claude's Discretion

- Exact wording of file-header rewrites (concept divergence note).
- Whether to delete or `git mv` the three provisional files (recommend `git mv` for history preservation).
- Whether to also lint/format the changeset bodies via existing tooling.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pnpm.overrides` workaround at root `package.json:28-32` — single block to remove.
- Three provisional files at `packages/shell/src/types/provisional-{class,connect,resource}.ts` — all to rename + re-header.
- All 4 `@kehto/*` peer-dep blocks at `packages/{acl,runtime,shell,services}/package.json` — uniform format, easy regex.

### Established Patterns
- Changeset prose style: see `.changeset/v1-6-dep-*.md` for the v1.6 NUB dep consolidation changesets — same shape applies here.
- pnpm workspace dep references: each `@kehto/*` package consumes upstream via `peerDependencies`, never `dependencies` (Decision #2).
- Import path conventions: relative within a package, `@napplet/<scope>` for upstream — no aliases.

### Integration Points
- Build: `pnpm build` (turbo) compiles all packages; type-check is part of the build pipeline. Phase 42's closing baseline was `26/26 turbo tasks cached`; Phase 44 should preserve.
- Tests: `pnpm test:unit` baseline is 523/523. `pnpm test:e2e` baseline is 73/0/0. Both should stay green.

</code_context>

<specifics>
## Specific Ideas

- Use `git mv` (not delete+create) for the three provisional files to preserve blame history.
- After `pnpm install` post-override-retirement, run `pnpm install --frozen-lockfile` once to confirm the lockfile resolves cleanly without the override.
- Run `pnpm build && pnpm test:unit && pnpm test:e2e` once at end of phase to confirm 73/0/0 + 523/523 preserved.

</specifics>

<deferred>
## Deferred Ideas

- **Migrate kehto's resource wire surface to upstream's `@napplet/nub/resource` types.** Substantial work — field-name + error-vocab differences cascade into `@kehto/services/resource-service.ts`, the resource-demo napplet, the demo harness, and the Layer-A/Layer-B specs. Not in v1.8 scope.
- **Consume upstream `NappletClass`/`NappletConnect` accessor types for SDK wiring.** When kehto starts shipping SDK-side hooks for napplets to read shell-injected class/connect state. Not in v1.8 scope.
- **Adopt upstream's `normalizeConnectOrigin` if kehto ever ships origin-validation code.** Direct consumer of the upstream pure function; no local divergence.

</deferred>
