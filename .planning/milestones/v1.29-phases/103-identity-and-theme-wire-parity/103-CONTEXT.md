# Phase 103: Identity and Theme Wire Parity - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`)

<domain>
## Phase Boundary

Napplets receive private identity and theme state through only the result and
change messages sanctioned by their NAP contracts. This phase owns the
host-independent identity/theme wire and binding behavior; released package
adoption and full host flows remain in Phase 105.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion

All implementation choices are at the agent's discretion because discuss phase
is disabled by project setting. Use the Phase 103 roadmap goal, success
criteria, exact active NAP contracts, prior session-integrity decisions, and
existing codebase patterns. Do not weaken the Phase 102 blocker or pull
published-package adoption forward from Phase 105.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- Codebase context will be gathered during plan-phase research.

### Established Patterns

- Preserve the Phase 101 authenticated session boundary and exact message-type
  routing.

### Integration Points

- Identity and theme services, runtime handlers, the protected injected
  namespace, and host-independent Paja/playground bridges.

</code_context>

<specifics>
## Specific Ideas

No additional preferences were supplied. The roadmap contract and proposed
upstream semantics are authoritative.

</specifics>

<deferred>
## Deferred Ideas

- Published Napplet package adoption and live package-backed host flows remain
  in Phase 105.
- Phase 102 repeated unopened-handle overflow semantics remain tracked in
  `kehto/web#203` and must not be silently resolved inside this phase.

</deferred>
