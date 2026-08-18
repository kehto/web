# Phase 108: Runtime Shell Composition - Research

**Researched:** 2026-08-18
**Domain:** Node/POSIX IPC lifecycle binding to the public `@kehto/runtime` NAP-SHELL seam
**Confidence:** HIGH for repository behavior; MEDIUM for the proposed IPC-only public composition API

<user_constraints>
## User Constraints (from CONTEXT.md)

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

### Deferred Ideas (OUT OF SCOPE)

The standalone host/process proof, correlated request/result demonstration,
host-originated push demonstration, raw `node:net` reference napplet, parity
matrix, and upstream drafting findings remain Phase 109. Windows named pipes,
shared-listener multiplexing, remote transports, interface injection, and
napplet-side helpers remain outside the milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BIND-02 | One active peer per endpoint; stale connection events cannot destroy a replacement. | Optional opaque peer lifecycle hook plus a composition-owned, monotonically generated connection slot. |
| BIND-03 | Bare `shell.ready` creates a source-bound session, sends one `shell.init`, and gates pre-ready traffic. | Reuse `Runtime.sessionRegistry`, `Runtime.handleMessage`, the runtime's session-first dispatch gate, and an IPC-local exact-once handshake state machine. |
| BIND-04 | All close paths clean only matching runtime and socket resources. | Connection-token guarded teardown invokes `runtime.destroyWindow()` then `sessionRegistry.unregister()` exactly once; Phase 107 retains listener/path/directory ownership. |
| PROOF-01 | Compose through the public runtime seam without changing canonical envelopes, dispatch, or browser shell. | Build a shell-ipc composition factory around `RuntimeAdapter`, `Runtime`, and optional peer hooks; do not alter `packages/runtime` or `packages/shell`. |
| PROOF-04 | IPC parity retains ACL, domain eligibility, source identity, handshake, and lifecycle enforcement. | Focused raw-socket integration tests assert every gate and lifecycle race through an actual `@kehto/runtime` instance. |
</phase_requirements>

## Summary

Phase 107 deliberately stops at a carrier: `createIpcTransport()` accepts every connected peer, broadcasts `IpcEndpoint.send()` to those peers, and only calls an `onEnvelope(envelope, registration)` hook. It already owns endpoint generations, private socket resources, bounded parsing, and per-peer egress; it does not create runtime sessions or authenticate an IPC peer. [VERIFIED: codebase-memory MCP]

Phase 108 should add an IPC composition layer inside `@kehto/shell-ipc`, not alter `@kehto/runtime` or the browser `@kehto/shell` bridge. The layer must construct/use a normal public `Runtime` with a `sendToNapplet` adapter that routes only to the currently active IPC peer, compose `isDomainAllowed` with the immutable registration environment, and manage the source-bound session lifecycle around the first exact bare `shell.ready`. [VERIFIED: codebase-memory MCP] [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md]

The pinned NAP authority is carrier-neutral: NAP-SHELL requires a bare readiness signal, first-ready session establishment, exactly one `shell.init`, duplicate idempotency, and no capability service before session establishment. NAP-INC requires sender attribution and teardown from the authenticated endpoint, but expressly leaves the binding of that endpoint to a projection. The Unix socket, peer-admission rule, connection token, and IPC session origin are therefore experimental specification-gap choices, not NAP requirements. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md] [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-INC.md]

**Primary recommendation:** Add a backwards-compatible optional peer lifecycle seam to the Phase 107 transport, then implement `createIpcShellProjection()` in `@kehto/shell-ipc` as the sole owner of active-peer, NAP-SHELL, session, eligibility, and runtime-egress state. [ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Unix-socket listener, RFC 7464 input, queue/backpressure, path cleanup | API / Backend | — | The Node host owns concrete sockets and filesystem resources. [VERIFIED: codebase-memory MCP] |
| One-active-peer admission and stale connection-token checks | API / Backend | — | It is carrier lifecycle policy and must run before runtime ingress. [ASSUMED] |
| `shell.ready` / `shell.init` transition | API / Backend | `@kehto/runtime` session registry | IPC composes host binding with the runtime’s public session API. [VERIFIED: codebase-memory MCP] |
| Canonical NAP dispatch, ACL, firewall, service and INC routing | API / Backend | — | `Runtime.handleMessage(windowId, message)` already owns these semantics after session gating. [VERIFIED: codebase-memory MCP] |
| Domain eligibility | API / Backend | Runtime adapter | `RuntimeAdapter.isDomainAllowed` is the published per-window dispatch gate. [VERIFIED: codebase-memory MCP] |
| Browser iframe/postMessage NAP-SHELL projection | Browser / Client | — | Locked unchanged; Phase 108 must not call or modify `@kehto/shell`. [VERIFIED: project CONTEXT.md] |

## Project Constraints (from AGENTS.md)

- Preserve the existing dirty `.planning/config.json`, `package.json`, `.planning/debug/jsr-release-scope-auth.md`, and untracked `108-PATTERNS.md`; this task writes only `108-RESEARCH.md`. [VERIFIED: local git status]
- Keep the existing non-default branch; never discard, stage, or absorb unrelated work. [VERIFIED: AGENTS.md]
- Implement later source changes through the GSD execution workflow; do not change the browser `@kehto/shell` projection, NAP handler semantics, or canonical envelope shape for IPC. [VERIFIED: AGENTS.md] [VERIFIED: project CONTEXT.md]
- Keep strict ESM TypeScript, 2-space indentation, lowercase-hyphenated filenames, and JSDoc on public exports. [VERIFIED: AGENTS.md]
- Later implementation must add real unit coverage and run `pnpm build`, `pnpm type-check`, `pnpm test:unit`, applicable end-to-end tests, docs checks when documentation changes, and the AI-slop gate. [VERIFIED: AGENTS.md]
- Check the pinned NAP authority before any NAP/NIP-5D change; report IPC as experimental and carrier-neutral rules as normative. [VERIFIED: AGENTS.md] [VERIFIED: project REQUIREMENTS.md]
- Do not create a Phase 109 raw-process proof, host push demonstration, parity matrix, drafting evidence, napplet helper, shared listener, remote transport, or Windows support in this phase. [VERIFIED: project CONTEXT.md]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@kehto/shell-ipc` | workspace `0.1.0` | Existing bounded Unix-socket carrier and endpoint ownership. | It is the locked carrier package and already contains the codec, queue, directory, and generation seams. [VERIFIED: codebase-memory MCP] |
| `@kehto/runtime` | workspace `0.22.0` | Canonical dispatch, ACL/firewall gates, service cleanup, sessions. | Its public `RuntimeAdapter`, `Runtime`, and `SessionRegistry` expose the required transport/session seam; add it to `shell-ipc` `dependencies` as `workspace:^` before importing it. [VERIFIED: codebase-memory MCP] |
| Node `node:crypto` | Node `v26.7.0` available | Host-generated `SessionEntry.instanceId` if the composition constructs session entries itself. | It avoids accepting a peer-supplied instance identifier. [ASSUMED] |
| Vitest | `4.1.2` installed | Unit and raw Unix-socket integration tests. | Existing IPC tests use this runner and repository test discovery. [VERIFIED: local environment] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@napplet/core` | existing `>=0.31.0 <0.32.0` peer | Existing `NappletMessage` type only. | Preserve canonical envelope types; do not add a new IPC wire type. [VERIFIED: packages/shell-ipc/package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Optional opaque peer lifecycle hook | Put runtime/session logic in `createIpcTransport()` | Rejected: it would turn the generic carrier into a runtime-specific transport and weaken PROOF-01 separation. [ASSUMED] |
| Per-peer targeted send | Existing broadcast `endpoint.send()` for `shell.init` and runtime egress | Rejected: another accepted peer could observe messages for the active session, violating per-napplet capability isolation. [VERIFIED: codebase-memory MCP] |
| IPC composition environment gate | Trust the peer’s declared domains/capabilities | Rejected: host registration is the only authority for IPC identity/environment. [VERIFIED: project CONTEXT.md] |
| Reject a concurrent second peer | Replace the active peer on arbitrary new connection | Recommended rejection keeps one session/receiver unambiguous and prevents a delayed old close from tearing down a newer state. [ASSUMED] |

**Installation:** No external registry package installation. Add the existing first-party workspace dependency and refresh the lockfile as established by `@kehto/shell`, `@kehto/services`, `@kehto/paja`, and the playground: [VERIFIED: workspace package manifests]

```bash
pnpm --filter @kehto/shell-ipc add @kehto/runtime@workspace:^
```

## Package Legitimacy Audit

No third-party package is installed by this phase. `@kehto/runtime` is a first-party workspace dependency already used through `workspace:^` by sibling packages; its registry heuristic result is `SUS` because the package is new/low-download, which does not affect the local workspace link. `@kehto/shell-ipc` is unpublished and therefore absent from npm. Neither result authorizes or requires a registry installation. [VERIFIED: workspace package manifests] [VERIFIED: package-legitimacy seam]

## Architecture Patterns

### System Architecture Diagram

```text
Host RuntimeAdapter
  │ createIpcShellProjection (experimental IPC policy)
  ▼
IPC composition state ── creates ──► public @kehto/runtime Runtime
  │                                       │
  │ registration {windowId, dTag, hash, environment} │ sendToNapplet(windowId, envelope)
  ▼                                       ▼
Phase 107 IpcTransport                active peer only
  │ connection accepted                     │
  ├──► admission: no active peer? ── no ──► reject/close peer
  │                  │ yes
  │                  ▼
  │           opaque connection token
  │                  │ RFC 7464 canonical envelope
  ▼                  ▼
shell.ready? ── bare first only ──► register source-bound SessionEntry
  │                                  └──► peer.send({ type: 'shell.init', ... })
  ├── duplicate ──► no-op
  └── other envelope ──► runtime.handleMessage(windowId, envelope)
                                   │
                    session → environment → ACL → firewall → NAP/INC handler
                                   │
socket end/error/unregister/close ─┴──► token matches? → destroyWindow → unregister
                                                │
                                                └── Phase 107 closes peer/listener/path/directory
```

The diagram's runtime arrows use only public runtime methods and adapter fields; connection metadata is never inserted into a canonical envelope. [VERIFIED: codebase-memory MCP]

### Recommended Project Structure

```text
packages/shell-ipc/src/
├── ipc-shell.ts                 # retain generic carrier; add optional opaque peer lifecycle seam
├── types.ts                     # peer lifecycle and projection public types, with JSDoc
├── runtime-composition.ts       # new IPC-only NAP-SHELL/runtime coordinator
├── runtime-composition.test.ts  # raw socket handshake, ACL, lifecycle parity tests
├── ipc-shell.test.ts            # retain generic carrier/API compatibility coverage
└── index.ts                     # export composition API without removing current exports
```

`packages/runtime` and `packages/shell` should not be edited for this phase. [VERIFIED: project CONTEXT.md]

### Pattern 1: Runtime Adapter Egress Multiplexer

**What:** The composition factory receives the existing `RuntimeAdapter` inputs, supplies `sendToNapplet` itself, and creates an ordinary public `Runtime`. Its egress function looks up the matching active, ready connection and sends through that specific peer’s queue; inactive, stale, or not-ready destinations are safely dropped. [ASSUMED]

**When to use:** Every runtime response, denial, INC delivery, and service push produced while the IPC projection is live. [VERIFIED: codebase-memory MCP]

**Why:** `Runtime.handleMessage` already applies session, domain, ACL, firewall, and domain-handler policies, while the adapter’s `sendToNapplet` is the published outbound seam. [VERIFIED: codebase-memory MCP]

```typescript
// Proposed IPC composition shape; not a new NAP wire API. [ASSUMED]
const runtime = createRuntime({
  ...hostAdapter,
  sendToNapplet(windowId, envelope) {
    const peer = connections.get(windowId);
    if (!peer?.ready || !peer.isCurrent()) return;
    peer.send(envelope);
  },
  isDomainAllowed(windowId, domain) {
    const peer = connections.get(windowId);
    return !!peer?.ready
      && peer.environment.capabilities.domains.includes(domain)
      && (hostAdapter.isDomainAllowed?.(windowId, domain) ?? true);
  },
});
```

### Pattern 2: Exact-Once, Source-Bound NAP-SHELL State

**What:** On the first exact `{ type: 'shell.ready' }` from the admitted peer, create one `SessionEntry` from the frozen registration’s `windowId`, `dTag`, and `aggregateHash`; cache its immutable environment; send exactly one `shell.init` to that peer; then mark it ready. A duplicate ready changes nothing. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md]

**When to use:** Before forwarding any non-shell envelope to the runtime. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md]

**IPC policy choice:** Reject or ignore a `shell.ready` with any payload keys besides `type`; it must never create a session or send `shell.init`. This is stricter than the carrier-neutral schema and should be recorded as an experimental IPC choice. [ASSUMED]

```typescript
// Mirrors the browser bridge's source-bound session pattern. [VERIFIED: codebase-memory MCP]
if (isExactBareShellReady(envelope)) {
  if (connection.ready) return;
  runtime.sessionRegistry.register(registration.windowId, {
    pubkey: '',
    windowId: registration.windowId,
    origin: 'ipc', // local experimental bookkeeping, never peer supplied [ASSUMED]
    type: 'nip5d',
    dTag: registration.dTag,
    aggregateHash: registration.aggregateHash,
    registeredAt: Date.now(),
    instanceId: randomUUID(),
    provenance: 'nip-5d',
  });
  connection.ready = true;
  connection.send({ type: 'shell.init', ...connection.environment });
  return;
}
if (!connection.ready) return;
runtime.handleMessage(registration.windowId, envelope);
```

### Pattern 3: Connection-Token-Guarded Teardown

**What:** Assign each admitted peer an opaque monotonically increasing connection token in the composition state. Every `close`, `error`, explicit unregister, endpoint close, and host close path calls one idempotent teardown function; it first proves the token is still active before destroying runtime state. [ASSUMED]

**When to use:** All terminal paths, including a delayed close emitted after a replacement endpoint was registered. [VERIFIED: Phase 107 endpoint registry]

**Order:** remove/retire the matching active connection → `runtime.destroyWindow(windowId)` → `runtime.sessionRegistry.unregister(windowId)` → let Phase 107 own socket/listener/path/directory cleanup. `destroyWindow` currently cleans subscriptions, INC state, and service handlers but deliberately does not unregister the session itself. [VERIFIED: codebase-memory MCP]

### Anti-Patterns to Avoid

- **Calling `endpoint.send(shell.init)` or using it for runtime egress:** the Phase 107 method broadcasts to every connected peer. Add a targeted opaque peer-send seam and retain broadcast behavior only for the generic transport API. [VERIFIED: codebase-memory MCP]
- **Forwarding `shell.ready` to `Runtime.handleMessage`:** NAP-SHELL is the composition handshake, not a runtime domain handler. [VERIFIED: codebase-memory MCP]
- **Registering a session on socket connect:** the authoritative transition is first `shell.ready`, after the receiver is live. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md]
- **Relying on private path permissions as authentication:** hostile same-UID processes remain out of the carrier threat model. [VERIFIED: Phase 107 SECURITY.md]
- **Altering `packages/shell` to share its browser `Window` implementation:** it violates the locked browser-unchanged boundary and creates a false common carrier abstraction. [VERIFIED: project CONTEXT.md]
- **Letting a close callback identify state by `windowId` alone:** a delayed old callback can erase a replacement session; require the connection token as well. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Domain dispatch / capability resolution | IPC-local NAP switch statement | `Runtime.handleMessage` | It preserves the established session, eligibility, ACL, firewall, service, and NAP-INC behavior. [VERIFIED: codebase-memory MCP] |
| ACL decisions | IPC-specific allowlist | `Runtime.aclState` through normal runtime dispatch | ACL is identity-bound to dTag/hash and has tested denial responses. [VERIFIED: codebase-memory MCP] |
| Session data store | Parallel IPC session registry | `Runtime.sessionRegistry` | Runtime handlers resolve identity/session by `windowId`. [VERIFIED: codebase-memory MCP] |
| Listener, decoder, queue, directory teardown | A second Unix-socket implementation | Phase 107 `createIpcTransport()` | Its framing, ownership, limits, and endpoint generations are already verified. [VERIFIED: Phase 107 VERIFICATION.md] |
| Targeted connection identity | Expose `net.Socket` to hosts | Opaque peer token/handle internal to shell-ipc | Keeps carrier internals and peer authority outside canonical messages. [ASSUMED] |

**Key insight:** Phase 108 is a small authority-binding adapter around existing subsystems, not another runtime. Its only domain-specific responsibility is to make the generic carrier’s accepted connection mean one host-attested NAP-SHELL session. [ASSUMED]

## Common Pitfalls

### Pitfall 1: `shell.init` leaks to a second peer

**What goes wrong:** A composition uses the existing endpoint broadcast send, so any concurrently accepted peer can receive another napplet’s environment or runtime response. [VERIFIED: codebase-memory MCP]

**How to avoid:** Add a targeted opaque peer-send API, make the composition admit only one peer, and test that a rejected second connection receives neither init nor runtime output. [ASSUMED]

### Pitfall 2: Pre-ready behavior accidentally depends on ACL defaults

**What goes wrong:** A pre-ready message may be allowed by permissive ACL defaults if the composition directly calls a handler or pre-registers a session. [VERIFIED: codebase-memory MCP]

**How to avoid:** Do not create `SessionEntry` until first bare ready; separately test that a valid capability envelope produces no service invocation, egress, or ACL audit before ready. [VERIFIED: codebase-memory MCP]

### Pitfall 3: Session cleanup misses NAP-INC and services

**What goes wrong:** Calling `sessionRegistry.unregister()` alone removes identity data but leaves subscriptions, channels, and service-owned resources. [VERIFIED: codebase-memory MCP]

**How to avoid:** Invoke `runtime.destroyWindow(windowId)` before unregistering the matching entry, then verify `inc.channel.closed` reaches a surviving peer where relevant. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-INC.md]

### Pitfall 4: Duplicate ready overwrites a session

**What goes wrong:** Each `shell.ready` creates a fresh `SessionEntry`/instance ID or resends init. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md]

**How to avoid:** The active connection’s `ready`/token state is the first check, before session registration or egress; assert identity, instance ID, and init count remain unchanged after duplicate ready. [ASSUMED]

### Pitfall 5: Close of an old socket tears down a replacement session

**What goes wrong:** Re-registration reuses `windowId`; an old socket’s delayed callback clears the map entry for that window. [VERIFIED: Phase 107 SUMMARY 03]

**How to avoid:** Compare both `windowId` and composition connection token; retain Phase 107 endpoint-generation checks for physical resources. [ASSUMED]

## Code Examples

### Targeted peer lifecycle extension

```typescript
// Proposed backwards-compatible carrier hook. [ASSUMED]
export interface IpcEndpointHooks {
  readonly onEnvelope: (
    envelope: NappletMessage,
    registration: IpcEndpointRegistration,
    peer: IpcPeer,
  ) => void;
  readonly onPeerConnected?: (
    peer: IpcPeer,
    registration: IpcEndpointRegistration,
  ) => boolean | void;
  readonly onPeerClosed?: (
    peer: IpcPeer,
    registration: IpcEndpointRegistration,
  ) => void;
}

// `IpcPeer` exposes send/close only; it never exposes host identity mutation. [ASSUMED]
```

### Public-runtime composition test seam

```typescript
// Test with a real runtime; no IPC-local dispatcher. [ASSUMED]
const projection = await createIpcShellProjection({ runtimeAdapter: hostAdapter });
const endpoint = await projection.registerEndpoint(registration);
const peer = await connect(endpoint.path);

peer.write(encodeJsonSequence({ type: 'storage.get', id: 'before-ready', key: 'x' }));
expect(storageHandler).not.toHaveBeenCalled();

peer.write(encodeJsonSequence({ type: 'shell.ready' }));
await expect(receiveFrame(peer)).resolves.toMatchObject({ type: 'shell.init' });

peer.write(encodeJsonSequence({ type: 'storage.get', id: 'after-ready', key: 'x' }));
await expect(receiveFrame(peer)).resolves.toMatchObject({ type: 'storage.get.result' });
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Generic Phase 107 transport accepts peers and invokes a carrier callback. | Phase 108 must add a composition owner that maps one admitted peer to one runtime session. | Carrier constraints remain reusable while shell semantics are explicit and testable. [ASSUMED] |
| Browser bridge maps `Window` source/registration identity to NAP-SHELL state. | IPC must map an opaque accepted-peer token plus frozen host registration to equivalent runtime state. | The authority source changes; NAP-SHELL invariants do not. [VERIFIED: codebase-memory MCP] |

**Deprecated/outdated:** Do not use the browser bridge as an IPC transport adapter; it depends on `MessageEvent.source`, `originRegistry`, and `Window.postMessage`, all outside the locked IPC boundary. [VERIFIED: codebase-memory MCP]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createIpcShellProjection()` is the right public API name and should construct the runtime from a `RuntimeAdapter`. | Summary / Patterns | Planner may choose a different but equivalent factory shape; no protocol impact. |
| A2 | Rejecting, rather than replacing, a concurrent peer is the desired single-peer policy. | Standard Stack / Pitfalls | Host reconnect UX may need an explicit replacement protocol later. |
| A3 | An opaque `IpcPeer` lifecycle hook is the smallest compatible transport extension. | Patterns | A different internal hook can meet the same invariant if it preserves existing API behavior. |
| A4 | `origin: 'ipc'` is suitable local `SessionEntry` bookkeeping. | Pattern 2 | It is an IPC spec-gap value and must not become wire-visible or identity authority. |

## Open Questions

1. **Should malformed/payload-bearing `shell.ready` close the peer or be silently ignored?**
   - What we know: NAP-SHELL defines a bare message; the Phase 107 decoder already fails closed on malformed carrier input. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md] [VERIFIED: Phase 107 VERIFICATION.md]
   - What's unclear: The pinned NAP does not prescribe an IPC terminal-error policy for otherwise canonical extra payload fields. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md]
   - Recommendation: Ignore without establishing a session and emit a redacted diagnostic; reserve terminal close for carrier-invalid data and identity-claim violations. [ASSUMED]

2. **Should Phase 108 update public package README/docs and add a Changeset?**
   - What we know: AGENTS.md normally requires docs alongside public code, but the context assigns publishable package quality, complete docs, and Changeset work to Phase 109. [VERIFIED: AGENTS.md] [VERIFIED: project CONTEXT.md]
   - Recommendation: Keep Phase 108 to exported JSDoc and no release metadata; Phase 109 must document the final public surface and add the Changeset after the proof stabilizes it. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Unix sockets, `node:crypto`, tests | ✓ | `v26.7.0` | Package engine remains Node `>=20`. [VERIFIED: local environment] |
| pnpm | Workspace build/type/test commands | ✓ | `10.8.0` | — [VERIFIED: local environment] |
| Vitest | Focused and full unit tests | ✓ | `4.1.2` | — [VERIFIED: local environment] |
| POSIX Unix-domain sockets | Raw socket lifecycle integration tests | ✓ | macOS host | No fallback in locked scope. [VERIFIED: project CONTEXT.md] |

**Missing dependencies with no fallback:** None detected. [VERIFIED: local environment]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.2` [VERIFIED: local environment] |
| Config file | `vitest.config.ts` [VERIFIED: codebase files] |
| Quick run command | `pnpm --filter @kehto/shell-ipc test:unit` [VERIFIED: packages/shell-ipc/package.json] |
| Full suite command | `pnpm test:unit` [VERIFIED: package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BIND-02 | Second peer rejected; delayed old close cannot clear new session. | raw-socket integration + deterministic lifecycle unit | `pnpm vitest run packages/shell-ipc/src/runtime-composition.test.ts` | ❌ Wave 0 |
| BIND-03 | Exact bare ready makes one source-bound session/init; pre-ready and malformed ready are inert. | raw-socket integration | `pnpm vitest run packages/shell-ipc/src/runtime-composition.test.ts` | ❌ Wave 0 |
| BIND-04 | End/error/unregister/host-close execute matching runtime cleanup only. | raw-socket integration + spies | `pnpm vitest run packages/shell-ipc/src/runtime-composition.test.ts` | ❌ Wave 0 |
| PROOF-01 | Runtime adapter egress reaches only active peer; no runtime/browser code is changed. | integration + static boundary guard | `pnpm vitest run packages/shell-ipc/src/runtime-composition.test.ts` | ❌ Wave 0 |
| PROOF-04 | ACL deny, domain deny, source identity, NAP-INC cleanup, and handshake idempotency match runtime behavior. | integration | `pnpm vitest run packages/shell-ipc/src/runtime-composition.test.ts tests/unit/nap-inc-conformance.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @kehto/shell-ipc test:unit` [VERIFIED: packages/shell-ipc/package.json]
- **Per wave merge:** `pnpm type-check && pnpm test:unit` [VERIFIED: package.json]
- **Phase gate:** `pnpm build && pnpm type-check && pnpm test:unit`, plus relevant NAP conformance tests and the configured AI-slop gate. [VERIFIED: AGENTS.md]

### Wave 0 Gaps

- [ ] `packages/shell-ipc/src/runtime-composition.test.ts` — raw socket fixtures for BIND-02/03/04 and PROOF-01/04. [ASSUMED]
- [ ] `packages/shell-ipc/src/runtime-composition.ts` — composition state machine and public API. [ASSUMED]
- [ ] Focused static guard proving Phase 108 does not modify `packages/runtime` or `packages/shell`; use an explicit changed-file assertion in plan verification rather than an invented runtime behavior. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes, bounded | Host registration establishes projected identity; explicitly do not claim same-UID peer authentication. [VERIFIED: Phase 107 SECURITY.md] |
| V3 Session Management | Yes | First bare ready creates one token-bound session; terminal paths destroy only the matching one. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md] |
| V4 Access Control | Yes | Existing runtime domain eligibility, ACL, firewall, and recipient checks remain authoritative. [VERIFIED: codebase-memory MCP] |
| V5 Input Validation | Yes | Phase 107 bounded decoder plus exact readiness schema before session mutation. [VERIFIED: Phase 107 VERIFICATION.md] |
| V6 Cryptography | No new control | No new crypto protocol; random IDs must not be represented as peer authentication. [ASSUMED] |

### Known Threat Patterns for IPC Runtime Composition

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Concurrent peer receives active session output | Information Disclosure / Spoofing | Reject second peer before ingress; use targeted peer egress, not endpoint broadcast. [ASSUMED] |
| Delayed old close clears new session | Tampering / Denial of Service | Require current connection token before `destroyWindow`/`unregister`; retain Phase 107 endpoint-generation guards. [ASSUMED] |
| Ready payload rebinds identity/capabilities | Spoofing / Elevation of Privilege | Require exact bare ready; source dTag/hash/environment comes only from frozen host registration. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md] |
| Capability call reaches service before readiness | Elevation of Privilege | Composition pre-gate plus runtime’s session-first `handleMessage` gate. [VERIFIED: codebase-memory MCP] |
| Disconnect leaves INC channels/services live | Denial of Service / Tampering | `destroyWindow` before session unregister; verify surviving endpoint receives normal NAP-INC teardown where applicable. [VERIFIED: codebase-memory MCP] |
| Same-UID local process impersonates a peer | Spoofing | Keep the explicit out-of-scope carrier limitation; do not market permissions/path secrecy as authentication. [VERIFIED: Phase 107 SECURITY.md] |

## Recommended Plan Split

### Plan 108-01: Carrier peer lifecycle seam and compatibility

1. Add optional opaque peer connect/close/targeted-send capability to `types.ts` and `ipc-shell.ts`; preserve current `createIpcTransport`, `IpcEndpoint.send()` broadcast semantics, root exports, framing, queue, and endpoint-generation tests. [ASSUMED]
2. Add tests for first-peer acceptance, second-peer rejection, targeted FIFO egress, and old peer close after a new endpoint generation. [ASSUMED]
3. Verify the Phase 107 focused transport suite still passes unchanged. [VERIFIED: packages/shell-ipc/package.json]

### Plan 108-02: IPC NAP-SHELL/runtime composition

1. Add `@kehto/runtime: workspace:^` to `packages/shell-ipc/package.json`, refresh `pnpm-lock.yaml`, then add a composition factory/state registry in `runtime-composition.ts` that creates the runtime with adapter-owned egress/domain eligibility and uses only public `Runtime`/`SessionRegistry` methods. [VERIFIED: workspace package manifests] [ASSUMED]
2. Implement exact bare ready, host-bound `SessionEntry`, single targeted `shell.init`, duplicate idempotency, and pre-ready inertness. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md]
3. Keep all IPC metadata/token state private and never mutate/rewrite canonical envelopes. [VERIFIED: project CONTEXT.md]

### Plan 108-03: Lifecycle, ACL/eligibility, and NAP-INC parity tests

1. Add real `node:net` integration tests using a real runtime adapter fixture for session, source identity, ACL deny, domain deny, and runtime output delivery. [ASSUMED]
2. Exercise graceful `end`, abrupt `destroy`, explicit endpoint unregister, projection close, duplicate ready, stale delayed close, and replacement endpoint scenarios. [ASSUMED]
3. Assert runtime cleanup uses `destroyWindow` plus `sessionRegistry.unregister`, including NAP-INC subscription/channel cleanup, while browser shell source files remain untouched. [VERIFIED: codebase-memory MCP]

## Sources

### Primary (HIGH confidence)

- `packages/runtime/src/types.ts`, `runtime.ts`, `session-registry.ts`, `enforce.ts` — public adapter/runtime/session APIs and ordering of session, eligibility, ACL, firewall, and dispatch. [VERIFIED: codebase-memory MCP]
- `packages/shell-ipc/src/ipc-shell.ts`, `types.ts`, `endpoint-registry.ts` and Phase 107 test/verification/security artifacts — present carrier behavior, broadcast egress, resource ownership, and threat boundary. [VERIFIED: codebase-memory MCP]
- [NAP-SHELL at pinned commit](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md) — normative carrier-neutral handshake rules. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md]
- [NAP-INC at pinned commit](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-INC.md) — authenticated endpoint attribution and endpoint-destruction lifecycle expectations. [CITED: https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-INC.md]

### Secondary (MEDIUM confidence)

- None. Context7 was selected by the research seam but neither Context7 MCP nor the `ctx7` CLI is available; the checked pinned local authoritative source was used instead. [VERIFIED: local environment]

### Tertiary (LOW confidence)

- Proposed composition factory/peer-token API and strict malformed-ready handling are explicitly marked `[ASSUMED]` pending implementation design confirmation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies are existing workspace/public APIs verified in code. [VERIFIED: codebase-memory MCP]
- Architecture: HIGH for boundaries and runtime behavior; MEDIUM for the exact new composition API. [VERIFIED: codebase-memory MCP] [ASSUMED]
- Pitfalls: HIGH for current broadcast/session/cleanup behavior; MEDIUM for recommended new rejection/token policies. [VERIFIED: codebase-memory MCP] [ASSUMED]

**Research date:** 2026-08-18
**Valid until:** 2026-09-17 for the checked local code and pinned specification revision.
