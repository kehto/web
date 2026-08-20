# Requirements: v1.30 Experimental IPC Shell Projection

**Defined:** 2026-08-18
**Core Value:** Provide a modular, framework-agnostic runtime for hosting napplet applications.

## Authority and Boundary

- Specification checked: `napplet/naps` `origin/master` at
  `c0f7dd14460622fc3a9870ea57a538474cf776fa`.

- No IPC projection exists at that ref. This milestone is an experimental
  specification-gap implementation, not a claim of normative NIP-5D behavior.

- Carrier-neutral NAP-SHELL and NAP-INC invariants remain authoritative:
  runtime-attested endpoint identity, one bare `shell.ready`, exactly one
  `shell.init`, and no capability traffic before session establishment.

- Scope is a Node.js shell projection over POSIX pathname Unix-domain stream
  sockets. The existing browser/postMessage shell remains unchanged.

## v1.30 Requirements

### IPC Transport

- [x] **IPC-01**: A host integrator can create one dedicated pathname Unix-domain socket endpoint per napplet registration inside a short, private directory, with guarded stale-path handling and owned-resource cleanup.
- [x] **IPC-02**: A raw socket peer can exchange unchanged canonical NIP-5D JSON envelopes through an RFC 7464 JSON text-sequence codec that correctly handles partial and coalesced stream chunks.
- [x] **IPC-03**: The projection rejects malformed, truncated, invalid-UTF-8, and oversized frames without dispatching them, and applies documented finite frame and buffer limits.
- [x] **IPC-04**: Runtime egress preserves per-endpoint message order while respecting socket backpressure and a documented finite outbound-queue limit.

### Identity and Lifecycle

- [x] **BIND-01**: A host integrator registers immutable `windowId`, napplet dTag, aggregate hash, and environment metadata before listening; a peer cannot supply or replace its projected identity through wire messages.
- [x] **BIND-02**: Each registered endpoint admits at most one active peer, and connection replacement or delayed close events cannot tear down a newer registration or session.
- [x] **BIND-03**: A connected peer establishes its session with one bare `shell.ready`, receives exactly one `shell.init`, and cannot access capability handlers before readiness.
- [x] **BIND-04**: Graceful close, abrupt disconnect, explicit unregister, and host shutdown tear down only the matching runtime session, connection, listener, socket path, and owned directory resources.

### Runtime Proof

- [x] **PROOF-01**: A host integrator can compose `@kehto/shell-ipc` with the public `@kehto/runtime` transport seam while leaving runtime dispatch, canonical envelope shapes, and the browser `@kehto/shell` implementation unchanged.
- [ ] **PROOF-02**: A reference host and napplet process complete at least one correlated NIP-5D request/result round trip over the Unix-domain socket.
- [ ] **PROOF-03**: The reference host delivers at least one runtime-originated push message to the connected napplet process over the same projection.
- [x] **PROOF-04**: Automated parity tests prove runtime ACL, capability eligibility, source identity, handshake idempotency, and session lifecycle behavior remain enforced through the IPC projection.
- [ ] **PROOF-05**: The reference napplet process uses only raw Node.js `node:net` and local framing code, with no injected `window.napplet.*` interface and no Kehto napplet-side helper dependency.

### Experimental Evidence

- [ ] **SPEC-01**: `@kehto/shell-ipc` is a publishable ESM package whose public API, README, package documentation, and stability warning clearly identify the projection as Node/POSIX-only and experimental.
- [ ] **SPEC-02**: A web/IPC parity matrix records which NIP-5D and NAP-SHELL responsibilities are shared, carrier-specific, intentionally absent, or unresolved.
- [ ] **SPEC-03**: A drafting findings document records the exact `napplet/naps` ref checked plus framing, endpoint naming, identity binding, trust boundaries, lifecycle, errors, limits, security assumptions, and unresolved specification questions suitable for upstream discussion.
- [ ] **SPEC-04**: The package ships with focused unit and process-integration coverage, a Changeset, synchronized package docs, and passing repository build, type-check, unit, relevant end-to-end, docs, and AI-slop gates.

## Future Requirements

### Additional Projections

- **FUTR-01**: A Windows named-pipe projection provides equivalent lifecycle and identity guarantees.
- **FUTR-02**: A standardized authenticated multiplexing contract permits multiple napplets to share one IPC listener safely.
- **FUTR-03**: A separately scoped napplet-side IPC SDK or interface projection is available after an upstream contract defines it.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Changes to browser `@kehto/shell` or its `postMessage` carrier | This milestone validates a separate shell projection and must not destabilize the existing web projection. |
| `window.napplet.*` or another injected interface | The user explicitly excluded interface injection; the raw process fixture proves the wire directly. |
| Tauri or Electron integration | The experiment targets Node.js POSIX IPC without a desktop framework dependency. |
| Windows named pipes or other non-POSIX transports | A portable cross-platform transport would broaden the experiment before the core projection is validated. |
| Shared listener, peer-selected identity, or custom authentication handshake | A dedicated host-bound endpoint avoids inventing unauthoritative multiplexing and authentication protocol. |
| TCP, WebSocket, or remote-network IPC | The trust and lifecycle model is intentionally bounded to local pathname Unix-domain sockets. |
| Declaring the experiment a normative NIP-5D projection | `napplet/naps` contains no IPC projection at the checked ref; findings are input to future specification work. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IPC-01 | Phase 107 | Complete |
| IPC-02 | Phase 107 | Complete |
| IPC-03 | Phase 107 | Complete |
| IPC-04 | Phase 107 | Complete |
| BIND-01 | Phase 107 | Complete |
| BIND-02 | Phase 108 | Complete |
| BIND-03 | Phase 108 | Complete |
| BIND-04 | Phase 108 | Complete |
| PROOF-01 | Phase 108 | Complete |
| PROOF-02 | Phase 109 | Pending |
| PROOF-03 | Phase 109 | Pending |
| PROOF-04 | Phase 108 | Complete |
| PROOF-05 | Phase 109 | Pending |
| SPEC-01 | Phase 109 | Pending |
| SPEC-02 | Phase 109 | Pending |
| SPEC-03 | Phase 109 | Pending |
| SPEC-04 | Phase 109 | Pending |

**Coverage:**

- v1.30 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-18*
*Last updated: 2026-08-18 after v1.30 roadmap creation*
