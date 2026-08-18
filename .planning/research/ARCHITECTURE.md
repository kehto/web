# Architecture Research

**Domain:** Host-side NIP-5D projection over Unix-domain sockets
**Researched:** 2026-08-18
**Confidence:** HIGH for Kehto integration; MEDIUM for the experimental wire contract

## Recommended Architecture

### System Overview

```text
Host process
┌─────────────────────────────────────────────────────────────┐
│ @kehto/ipc                                                 │
│  endpoint registry ──> private UDS listener per endpoint   │
│       │                         │                           │
│       │ host identity          │ RFC 7464 codec + bounds   │
│       v                         v                           │
│  NAP-SHELL coordinator ──> @kehto/runtime                  │
│  shell.ready/init             handleMessage/sendToNapplet  │
└──────────────────────────────────────┬──────────────────────┘
                                       │ pathname socket
                                       │ canonical envelopes
┌──────────────────────────────────────v──────────────────────┐
│ Reference napplet process                                  │
│ node:net raw client + inline RFC 7464 encode/decode         │
│ no @kehto/ipc client helper, no injected interface          │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Endpoint registry | Own immutable `{ windowId, dTag, aggregateHash }`, socket path, generation, and connection state | Map scoped to one IPC shell instance; host registration creates entries. |
| Socket directory manager | Create a short private directory, validate paths, and clean stale resources safely | `fs.mkdtemp`, explicit mode verification, guarded cleanup. |
| Endpoint listener | Accept at most one active connection for the registered endpoint | Dedicated `net.Server` per endpoint for the experiment. |
| JSON-sequence codec | Incrementally decode and encode canonical envelopes | RFC 7464 RS + UTF-8 JSON + LF with configurable frame/queue bounds. |
| NAP-SHELL coordinator | Gate session creation on bare `shell.ready` and emit one scoped `shell.init` | Transport-neutral logic mirroring current web invariants, keyed by endpoint generation rather than `Window`. |
| Runtime adapter | Route ingress to `runtime.handleMessage` and runtime egress to the bound socket | `sendToNapplet(windowId, envelope)` resolves the live endpoint connection. |
| Lifecycle coordinator | Tear down runtime and filesystem state together | On close/error/unregister call `runtime.destroyWindow`, unregister the session, close queues/listeners, and unlink safely. |
| Reference host/napplet | Prove real process behavior | Host registers identity and launches a raw `node:net` client fixture with its socket path. |

## Recommended Project Structure

```text
packages/ipc/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── src/
    ├── index.ts                 # public exports
    ├── types.ts                 # host adapter, endpoint, diagnostics
    ├── json-sequence.ts         # bounded RFC 7464 codec
    ├── socket-directory.ts      # private path creation/cleanup
    ├── endpoint-registry.ts     # identity + generation + connection state
    ├── shell-session.ts         # shell.ready/init lifecycle
    └── ipc-shell.ts             # runtime composition and public factory

tests/fixtures/ipc/
├── host.ts                      # runnable reference host
└── napplet.ts                   # raw node:net client

tests/unit/
└── ipc-shell-integration.test.ts

docs/packages/ipc.md             # docs gate package page
docs/protocol/IPC-PROJECTION-FINDINGS.md
```

### Structure Rationale

- **Codec isolated from sockets:** fragmentation, coalescing, malformed frames, and bounds can be tested deterministically.
- **Identity registry isolated from wire parsing:** makes it impossible for envelope fields to become identity authority accidentally.
- **NAP-SHELL lifecycle isolated from browser types:** permits parity tests without importing DOM globals.
- **Reference fixture outside the package:** demonstrates raw interoperability without implying a client API.

## Architectural Patterns

### Pattern 1: Host-Registered Endpoint

**What:** The host provides verified identity and receives a dedicated socket address before the peer connects.

**When to use:** Every v1.30 endpoint.

**Trade-offs:** Strongly simplifies trust and routing; one listener per endpoint costs more file descriptors than multiplexing but is appropriate for an experiment.

```typescript
const endpoint = await shell.registerEndpoint({
  windowId: 'process-1',
  identity: { dTag: 'notes', aggregateHash: 'abc123' },
  environment: { capabilities: { domains: ['storage'] }, services: [] },
});
```

The shape is illustrative, not a locked public API.

### Pattern 2: Transport-Neutral Runtime Composition

**What:** Preserve `Runtime.handleMessage(windowId, envelope)` and implement only `sendToNapplet` plus session lifecycle around the socket.

**When to use:** All NAP traffic after `shell.ready`.

**Trade-offs:** Maximizes parity and avoids runtime changes; NAP-SHELL coordination must have explicit parity tests with the web shell to prevent drift.

### Pattern 3: Generation-Bound Lifecycle

**What:** Each host registration has a monotonic/opaque generation. Exactly-once init and cleanup are scoped to that generation.

**When to use:** Re-registration or process restart under a stable `windowId`.

**Trade-offs:** Slightly more state, but prevents a late close/error from an old socket destroying a replacement session.

### Pattern 4: Bounded Write Queue

**What:** Serialize outbound frames in order, pause when `socket.write()` returns false, resume on `drain`, and close on configured queue overflow.

**When to use:** All runtime-originated delivery.

**Trade-offs:** Required for safety and ordering; produces an explicit projection policy for slow consumers.

## Data Flow

### Registration and Handshake

```text
Host verifies/assigns identity
    ↓
registerEndpoint(identity, environment)
    ↓
create private pathname socket and bind endpoint generation
    ↓
raw napplet connects and sends framed { type: "shell.ready" }
    ↓
register source-bound runtime session
    ↓
send exactly one framed { type: "shell.init", capabilities, services }
```

### Request/Result

```text
socket bytes → bounded decoder → envelope validation
    → runtime.handleMessage(windowId, envelope)
    → ACL/firewall/domain handler
    → RuntimeAdapter.sendToNapplet(windowId, result)
    → ordered encoder/write queue → socket bytes
```

### Host Push

```text
host/runtime event → eligibility checks → sendToNapplet
    → endpoint lookup → ordered frame → raw napplet decoder
```

### Teardown

```text
socket close/error or host unregister
    → generation check
    → runtime.destroyWindow(windowId)
    → sessionRegistry.unregister(windowId)
    → close listener and pending queue
    → guarded socket-path/private-directory cleanup
```

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `@kehto/ipc` ↔ `@kehto/runtime` | Public factory/types/methods | Reuse `createRuntime`, `RuntimeAdapter`, `handleMessage`, `sessionRegistry`, and `destroyWindow`. |
| IPC endpoint ↔ NAP-SHELL coordinator | Parsed envelopes | Bare ready only; identity and environment are host-owned. |
| Runtime egress ↔ socket | `SendToNapplet` | Preserve per-window ordering and apply backpressure. |
| Reference host ↔ napplet process | Socket path out of band | Do not put identity claims into socket frames or process arguments. |
| IPC findings ↔ `napplet/naps` | Documentation | Clearly separate inherited NAP rules from experimental projection choices. |

## Build Order

1. Codec and endpoint identity invariants.
2. Private socket lifecycle and bounded delivery.
3. NAP-SHELL/runtime composition.
4. Real process proof and parity/security tests.
5. Drafting findings, package docs, and release metadata.

## Anti-Patterns

### Treating `data` Events as Messages

One write can become several reads and several writes can become one read. Use an incremental codec with tests for both cases.

### Sharing Browser Registries

`originRegistry` binds `Window` objects and `postMessage`; importing it into `@kehto/ipc` would couple projections. Use a projection-specific endpoint registry with the same security invariants.

### Identity in the First Frame

An envelope is controlled by the napplet. Identity must already be bound to the accepted socket before parsing `shell.ready`.

### Cleanup Without Generations

A late event from a replaced socket can erase a new session. Gate teardown and exactly-once state by registration generation.

## Sources

- Kehto graph: `createShellBridge` → `adaptHooks`/`createRuntime`; `createMessageHandler` session gate; `handleShellReady`; `Runtime.destroyWindow`.
- https://nodejs.org/download/release/latest-v20.x/docs/api/net.html — IPC server/client lifecycle, path limits, stale paths, and backpressure.
- https://www.rfc-editor.org/info/rfc7464/ — incremental JSON sequence format.
- `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa` — source-bound NAP-SHELL identity and carrier-neutral NAP-INC sender attestation.

---
*Architecture research for: Experimental NIP-5D Unix IPC projection*
*Researched: 2026-08-18*
