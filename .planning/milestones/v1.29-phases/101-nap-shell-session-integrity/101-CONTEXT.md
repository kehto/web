# Phase 101: NAP-SHELL Session Integrity - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Kehto's NAP-SHELL implementation conform to `napplet/naps` master commit
`6461e4b37c29dc09a20dff35d9515889c4433874`: domain-only capability discovery,
truthful live grants, exactly-once bootstrap, pre-session isolation, and
per-napplet environment isolation. This phase owns SHELL-01 through SHELL-06 only.

</domain>

<decisions>
## Implementation Decisions

### Capability contract
- Remove numbered-protocol capability negotiation completely; NAP-SHELL is
  `supports(domain)` only.
- Remove `ShellCapabilities.protocols`, numbered flat `naps`, and
  `inc:NAP-01` through `inc:NAP-06` from active shell, Paja, playground, tests,
  and current documentation.
- Before init every support query is false; after init only granted domains
  backed by live host implementations are true.

### Session and isolation
- Preserve one bare `shell.ready` followed by one uncorrelated `shell.init`.
- Duplicate ready from the same trusted source is idempotent and cannot create a
  second session or init delivery.
- Capability traffic is not serviced before the session exists.
- Creation-time identity, trusted source, capabilities, and services cannot be
  reassigned or observed across napplet frames.
- `shell.init` exposes only the normative environment fields `capabilities` and
  `services`; internal storage remains nonnormative and readonly to napplet code.

### Host integration
- Shell, Paja, and playground advertise only domains whose implementations are
  wired; disabled/simulation controls remove the domain consistently.
- Resolve per-napplet granted domains through an explicit host seam that receives
  the creation-time identity. Do not infer a domain grant from "any" or "all"
  request-time ACL operations; exact internal hook naming is agent discretion.
- A registered source without trusted creation-time identity receives no
  `shell.init`, establishes no runtime session, and can use no capability.
- Update directly affected public types/JSDoc and `packages/shell/README.md` in
  this phase; defer the broad `RUNTIME-SPEC.md` and policy prose sweep to Phase 106.
- Preserve changelogs, archived planning, migrations, and historical requirement
  IDs as semantic history.

### the agent's Discretion
- Internal refactor boundaries and compatibility handling for nonnormative
  capability storage, provided no public or wire-visible numbered negotiation remains.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildShellCapabilities` centralizes the emitted NAP-SHELL environment.
- `createNappletNamespace` owns synchronous local `supports()` behavior.
- `ShellBridge` owns trusted-source message intake and session handoff.
- Paja/playground disabled-domain logic already has focused parity tests.

### Established Patterns
- NAP-facing changes update shell/runtime, Paja, playground, static guards, and
  tests in the same change.
- Historical changelogs and planning are not rewritten.
- Changed published packages receive Changesets.

### Integration Points
- `@kehto/shell`, runtime session gating, `@kehto/paja`, playground capability
  construction, conformance guards, active docs, and focused E2E tests.

</code_context>

<specifics>
## Specific Ideas

The complete milestone audit is
`.planning/NAP-CONVENTIONS-6461E4B-DELTA-AUDIT.md`. The companion upstream delta
is `.planning/phases/101-nap-shell-session-integrity/101-UPSTREAM-DELTA.md`.
For this phase, its NAP-SHELL sections and source pins are mandatory inputs; the
remaining sections are informational context for Phases 102-106.

</specifics>

<deferred>
## Deferred Ideas

- NAP-INC event/channel parity and ambiguity issue `kehto/web#203`: Phase 102.
- NAP-IDENTITY and NAP-THEME wire parity: Phase 103.
- Published package, intent, and manifest convention adoption: Phase 104.
- Paja/playground profile/resource/theme flows: Phase 105.
- Active-surface documentation, full gates, changesets, and PR: Phase 106.

</deferred>
