# Phase 2: ACL Migration Doc - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

A migration document for @kehto/acl exists that describes every breaking change in the ACL subsystem and how to migrate persisted ACL data to the new format.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/migration documentation phase. Use ROADMAP phase goal, success criteria, gap analysis boundary contracts (docs/GAP-ANALYSIS.md section 5.1), and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Key Source Files
- `packages/acl/src/` — Current ACL implementation
- `docs/GAP-ANALYSIS.md` — Section 5.1 (@kehto/acl boundary contract)
- `.planning/research/ARCHITECTURE.md` — ACL impact analysis
- `.planning/research/PITFALLS.md` — ACL composite key pitfall

### Reference from Gap Analysis
- Identity key schema change: `pubkey:dTag:hash` → `dTag:hash`
- Capability constants map cleanly to NUB domains
- Logic is format-agnostic, only key format changes

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description, success criteria, and gap analysis section 5.1.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
