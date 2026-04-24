# Phase 37: SPEC Resync + Foundation Gates - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Mode:** Infrastructure phase — smart discuss skipped (no grey areas)

<domain>
## Phase Boundary

The canonical NIP-5D spec is current (byte-identical to upstream `dskvr/nips` branch `nip/5d` at a recorded commit SHA), the provisional local type strategy is established (three type files for class/connect/resource domains that don't yet have published `@napplet/nub/*` subpaths), and the v1.6 E2E baseline (54/0/0) is confirmed unbroken — so all downstream v1.7 phases build on verified ground.

This phase delivers **foundation gates**, not user-visible behavior. It is prerequisite for Phases 38–42.

</domain>

<decisions>
## Implementation Decisions

### Spec sync mechanics
- Source: `https://raw.githubusercontent.com/dskvr/nips/nip/5d/5D.md` at a resolved commit SHA
- Target: `specs/NIP-5D.md` (existing file, overwrite)
- Sync header comment refreshed with v1.7 sync date + resolved upstream commit SHA
- Diff documented in phase ITERATION-LOG.md (not in the spec file itself)

### Provisional type files — location + structure
- Location: `packages/shell/src/types/provisional-class.ts`, `provisional-connect.ts`, `provisional-resource.ts`
- Each marked with `// provisional — pending @napplet/nub/<domain> publish` header comment
- Each includes `TODO: swap import to @napplet/nub/<domain> when published at <expected-range>` annotation
- Expected ranges: `class` + `connect` → `^0.3.0`; `resource` → `^0.2.2`
- Wire types sourced from the canonical napplet repo (already verified to exist in-source for config/resource; canonical for class/connect)
- Config has no provisional file — `@napplet/nub/config` already published at `^0.2.1`; import directly

### Baseline verification
- Canonical loop: `pnpm clean && pnpm build && pnpm test:e2e` against `:4174` built demo (not `pnpm dev`)
- Expected result: 54 passed / 0 failed / 0 skipped
- Recorded in `37-ITERATION-LOG.md`
- Any deviation from 54/0/0 blocks phase close

### Claude's Discretion
- File header format for provisional types (JSDoc style preferred for consistency with other `packages/shell/src/types/*.ts` files if any)
- `37-ITERATION-LOG.md` structure — follow established pattern from prior phase iteration logs (e.g., `.planning/milestones/v1.6-phases/*/*-ITERATION-LOG.md`)
- Commit granularity — atomic per logical change (spec, provisional-class, provisional-connect, provisional-resource, iteration log); single consolidated commit acceptable if diff stays legible

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `specs/NIP-5D.md` — existing pinned canonical copy (synced at v1.2 per its header comment); overwrite target
- `packages/shell/src/` — existing structure; `types/` subdirectory may or may not exist (verify in plan research)
- `pnpm clean`, `pnpm build`, `pnpm test:e2e` — existing workspace scripts (confirmed working at v1.6 close)

### Established Patterns
- Spec file header format: HTML comment block with `Source:`, `Synced at:`, `Sync policy:` fields (see current `specs/NIP-5D.md` lines 1–7)
- Iteration log format: see any v1.6 phase dir under `.planning/milestones/v1.6-phases/`
- Anti-term sweep discipline: every phase ending recorded grep proof of zero anti-feature regressions

### Integration Points
- `README.md` Specification section — cross-references `specs/NIP-5D.md`; verify still valid after resync
- No runtime code changes — foundation phase only

</code_context>

<specifics>
## Specific Ideas

- The upstream spec at `dskvr/nips` `nip/5d` contains a class-posture delegation paragraph that is the prerequisite for NUB-CLASS adoption (Phase 38). Confirm this paragraph is present in the resynced spec before phase close.
- Research SUMMARY.md flagged two substantive diffs between the v1.2 pin and current upstream: (1) Security Considerations item 1 extended, (2) new class-posture delegation paragraph. Verify both land in the resynced file.
- Provisional type files must be legal TypeScript (compile clean) but they won't be imported yet — they serve as a staging ground for Phases 38 (class), 39 (connect), 40 (resource) to import from.

</specifics>

<deferred>
## Deferred Ideas

None — phase scope is foundation-only.

</deferred>
