# Phase 3: Runtime Migration Doc - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

A migration document for @kehto/runtime exists that describes the NUB dispatch design, AUTH removal scope, handler rewrites, and session identity anchor decision.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/migration documentation phase. Use ROADMAP phase goal, success criteria, gap analysis boundary contracts (docs/GAP-ANALYSIS.md section 5.2), and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Key Source Files
- `packages/runtime/src/runtime.ts` — Core protocol engine, verb switch dispatch
- `packages/runtime/src/types.ts` — Current message types
- `docs/GAP-ANALYSIS.md` — Section 5.2 (@kehto/runtime boundary contract), Section 2 (AUTH removal scope), Section 4 (silent failures)
- `.planning/research/ARCHITECTURE.md` — Runtime integration flow
- `.planning/research/STACK.md` — Wire format comparison

### Reference from Gap Analysis
- NUB dispatch replacing NIP-01 verb switch (msg[0] → msg.type domain prefix)
- AUTH machinery removal: ~40% of runtime.ts (10 symbols, 7 supporting modules)
- Handler rewrites for relay/signer/storage/ifc
- SessionEntry identity anchor decision (post-AUTH)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description, success criteria, and gap analysis sections 2, 4, and 5.2.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
