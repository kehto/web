# Phase 104: NAP-INTENT and Manifest Contract Parity - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`)

<domain>
## Phase Boundary

Kehto resolves authoritative convention URIs through installed verified
manifest contracts, accepts source-independent delivery responsibility, and
sends runtime-attested carrier-neutral delivery only after target readiness.
This phase owns BASE-01, BASE-02, INTENT-01 through INTENT-11, ARCH-01,
ARCH-02, and ARCH-04. Published package adoption and full Paja/playground host
flows remain Phase 105.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion

All implementation choices are at the agent's discretion because discuss is
disabled by project setting. Use the Phase 104 roadmap goal and success
criteria, `napplet/naps` NAP-INTENT draft PR #91 at exact head
`a718915ddefa2f03a0126579601f59d8bd86f7c4`, the convention-capable Napplet
source merged as `napplet/web@dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b`,
and existing Kehto security and lifecycle patterns. Do not infer protocol
behavior from the partial pre-plan Phase 104 scaffold when it conflicts with
those authorities.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- Codebase context will be gathered during plan-phase research.

### Established Patterns

- Preserve the authenticated NAP-SHELL session boundary and the shared
  projection-owned convention URI normalizer established in Phases 101 and 102.
- Treat installed verified manifest data as catalog authority and keep runtime
  delivery identity derived from authenticated session state.

### Integration Points

- Protected shell namespace binding, runtime/service dispatch, catalog intent
  resolver, verified NIP-5A manifest parser, target lifecycle controller, and
  focused host-independent tests.

</code_context>

<specifics>
## Specific Ideas

No additional preferences were supplied. The roadmap, exact draft, released
Napplet source line, and repository conformance guardrails are authoritative.

</specifics>

<deferred>
## Deferred Ideas

- Import the new published `@napplet/core`, `@napplet/nap`, `@napplet/shim`,
  `@napplet/sdk`, and `@napplet/vite-plugin` versions and prove real host flows
  in Phase 105.
- Run the repository-wide active-surface, documentation, release, and full
  quality gates in Phase 106.

</deferred>
