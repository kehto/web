# Project Research Summary

**Project:** Kehto Runtime — v1.30 Experimental IPC Shell Projection
**Domain:** NIP-5D over POSIX Unix-domain sockets
**Researched:** 2026-08-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

The safest useful experiment is a new Node-only `@kehto/shell-ipc` package that projects unchanged NIP-5D envelopes over pathname Unix-domain stream sockets. It should reuse `@kehto/runtime` rather than modify dispatch semantics. The current runtime already supplies the key transport seam: ingress is `Runtime.handleMessage(windowId, envelope)`, egress is `RuntimeAdapter.sendToNapplet`, and lifecycle cleanup is exposed through `destroyWindow` and the session registry.

For v1.30, each napplet endpoint should receive a dedicated socket created and identity-bound by the host. This avoids inventing an authentication/multiplexing handshake. The peer sends a bare `shell.ready`; only then does the shell establish the source-bound session and return exactly one `shell.init`. The reference napplet uses raw `node:net` primitives, proving that the projection is independently implementable and does not depend on interface injection or a Kehto client helper.

The main risks are stream framing, local-process impersonation, unbounded buffering, and cleanup races. Use bounded RFC 7464 JSON text sequences, private short-lived socket directories, one active connection per endpoint, backpressure-aware ordered writes, and generation-bound teardown. The output must be framed as implementation evidence: `napplet/naps` master `c0f7dd14460622fc3a9870ea57a538474cf776fa` contains carrier-neutral identity rules but no IPC projection document.

## Key Findings

### Recommended Stack

**Core technologies:**
- Node.js >=20 built-ins (`node:net`, `node:fs/promises`, `node:path`, `node:os`) — sufficient for POSIX UDS transport and lifecycle.
- TypeScript ^5.9.3 + tsup — matches all Kehto packages.
- `@kehto/runtime` current workspace line — retains dispatch, ACL, firewall, subscriptions, and teardown.
- `@napplet/core >=0.31.0 <0.32.0` — canonical `NappletMessage` envelope types.
- RFC 7464 JSON text sequences — explicit incremental stream framing.

No new third-party production dependency is recommended.

### Expected Features

**Must have:**
- Explicit bounded framing with partial/coalesced read handling.
- Host-bound immutable endpoint identity.
- NAP-SHELL ready/init lifecycle parity.
- Bidirectional runtime transport with ordered backpressure-aware writes.
- Deterministic runtime/socket cleanup.
- Real raw-client process proof.
- Projection findings and spec-gap ledger.

**Should have:**
- Web-vs-IPC parity matrix for mandatory invariants.
- Structured diagnostics for experimental evidence.
- Dependency-free raw-client fixture.

**Defer:**
- Shared-socket multiplexing and connection authentication.
- Client helper/interface injection.
- Windows named pipes, Tauri, Electron, peer credentials, binary frames, and automatic reconnect.

### Architecture Approach

The host registers an endpoint with immutable `{ windowId, dTag, aggregateHash }` and a per-napplet environment. `@kehto/shell-ipc` creates a dedicated socket inside a private directory and binds any accepted connection to that registration. A bounded RFC 7464 codec turns bytes into NIP-5D envelopes. `shell.ready` is handled locally; all later ingress enters the existing runtime. Runtime egress resolves the live endpoint and enters an ordered write queue. Close/error/unregister uses a registration generation to tear down only the matching runtime session and socket resources.

**Major components:**
1. JSON-sequence codec — framing, validation, and input bounds.
2. Socket directory/listener — private path lifecycle and one-client policy.
3. Endpoint registry — host identity, generation, and live connection.
4. NAP-SHELL coordinator — ready/init and environment gating.
5. Runtime composition — ingress, egress, eligibility, and teardown.
6. Process fixture and findings — executable proof and draft input.

### Critical Pitfalls

1. **Assuming one read equals one message** — use and exhaustively test incremental framing.
2. **Accepting identity from the peer** — bind host identity before reading the first byte.
3. **Treating socket permissions as portable authentication** — use a private directory and document the same-user threat boundary.
4. **Ignoring backpressure or frame bounds** — close deterministically on configured overflow.
5. **Leaving runtime state after disconnect** — generation-bound `destroyWindow` and session cleanup are mandatory.
6. **Unsafe stale-path deletion** — clean only resources owned inside the instance directory.

## Implications for Roadmap

### Phase 107: Projection Contract and Transport Foundation

**Rationale:** Framing, limits, and host-bound identity are foundational and must be explicit before runtime composition.

**Delivers:** `@kehto/shell-ipc` package skeleton, RFC 7464 codec, endpoint types/registry, private socket lifecycle, and adversarial unit tests.

**Avoids:** Chunk/message confusion, oversized inputs, global paths, and identity claims from wire data.

### Phase 108: NAP-SHELL and Runtime Composition

**Rationale:** Once the transport is trustworthy, connect it to existing runtime/session semantics without changing the canonical envelopes.

**Delivers:** Bare ready/exactly-one init, pre-session gating, immutable environment binding, runtime ingress/egress, backpressure, teardown, and web-parity guards.

**Avoids:** Session drift, premature capability traffic, duplicate dispatch logic, and late-close replacement races.

### Phase 109: Runnable Proof and Drafting Evidence

**Rationale:** The milestone succeeds only when an independent raw peer works across a real process boundary and the learned contract is documented.

**Delivers:** Raw `node:net` napplet fixture, reference host, request/result + host-push + disconnect proof, package/docs/changeset completeness, and `IPC-PROJECTION-FINDINGS.md` with upstream ref and open questions.

**Avoids:** Unit-only false confidence and accidental presentation of prototype choices as NAP authority.

### Phase Ordering Rationale

- Security and framing choices precede the shell handshake because identity and message boundaries are prerequisites for session establishment.
- Runtime composition precedes the process fixture so the real proof exercises production package seams rather than fixture-only logic.
- Findings are finalized after implementation so they capture observed constraints and not only design assumptions.

### Research Flags

Phases needing deeper planning research:
- **Phase 107:** Select and document concrete default frame/queue limits after auditing active envelope sizes, especially resource payloads.
- **Phase 108:** Decide whether transport-neutral NAP-SHELL helpers should be shared from `@kehto/shell` or parity-locked within `@kehto/shell-ipc` without introducing a runtime change.
- **Phase 109:** Define the exact artifact format suitable for proposing an IPC projection upstream.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Node and Kehto seams are documented and directly inspected. |
| Features | MEDIUM-HIGH | Security/lifecycle table stakes are clear; protocol policy remains experimental. |
| Architecture | HIGH | Existing runtime APIs support a separate transport projection without a dispatcher rewrite. |
| Pitfalls | HIGH | Backed by Node docs, RFC 7464, Unix socket documentation, and current NAP identity rules. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- No authoritative IPC projection exists. Every carrier-specific choice must remain explicitly experimental.
- Default maximum frame and write-queue sizes need active-envelope evidence.
- Unix socket filesystem permissions do not provide portable cryptographic peer authentication; the threat model must say what host-controlled process topology guarantees.
- Whether any transport-neutral NAP-SHELL code should be extracted from the browser shell is an implementation decision for phase planning, not assumed here.

## Sources

### Primary

- `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa` — NAP-SHELL and NAP-INC; confirmed no IPC projection file exists.
- https://nodejs.org/download/release/latest-v20.x/docs/api/net.html — Unix IPC paths, lifecycle, path limits, stale sockets, and backpressure.
- https://www.rfc-editor.org/info/rfc7464/ — JSON text sequence framing and parser security.
- https://man7.org/linux/man-pages/man7/unix.7.html — pathname socket portability, permissions, and peer credential limitations.
- Kehto code knowledge graph — `createShellBridge`, `adaptHooks`, `createMessageHandler`, `handleShellReady`, session registry, and destroy paths.

---
*Research completed: 2026-08-18*
*Ready for roadmap: yes*
