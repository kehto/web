# Experimental IPC Projection

Status: experimental drafting evidence; not normative protocol text.

## Checked authority and scope

This record checked
[`napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`](https://github.com/napplet/naps/tree/c0f7dd14460622fc3a9870ea57a538474cf776fa),
including [NAP-SHELL](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-SHELL.md)
and [NAP-INC](https://github.com/napplet/naps/blob/c0f7dd14460622fc3a9870ea57a538474cf776fa/naps/NAP-INC.md).
That object **defines no IPC carrier**. The POSIX implementation in
`@kehto/shell-ipc` is therefore evidence for an upstream discussion, not a new
NAP, client API, authentication mechanism, or platform contract.

The executable evidence is the [reference host](https://github.com/kehto/web/blob/main/packages/shell-ipc/examples/ipc-projection-reference-host.mjs),
its [raw Node process](https://github.com/kehto/web/blob/main/packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs),
and the [process proof](https://github.com/kehto/web/blob/main/packages/shell-ipc/src/ipc-projection-process.test.ts).
They demonstrate a canonical request/result and runtime-originated push without
a napplet helper or injected interface.

## Web/IPC responsibility matrix

The classification column intentionally uses only **shared**,
**carrier-specific**, **intentionally absent**, and **unresolved**. It describes
current evidence, not future commitments.

| Responsibility | Web projection | Experimental POSIX IPC projection | Classification |
|---|---|---|---|
| Canonical object envelopes | NIP-5D object envelope | Same canonical object envelope after carrier decoding | shared |
| NAP-SHELL bare-ready / one-init / pre-ready lifecycle | Shell receiver and parent delivery | Exact bare ready, one init, no pre-ready capability dispatch | shared |
| Host-bound source identity | Creation-time shell identity | Host-frozen registration; peer claims rejected | shared |
| ACL/capability recipient eligibility | Runtime routes to eligible iframe | Runtime routes only to the eligible ready IPC peer | shared |
| NAP-INC authenticated-endpoint/lifecycle semantics | Shell-mediated endpoint lifecycle | Runtime lifecycle and cleanup semantics; carrier authentication/binding mechanism is separate | shared |
| Browser source trust | Browser parent/source relationship | Not a socket-peer authentication mechanism | carrier-specific |
| Browser interface injection | `window.napplet.*` web projection | No injected interface | intentionally absent |
| Browser `postMessage` | Web carrier | No browser message path | intentionally absent |
| RFC 7464 framing | Not the web carrier | RS + UTF-8 JSON object + LF framing | carrier-specific |
| Dedicated private pathname naming/distribution | Not applicable | Short dedicated POSIX pathname held and distributed by host | carrier-specific |
| One active peer and targeted egress | Browser window target | One current peer per endpoint; runtime egress targets it | carrier-specific |
| Local peer authentication / hostile same-UID resistance | Browser projection has different source boundary | Private paths and permissions do not authenticate a local peer | unresolved |
| Finite limits and terminal errors | Web projection has its own limits | Frame, input-buffer, queue, and pathname limits; malformed/limit input is terminal | carrier-specific |
| Windows | Browser support is separate | No named-pipe implementation | intentionally absent |
| Remote transport | Web transport is not remote IPC | No TCP, WebSocket, or remote IPC | unresolved |
| Broker/shared-listener multiplexing | Not part of this projection evidence | No broker or shared-listener implementation | intentionally absent |

## Carrier-neutral invariants preserved

The following are NAP-SHELL/NAP-INC/runtime responsibilities that the evidence
preserves, independent of a carrier byte format:

- The host attests identity from creation-time registration; `shell.ready` is
  bare and never supplies peer-selected identity or capabilities.
- The first exact readiness signal establishes the host-bound session and sends
  one `shell.init`; duplicate ready is idempotent, and no capability message is
  serviced before readiness.
- Messages remain canonical object envelopes in their specified directions.
- Runtime routing and service-originated delivery continue to require ACL and
  capability/environment eligibility for the recipient.
- A matching endpoint lifecycle cleanup tears down the session and keeps the
  runtime lifecycle semantics available to surviving endpoints.

## Experimental carrier choices recorded by Kehto

These are bounded implementation choices, not NAP authority:

- RFC 7464 JSON Text Sequences provide local framing.
- The host creates a short, dedicated private pathname and distributes that
  pathname out of band; registration is frozen before listener allocation.
- The local trust boundary is host-operated POSIX process integration. One
  endpoint admits one active peer and runtime egress is targeted to that peer.
- Malformed frames, peer binding claims, and limit failures are terminal;
  frame, buffer, queue, and pathname resources are finite. Host diagnostics are
  redacted.
- Teardown is generation-matched, so stale close work cannot destroy a later
  same-window endpoint.

Private directory permissions and a secret-looking pathname are operational
containment only. They do **not** authenticate a peer, authorize it, prove a
cryptographic identity, or protect against a hostile same-UID process.

## Unresolved upstream drafting questions

An upstream IPC projection would need explicit decisions on:

1. Carrier identification and versioning.
2. Authenticated local-peer binding and the threat model for same-UID adversaries.
3. Error signaling and whether numeric limit negotiation is part of the carrier.
4. Endpoint discovery and secure distribution semantics.
5. Whether and how multiplexing or broker/shared-listener topology is allowed.
6. Windows named-pipe parity.
7. Remote transports and their authentication, authorization, and lifecycle model.

Until those questions are specified, neither browser `postMessage` nor browser
interface injection is IPC parity, and no helper SDK, remote endpoint, Windows
support, or broker should be inferred from this experimental implementation.
