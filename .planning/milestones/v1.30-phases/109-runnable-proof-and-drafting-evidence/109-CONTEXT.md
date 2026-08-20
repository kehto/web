# Phase 109: Runnable Proof and Drafting Evidence - Context

**Gathered:** 2026-08-20 (autonomous assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the completed experimental IPC projection independently runnable and
auditable: a standalone reference host and raw Node.js napplet process must
demonstrate canonical request/result and runtime-originated push delivery over
one POSIX Unix-domain socket projection, including graceful and abrupt cleanup.
Finish the publishable `@kehto/shell-ipc` documentation/release evidence and
record a web/IPC parity matrix plus upstream-ready IPC drafting findings. This
phase documents and proves the existing runtime composition; it does not alter
the runtime, browser shell, or carrier contract.

</domain>

<decisions>
## Implementation Decisions

### Runnable Reference Proof

- **D-01:** Deliver a repository-owned, standalone Node ESM reference host and
  raw napplet process alongside `@kehto/shell-ipc`, with a process-integration
  test that runs the host as a process and has it launch/coordinate the raw
  napplet. The reference host may consume the package's public ESM build; the
  napplet must use only `node:net`, its own local RFC 7464 encode/decode code,
  and explicit process arguments/standard streams.
- **D-02:** The proof transcript must establish readiness with the one exact
  bare `shell.ready`, record the one `shell.init`, send a real canonical request
  with an `id`, and assert the corresponding runtime result has that same `id`.
  It must not simulate the result, write output directly to the socket, or use
  a napplet-side `@kehto/*` import, helper, or injected `window.napplet.*`
  interface.
- **D-03:** Demonstrate host-initiated delivery through the existing public
  runtime service path (`ServiceRuntimeContext.sendToEligibleNapplet`) and a
  real canonical message/recipient-capability mapping, rather than a direct
  peer write or `Runtime.injectEvent()`. The current IPC composition rejects
  non-canonical egress, while `injectEvent()` produces legacy event arrays;
  changing either behavior is outside this phase.
- **D-04:** Cover both clean completion and forced raw-process termination.
  Each run must await the projection's normal lifecycle cleanup and assert no
  route/session or owned socket pathname/directory remains. Reuse the
  generation-safe endpoint cleanup already proven in Phase 108; do not add a
  competing process lifecycle implementation.

### Public Package and Release Evidence

- **D-05:** Treat `@kehto/shell-ipc` as the one publishable experimental
  package. Update its README and package documentation to describe both the
  transport and `createIpcShellProjection()` composition, provide a runnable
  host-oriented entry point, and make the Node >=20, POSIX-only, experimental,
  non-authentication, and hostile-same-UID limits conspicuous.
- **D-06:** Reconcile the existing pending `@kehto/shell-ipc` minor Changeset
  so its release note accurately covers the unreleased experimental projection
  rather than creating a second independent package bump. Keep the package ESM
  boundary, `@napplet/core` peer contract, and first-party
  `@kehto/runtime: workspace:^` dependency intact.
- **D-07:** Keep focused process coverage in the shell-ipc package test suite;
  run the repository's relevant end-to-end selection only as a verification
  gate, without expanding the browser Playwright surface for a Node/POSIX-only
  carrier proof.

### Parity and Upstream Drafting Record

- **D-08:** Publish one discoverable documentation page for the experimental
  projection that contains the web/IPC parity matrix and upstream drafting
  findings, and link it from the package documentation/navigation. The matrix
  must classify each responsibility as shared, carrier-specific, intentionally
  absent, or unresolved; it must not imply that browser-only injection or
  `postMessage` is present in IPC.
- **D-09:** The drafting findings must name
  `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa` as
  the checked authority and say explicitly that it defines no IPC carrier. It
  must distinguish carrier-neutral NAP-SHELL/NAP-INC invariants from the
  experimental choices for RFC 7464 framing, pathname endpoint naming,
  host-bound identity, local trust boundaries, lifecycle, terminal errors,
  finite limits, security assumptions, and unresolved upstream questions.
- **D-10:** Preserve the frozen host registration, exact-ready/idempotent-init,
  one-active-peer, targeted egress, ACL/capability eligibility, and
  generation-matched cleanup behavior from Phases 107–108. Documentation and
  examples must not expose peer-selected identity, a shared listener, or an
  unauthenticated carrier as a security feature.

### Explicit Exclusions

- **D-11:** Do not add Windows named pipes, TCP/WebSocket/remote IPC, a broker
  or multiplexed listener, Tauri/Electron, browser `postMessage`, interface
  injection, a reusable napplet IPC SDK/helper, or changes to
  `packages/runtime/src` or `packages/shell/src`. If the proof reveals a
  missing protocol decision, record it as an unresolved drafting question
  instead of establishing a new wire contract in code.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 109 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` — PROOF-02, PROOF-03, PROOF-05, and SPEC-01
  through SPEC-04 acceptance boundary and explicit non-goals.
- `.planning/phases/107-ipc-transport-foundation/107-VERIFICATION.md` and
  `.planning/phases/107-ipc-transport-foundation/107-SECURITY.md` — bounded
  RFC 7464 transport, private path ownership, and accepted same-UID limit.
- `.planning/phases/108-runtime-shell-composition/108-CONTEXT.md`,
  `.planning/phases/108-runtime-shell-composition/108-VERIFICATION.md`, and
  `.planning/phases/108-runtime-shell-composition/108-SECURITY.md` — frozen
  host identity, exact readiness, targeted egress, lifecycle, and the completed
  IPC/runtime parity constraints.
- `packages/shell-ipc/src/ipc-shell.ts`, `packages/shell-ipc/src/json-sequence.ts`,
  and `packages/shell-ipc/src/types.ts` — public carrier/composition behavior
  and framing contract to prove, not replace.
- `packages/runtime/src/runtime.ts` and `packages/runtime/src/types.ts` —
  public runtime/service egress seam; in particular
  `ServiceRuntimeContext.sendToEligibleNapplet` is the policy-checked
  host-originated canonical delivery path.
- [`NAP-SHELL.md` at the pinned upstream ref](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md)
  and [`NAP-INC.md` at the same ref](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-INC.md)
  — carrier-neutral lifecycle/directionality authority. The IPC carrier is an
  intentional specification gap at this ref.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `createIpcShellProjection()` already composes the public `Runtime` and sends
  runtime egress only to the current ready opaque peer. Its returned
  projection/composition owns endpoint close, unregister, and full shutdown.
- `encodeJsonSequence()` and the bounded decoder define the exact raw peer
  framing: RS (`0x1e`), UTF-8 JSON object with string `type`, LF (`0x0a`). The
  raw reference napplet should reproduce this small wire codec locally rather
  than importing it.
- `runtime-shell.test.ts` has raw `node:net` connection, frame collection,
  readiness, policy, graceful disconnect, abrupt destroy, and resource cleanup
  helpers that establish the assertions the process proof must preserve.
- Runtime service contexts already expose a policy-checked canonical push seam.
  Existing services retain that context in `onRegistered()` and call
  `sendToEligibleNapplet()` for runtime-originated delivery.
- The package already has a public ESM manifest, TypeDoc export barrel,
  README, package documentation page, docs audit, and one pending shell-ipc
  minor Changeset to complete rather than duplicate.

### Established Patterns

- Package unit tests use local Unix sockets with `try/finally` cleanup;
  existing tests that spawn a process drain output and await process exit.
- Documentation checks require every public package page to retain a current
  version row, scope boundary, API reference link, and VitePress discoverability.
- The projection accepts only canonical-object egress. `Runtime.injectEvent()`
  produces a legacy event array, so it is deliberately not a valid IPC push
  proof; a service-originated canonical envelope is.

### Integration Points

- Reference host: public `@kehto/shell-ipc` projection API and a complete
  host `RuntimeAdapter` fixture, using host-owned registration/environment.
- Raw napplet child: only the private endpoint pathname passed by its host,
  `node:net`, RFC 7464 bytes, and a structured transcript channel for test
  assertions; it has no access to host identity metadata other than what
  `shell.init` legitimately sends.
- Public documentation: `packages/shell-ipc/README.md`,
  `docs/packages/shell-ipc.md`, a new discoverable reference page, and the
  VitePress navigation/index that exposes it.
- Release evidence: the existing `.changeset` entry for `@kehto/shell-ipc` and
  the normal build, type-check, unit, relevant E2E, docs, and AI-slop gates.

</code_context>

<specifics>
## Specific Ideas

- Make the reference output deterministic and machine-readable enough for the
  process test to assert: `shell.init`, one request/result correlation, one
  policy-checked runtime push, and cleanup outcome. Do not put secrets or raw
  private socket paths in diagnostics/docs.
- Keep the parity matrix compact but complete: envelope shape and NAP-SHELL
  lifecycle/identity/ACL/INC semantics are shared; browser source trust and
  `postMessage` versus private Unix sockets/RFC 7464/host-held path distribution
  are carrier-specific; injection/client helper/Windows/remote/multiplexing are
  absent; local peer authentication and a standard IPC carrier remain unresolved.
- The public wording must repeat that private directory permissions and
  pathname distribution are operational containment, not cryptographic peer
  authentication.

</specifics>

<deferred>
## Deferred Ideas

- Windows named-pipe parity, remote transports, brokered/multiplexed topology,
  and a standardized authentication layer require a future IPC NAP decision.
- A reusable napplet-side IPC SDK or `window.napplet.*` projection is deferred
  until an upstream contract defines it.
- Any change to browser `@kehto/shell`, the runtime's canonical dispatch and
  envelope contract, or the existing transport limits/topology is outside this
  proof/documentation phase.

</deferred>
