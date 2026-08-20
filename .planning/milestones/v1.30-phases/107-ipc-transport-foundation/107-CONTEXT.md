# Phase 107: IPC Transport Foundation - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`)

<domain>
## Phase Boundary

Host integrators can create a bounded, private, identity-bound Unix-domain
socket endpoint that safely transports canonical NIP-5D envelopes.

</domain>

<decisions>
## Implementation Decisions

### the agent's Discretion
All implementation choices are at the agent's discretion because discuss was
skipped by project setting. Use the approved roadmap goal, success criteria,
requirements IPC-01 through IPC-04 and BIND-01, project research, and existing
codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. The approved
milestone research identifies `Runtime.handleMessage(windowId, envelope)` as
ingress and `RuntimeAdapter.sendToNapplet` as egress, while this phase remains
focused on the new transport package and host-owned endpoint registration.

</code_context>

<specifics>
## Specific Ideas

No additional requirements beyond the approved roadmap and research. This is a
Node/POSIX-only experimental projection using RFC 7464 framing and dedicated
pathname Unix-domain sockets.

</specifics>

<deferred>
## Deferred Ideas

Windows named pipes, shared-listener multiplexing, remote transports,
napplet-side helpers, and interface injection remain outside this milestone.

</deferred>
