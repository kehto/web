# Phase 5: Services Migration Doc - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

A migration document for @kehto/services exists that describes the ServiceHandler interface change and all per-handler migration paths.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/migration documentation phase. Use ROADMAP phase goal, success criteria, gap analysis boundary contracts (docs/GAP-ANALYSIS.md section 5.4), and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Key Source Files
- `packages/services/src/` — All services source files
- `docs/GAP-ANALYSIS.md` — Section 5.4 (@kehto/services boundary contract)
- `docs/RUNTIME-MIGRATION.md` — Section 3 (handler rewrites affect services)
- `.planning/research/FEATURES.md` — ServiceHandler legacy coupling

### Reference from Gap Analysis
- ServiceHandler interface: handleMessage(windowId, msg: unknown[], send) → envelope-native
- Per-handler: signer, audio, notifications need individual migration paths

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
