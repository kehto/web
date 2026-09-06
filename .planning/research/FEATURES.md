# Feature Research

**Domain:** Experimental shell projection over Unix-domain sockets
**Researched:** 2026-08-18
**Confidence:** MEDIUM — transport mechanics are established, but projection semantics are intentionally being discovered

## Feature Landscape

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Explicit stream framing | Unix stream sockets do not preserve message boundaries | MEDIUM | Encode each canonical NIP-5D envelope as an RFC 7464 JSON text sequence element. |
| Incremental parsing | Frames may be split or coalesced across reads | MEDIUM | Cover partial, combined, malformed, oversized, and truncated frames. |
| Host-bound endpoint identity | NAP-SHELL and NAP-INC forbid trusting peer-supplied identity | HIGH | Bind identity before connection; `shell.ready` remains a bare liveness signal. |
| NAP-SHELL lifecycle parity | All capability traffic depends on exactly one `shell.ready` → `shell.init` transition | HIGH | Duplicate ready is idempotent and pre-ready traffic is inert. |
| Bidirectional envelope delivery | Requests/results and host-originated pushes use the same projection | MEDIUM | Route ingress to `Runtime.handleMessage` and runtime output to the bound socket. |
| Connection teardown | A disconnected process must not leave a live runtime endpoint | MEDIUM | Invoke runtime window destruction, close queues, and remove socket resources. |
| Backpressure and resource bounds | An untrusted or stalled process can otherwise grow host memory | HIGH | Bound frames/queues and respect `socket.write()` / `drain`. |
| Observable failures | Experimental projection findings need diagnosable evidence | LOW | Surface listen, accept, parse, policy, write, disconnect, and cleanup events without leaking secrets. |
| Runnable process proof | The milestone exists to validate a draft, not just unit-level abstractions | MEDIUM | Real host and raw-client napplet processes exercise handshake, request/result, push, and teardown. |
| Drafting evidence | Implementation decisions must feed `napplet/naps` | MEDIUM | Record settled choices, alternatives, security assumptions, and unresolved gaps. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Runtime parity matrix | Proves that the carrier changes while protocol behavior does not | MEDIUM | Compare IPC and web projections for envelope shape, direction, lifecycle, identity, and teardown. |
| Dependency-free transport | Makes the experiment easy to inspect and reuse | LOW | Node built-ins plus existing Kehto/Napplet packages only. |
| Raw-client interoperability fixture | Demonstrates the wire without a Kehto client library | MEDIUM | The napplet fixture uses only `node:net`, JSON parsing, and explicit framing. |
| Spec-gap ledger | Prevents prototype behavior from becoming accidental protocol authority | LOW | Classify each behavior as inherited NAP rule, projection choice, or unresolved question. |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Shared multiplexed socket in v1.30 | One listener appears simpler operationally | Requires authentication, endpoint routing, collision rules, and replay handling before runtime ACL can trust identity | One dedicated host-bound socket per endpoint. |
| Napplet-supplied identity handshake | Easy to serialize next to `shell.ready` | Violates NAP-SHELL's rule that identity is assigned out of band | Host registration supplies immutable identity. |
| Injected napplet API | Mirrors the web shim | User explicitly excluded interface injection and it would conflate transport proof with SDK design | Raw socket operations in the fixture. |
| Full NAP-domain demo catalog | Broad proof feels comprehensive | Obscures the carrier experiment and duplicates runtime coverage | Representative request/result plus host push and lifecycle proof. |
| Windows named-pipe support | Broadens platform claims | Adds distinct path/security semantics before the projection is understood | POSIX pathname sockets only. |
| Automatic reconnect | Improves convenience | Can accidentally preserve stale identity/session state across a new process lifecycle | Explicit host re-registration creates a new endpoint lifecycle. |

## Feature Dependencies

```text
Framing + bounds
    └──enables──> bidirectional transport
                       └──enables──> NAP-SHELL lifecycle
                                          └──enables──> runtime request/result + push

Host-bound identity ──gates──> session registration ──gates──> all runtime dispatch

Lifecycle + real transport ──enables──> runnable process proof ──produces──> drafting evidence
```

### Dependency Notes

- **Runtime dispatch requires session registration:** `createMessageHandler` drops all envelopes before a source-bound session exists.
- **Session registration requires host identity:** `shell.ready` cannot carry identity or capabilities.
- **Process proof requires framing and teardown:** happy-path socket writes alone do not validate a stream projection.
- **Drafting evidence depends on implementation results:** the document should distinguish preselected policy from behavior learned during the spike.

## MVP Definition

### Launch With (v1.30)

- [ ] Publishable experimental `@kehto/shell-ipc` package with explicit stability warning.
- [ ] Dedicated private Unix socket per host-registered endpoint.
- [ ] RFC 7464 encoder/decoder with bounded input and fail-closed error handling.
- [ ] Source-bound NAP-SHELL handshake and unchanged runtime dispatch.
- [ ] Backpressure-aware outbound delivery and deterministic cleanup.
- [ ] Runnable raw-client process proving handshake, request/result, push, and disconnect.
- [ ] IPC projection findings document suitable as input to a future `napplet/naps` draft.

### Add After Validation

- [ ] Shared-socket multiplexing — only after an authenticated connection binding is specified.
- [ ] Client helper — only if raw-client ergonomics become an explicit goal.
- [ ] More host runtimes/languages — after the framing and lifecycle contract stabilizes.

### Future Consideration

- [ ] Windows named pipes — separate portability and security validation.
- [ ] Peer-credential attestation — requires platform adapters and a specified fallback.
- [ ] Binary payload frames or descriptor passing — only if real NAP traffic demonstrates need.
- [ ] Automatic reconnect/resume — requires lifecycle and replay semantics.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Host-bound identity and handshake | HIGH | HIGH | P1 |
| Framing, bounds, and backpressure | HIGH | MEDIUM | P1 |
| Runtime request/result and push | HIGH | MEDIUM | P1 |
| Runnable process proof | HIGH | MEDIUM | P1 |
| Drafting evidence | HIGH | MEDIUM | P1 |
| Shared socket | LOW for experiment | HIGH | P3 |
| Client helper | LOW for approved scope | MEDIUM | P3 |

## Sources

- `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, especially NAP-SHELL and NAP-INC security considerations.
- https://nodejs.org/download/release/latest-v20.x/docs/api/net.html — stream IPC lifecycle and backpressure behavior.
- https://www.rfc-editor.org/info/rfc7464/ — incremental JSON sequence framing and malformed-element considerations.
- Kehto knowledge graph — current web transport and runtime session gates.

---
*Feature research for: Experimental NIP-5D Unix IPC projection*
*Researched: 2026-08-18*
