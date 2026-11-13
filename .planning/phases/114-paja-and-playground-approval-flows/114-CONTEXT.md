# Phase 114: Paja and playground approval flows - Context

**Gathered:** 2026-10-17
**Status:** Ready for research; implementation depends on Phase 113
**Source:** Autonomous PRD express path from `.planning/FIREWALL-GOAL.md`

<domain>
## Phase Boundary

Complete the shared approval architecture in Paja/bench, the playground, and every
host launch path. Phase 113 supplies service authorization and destination checks;
this phase supplies actual app admission, presentation, management, persistence,
and browser isolation. Neither phase alone proves the complete goal.

Requirements: HOST-01, HOST-02, HOST-03, HOST-04, HOST-05. The original goal remains
the authority; this document does not narrow package, app, regression, or shipping
scope. Phase 115 owns the final audit and open PR.
</domain>

<decisions>
## Locked decisions from the goal

- Firewall is the shared pure policy authority; runtime owns asynchronous approval
  coordination, cancellation, enforcement, and lifecycle. Hosts own presentation
  and actions. Do not create a second host permission store or evaluator.
- Required interface denial prevents execution. Optional denial permits reduced
  functionality. Bind the injected namespace and later environment delivery to
  the same approved snapshot, with no undeclared or unapproved domain exposure.
- Use verified manifest identity and artifact bytes for signed apps. Keep unsigned
  development targets explicit and isolated, with no persistent signed-app grants.
  Never use names or message identity claims as permission authority.
- Approve before assigning executable bytes to the frame. Revalidate the exact
  source generation, identity, current grants, and admission result after every
  asynchronous boundary and immediately before execution.
- Interface permission does not imply resource/network permission or vice versa.
  ACL and mandatory protocol constraints remain hard limits.
- Show trusted requesting identity, operation, exact target/scope, and offered
  lifetime. Support allow, deny, and cancellation; expose grants and revocation.
  Persistent load/save failures must be visible and must not silently allow work.
- Cover ordinary launch, reload, replacement, installed intent targets, shared-link
  launcher frames, local files, development servers, and simultaneous instances.
- Cancel stale prompts and operations when frames close, navigate, are replaced,
  or lose relevant grants. A late answer must not authorize a replacement frame.
- Relay/Blossom discovery hints and demo configuration are not direct-network
  approval. Direct browser grants need explicit exact origins and must be distinct
  from mediated operation grants. Revocation must retire the executing frame when
  needed to remove its CSP authority; deleting a stored grant alone is insufficient.
- Keep rate budgets and prompt-spam controls independent. Explain which operations
  are mediated and metered; do not claim the parent meters direct iframe traffic.
- Migrate signer consent, diagnostics, simulation, configuration, and settings into
  the shared model without widening existing authority. Retained compatibility
  needs warnings, central tracking, regression tests, and removal prerequisites.
- Complete docs, package changesets, and real-browser regressions alongside code.

## Protocol decisions verified before this context

On 2026-10-17 GitHub API returned the same refs as the initial research:

| Authority | Exact ref | Checked implications |
|---|---|---|
| NIP-5D, dskvr/nips `5D.md`, upstream PR 2303 | `5560820fa4f37f45b8ab742a11aeb3001b17dc67` | R/O declarations are not grants; missing O must not block launch; domains are discovered through namespace presence; verify before srcdoc and CSP injection; opaque sandbox/source identity |
| napplet/naps master, `naps/NAP-SHELL.md` | `19de5ce1cea40cd4c76089cdd8126e9f87648049` | Shell is optional; other granted domains work independently of shell.ready; handshake does not establish identity or grant capabilities |
| napplet/naps PR 19, NAP-CONNECT | `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f` | No connect wire messages; draft still assumes aggregate folding and HTTP response CSP |

Required-denial launch blocking is explicit Kehto policy consistent with the goal;
NIP-5D itself permits a warning for unavailable required domains. Stale repository
language requiring shell in every runtime must not override the checked spec.

NAP-CONNECT's old identity/loading assumptions contradict current single-artifact
srcdoc loading. Preserve the bounded policy already recorded in the milestone
research: implement explicit host network grants through current CSP tooling;
do not invent connect envelopes or claim full NAP-CONNECT conformance. Resolve
the NAP-RESOURCE direct-network-denial prerequisite when deciding which interfaces
may be exposed with a direct-network grant. Do not silently expose a resource API
whose mandatory isolation is bypassable, or remove network functionality from the
goal to avoid this decision. Research must state the permitted combinations and
cover them with browser tests.

## Agent discretion

Choose shared UI and persistence adapter boundaries consistent with framework-free
packages and existing app conventions. Choose accessible layout and wording, test
fixtures, and plan decomposition. Recheck Phase 113 outputs before fixing concrete
API assumptions. Do not change service files concurrently with their executor.
</decisions>

<canonical_refs>
## References to read

- `.planning/FIREWALL-GOAL.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/research/firewall-approvals.md`
- `.planning/phases/112-runtime-approval-lifecycle/112-01-CHECKPOINT.md`
- `.planning/phases/113-service-authorization-boundaries/113-CONTEXT.md`
- `.planning/phases/113-service-authorization-boundaries/113-RESEARCH.md`
- `.planning/phases/113-service-authorization-boundaries/113-PLAN-REVIEW.md`
- `docs/firewall-approvals.md`
- `docs/compatibility.md`

Exact spec copies currently live in `/tmp/kehto-firewall-specs`. Re-fetch by the
recorded refs if absent; local copies are not a substitute for checking upstream
heads before implementation/shipping. NAP-RESOURCE PR 80 authority and resolved
transport constraints are recorded in Phase 113 research.
</canonical_refs>

<specifics>
## Current code evidence and required coverage

Root inspected these sources at parent commit `3c01684c` while Phase 113 resource
implementation was live. Re-read before edits; these are migration findings, not
claims about completed code.

| Consumer | Finding | Required regression |
|---|---|---|
| `packages/paja/src/browser-target-frame.ts` | Identity currently only dTag/hash; required-domain check warns and excludes shell; relay/Blossom hints enter connectOrigins | Verified principal, required denial before bytes, optional narrowing, shell optionality, hints never auto-grant direct traffic |
| Same file, development-server branch | Uses namespace injection and base href without prepareNappletSrcdoc | Explicit development identity, shared admission, constrained network/bootstrap loading, reload invalidation; preserve usable development workflow |
| `packages/paja/src/browser-intent-launcher-host.ts` | Hidden launcher frame navigates through context.navigateFrame, later dispatches intent | Launcher and selected target independently admitted, cancellation before/after readiness, correct principal and source teardown |
| `apps/playground/src/playground-frame-loader.ts` | Static resource-demo origin; beforeRender awaits after registration; load listener can register a replacement source | No static approval bypass; stale/cancelled beforeRender cannot execute; replacement cannot inherit unauthorized grants |
| `packages/paja/src/browser-signer-consent.ts` and `browser-host-signer.ts` | Separate remembered signer authority and broad trust UI | Shared typed grant mapping, no widening of historical consent, canonical quiet path, bounded legacy diagnostics |
| `packages/shell/src/napplet-csp.ts` | Exact connection-origin support exists; general source-list overrides also exist | Approved connect origins only, no subresource/config route around resource isolation; test actual browser requests |

The graph located Paja createWindow in browser-adapter, loadPointer in browser-host,
and playground createWindow in demo-hooks/loadNapplet in shell-host. Trace all callers
and app aliases, including bench, during research. This table is a starting map,
not an exhaustive consumer audit.

Browser acceptance must include both hosts: initial approval/denial, optional domain
absence, LINK/resource/network decisions, remembered grants, reload, revoke while
pending and executing, direct-network denial and explicit grant, source replacement,
and intent-created frames. Use network observations and side-effect assertions,
not only prompt text or configuration snapshots.
</specifics>

<deferred>
## Deferred work

No host requirement is deferred beyond this milestone. Final cross-consumer audit
and shipping remain Phase 115; service execution remains Phase 113. Research may
run concurrently, but host implementation must use checked service contracts.
</deferred>
