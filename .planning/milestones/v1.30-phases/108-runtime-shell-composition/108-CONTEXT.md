# Phase 108: Runtime Shell Composition - Context

**Gathered:** 2026-08-18
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`)

<domain>
## Phase Boundary

Connected napplet processes receive the same authenticated NAP-SHELL and
runtime guarantees as the web projection through IPC-specific lifecycle
binding. This phase composes the verified Phase 107 carrier with the public
`@kehto/runtime` seam; it does not build the standalone reference process or
drafting evidence owned by Phase 109.

</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- Keep `@kehto/shell-ipc` as the package name and POSIX Unix-domain sockets as
  the only carrier.
- Preserve canonical envelopes unchanged; IPC-specific metadata stays outside
  the wire messages.
- Bind source identity from the host registration, never from peer messages.
- Do not add Tauri, Electron, browser `postMessage`, interface injection,
  `window.napplet.*`, or a napplet-side Kehto helper.
- Keep the existing browser `@kehto/shell` implementation behavior unchanged.
- Treat `napplet/naps`
  `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa` as the checked
  authority: NAP-SHELL/NAP-INC lifecycle and directionality remain normative,
  while the IPC carrier and connection topology remain an explicit spec gap.

### Codex's Discretion

Detailed composition APIs, internal adapter ownership, diagnostic shapes, and
test organization may follow existing runtime and Phase 107 package patterns,
provided the roadmap requirements BIND-02 through BIND-04, PROOF-01, and
PROOF-04 remain satisfied.

</decisions>

<code_context>
## Existing Code Insights

Phase 107 provides host-bound endpoint registration, a bounded RFC 7464 codec,
per-peer ordered egress, generation-safe registry state, and owned filesystem
lifecycle under `packages/shell-ipc`. Phase research must map the public
`@kehto/runtime` ingress/egress/session seams and compare them with the browser
shell's NAP-SHELL readiness behavior before planning changes.

</code_context>

<specifics>
## Specific Ideas

- Enforce at most one active peer per registered endpoint.
- One bare `shell.ready` establishes the source-bound runtime session and emits
  exactly one `shell.init`; duplicate readiness is idempotent.
- Pre-ready capability traffic must not reach handlers; post-ready traffic must
  retain existing ACL and capability checks.
- Graceful close, abrupt disconnect, explicit unregister, and host shutdown
  must clean up only the matching connection, runtime session, listener,
  pathname, and owned directory generation.

</specifics>

<deferred>
## Deferred Ideas

The standalone host/process proof, correlated request/result demonstration,
host-originated push demonstration, raw `node:net` reference napplet, parity
matrix, and upstream drafting findings remain Phase 109. Windows named pipes,
shared-listener multiplexing, remote transports, interface injection, and
napplet-side helpers remain outside the milestone.

</deferred>
