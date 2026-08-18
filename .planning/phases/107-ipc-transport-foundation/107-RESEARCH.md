# Phase 107: IPC Transport Foundation - Research

**Researched:** 2026-08-18
**Domain:** Node.js POSIX Unix-domain socket transport for canonical NIP-5D envelopes
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at the agent's discretion because discuss was
skipped by project setting. Use the approved roadmap goal, success criteria,
requirements IPC-01 through IPC-04 and BIND-01, project research, and existing
codebase conventions to guide decisions.

### the agent's Discretion

All implementation choices are at the agent's discretion because discuss was
skipped by project setting. Use the approved roadmap goal, success criteria,
requirements IPC-01 through IPC-04 and BIND-01, project research, and existing
codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)

Windows named pipes, shared-listener multiplexing, remote transports,
napplet-side helpers, and interface injection remain outside this milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IPC-01 | Dedicated short private pathname socket per registration; guarded stale handling and owned cleanup. | Private `mkdtemp` directory, fixed short basename, containment checks, and instance-owned cleanup policy. |
| IPC-02 | Exchange unchanged canonical envelopes with incremental RFC 7464 framing. | Pure byte-oriented JSON-sequence codec using RS + UTF-8 JSON + LF; fragmentation/coalescing test vectors. |
| IPC-03 | Reject malformed, truncated, invalid-UTF-8, and oversized frames before dispatch. | Strict decoder state machine with finite frame/buffer limits and terminal connection failure. |
| IPC-04 | Preserve per-endpoint egress order with finite backpressure. | One serialized write queue per accepted socket; pause on `write() === false`, resume on `drain`, destroy on queue overflow. |
| BIND-01 | Host registers immutable identity and environment before listen; peer cannot replace identity on wire. | Immutable registration record created before `listen`; envelope parsing receives only the bound `windowId`; no identity parser exists in the codec. |
</phase_requirements>

## Summary

Implement this phase as a new, Node/POSIX-only `@kehto/shell-ipc` workspace package that uses only Node built-ins plus the existing workspace `@kehto/runtime`; do not add a transport library or a napplet-side helper. [VERIFIED: codebase-memory MCP] The browser shell establishes the right seam already: it resolves a registered source to `windowId`, handles `shell.ready` locally, and forwards every other object-shaped canonical envelope to `runtime.handleMessage(windowId, msg)`. The IPC package must preserve that division while owning socket registration, framing, and egress.

RFC 7464 provides the framing format, but not the security policy: it specifies UTF-8 JSON texts framed as `RS (0x1E) + JSON + LF (0x0A)` and permits incremental processing. [CITED: https://www.rfc-editor.org/rfc/rfc7464.html] For this local, identity-bearing carrier, choose fail-closed policy: a malformed, invalid-UTF-8, truncated-at-EOF, framing-invalid, or over-limit record closes only that peer and must never reach runtime dispatch. This intentionally differs from RFC 7464's optional recovery guidance for append-only/log-oriented streams. [CITED: https://www.rfc-editor.org/rfc/rfc7464.html]

The upstream protocol authority is `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; it has no IPC carrier projection. [VERIFIED: project REQUIREMENTS.md] Therefore, all socket pathname, resource-limit, lifecycle, and peer-admission decisions below are explicitly experimental projection policy. Preserve the carrier-neutral NAP-SHELL/NAP-INC invariants already encoded by Kehto: runtime-attested identity, one bare `shell.ready`, exactly one `shell.init`, and no capability dispatch before session establishment. [VERIFIED: project REQUIREMENTS.md] Phase 107 builds the transport and host identity registration only; BIND-02 through BIND-04 and the runtime handshake composition belong to later phases.

**Primary recommendation:** Build a pure bounded RFC-7464 byte codec and a private, host-owned endpoint registrar in `packages/ipc`; expose no peer-provided identity API and no transport changes in `@kehto/runtime` or browser `@kehto/shell`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Private directory and pathname allocation | API / Backend | Database / Storage | The host process creates and owns filesystem resources before a peer connects. |
| RFC-7464 decoding and limits | API / Backend | — | Stream bytes are untrusted process input; parsing must finish before runtime receives an envelope. |
| Immutable identity binding | API / Backend | — | Only the host has authority to associate `windowId`, dTag, aggregate hash, and environment with the endpoint. |
| Ordered socket egress and backpressure | API / Backend | — | The transport owns the concrete `net.Socket` and has to serialize writes per accepted connection. |
| NIP-5D dispatch and ACL enforcement | API / Backend | — | Existing `@kehto/runtime` remains the canonical domain dispatcher. [VERIFIED: codebase-memory MCP] |
| Browser `postMessage` carrier | Browser / Client | Frontend Server (SSR) | Existing web projection remains out of scope and unchanged. [VERIFIED: project REQUIREMENTS.md] |

## Project Constraints (from AGENTS.md)

- Preserve the pre-existing dirty `package.json` and `.planning/debug/jsr-release-scope-auth.md`; this research commit stages only this file.
- Keep the current non-default branch and never discard or absorb unrelated work.
- Use GSD planning/execution workflows for later source changes; this artifact is the authorized planning output.
- Follow strict ESM-only TypeScript, 2-space indentation, lowercase-hyphenated filenames, and JSDoc on every public API export.
- For implementation, add real unit coverage; use `pnpm test:unit`, and run build/type-check/docs/AI-slop gates required by the touched package/docs scope.
- Before NAP/NIP-5D changes, check the owning `napplet/naps` authority first. For this experimental projection, record `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, preserve carrier-neutral invariants, and never present the IPC carrier as normative.
- Do not modify browser `@kehto/shell`, NAP handler semantics, or canonical envelope shapes to accommodate IPC.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:net` | Node `v26.7.0` available; package should declare the project-supported Node baseline, not this machine version | Dedicated Unix-domain `net.Server` and `net.Socket` | Node supports IPC Unix-domain paths, returns a stream `Socket` on connection, and exposes `write()`/`drain` backpressure semantics. [CITED: https://nodejs.org/api/net.html] |
| `node:fs/promises` + `node:path` | Node built-ins | Private directory lifecycle, `lstat`, containment, guarded unlink/rmdir | No third-party filesystem abstraction is needed for owned pathname resources. [ASSUMED] |
| `node:string_decoder` | Node built-in | Incremental UTF-8 decoding across split multibyte chunks | `StringDecoder` retains incomplete trailing multibyte characters until the next write/end. [CITED: https://nodejs.org/api/string_decoder.html] |
| `@kehto/runtime` | workspace `^0.22.0` in current tree | Existing canonical dispatch, ACL/firewall, lifecycle seam | Runtime's adapter exposes `sendToNapplet`, and its public instance handles messages by `windowId`; do not fork its dispatcher. [VERIFIED: codebase-memory MCP] |
| Vitest | `4.1.2` installed in repository | Codec and endpoint unit tests | Root config includes `packages/*/src/**/*.test.ts` under the Node environment. [VERIFIED: vitest.config.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` | Node built-in | Short random directory or endpoint suffix | Use for names only; never treat a pathname as cryptographic peer authentication. [ASSUMED] |
| `node:events` | Node built-in | Typed diagnostics emitter, if the public API needs observable close reasons | Use only for host diagnostics; retain no unbounded event history. [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated pathname listener | Shared listener with first-frame endpoint selection | Rejected: a peer-selected identity claim would invent unauthoritative multiplexing/authentication and violate BIND-01. [VERIFIED: project REQUIREMENTS.md] |
| RFC-7464 JSON text sequence | Newline-delimited JSON | Rejected: JSON strings can contain escaped newline content and bare newline framing has weaker resynchronization semantics; RFC 7464 is the phase requirement. [VERIFIED: project REQUIREMENTS.md] |
| Byte-level bounded codec | `JSON.parse(chunk.toString())` in a `data` handler | Rejected: `net.Socket` is a stream, so chunks do not represent messages. [CITED: https://nodejs.org/api/net.html] |
| Node built-ins | A socket/framing package | Rejected: this small carrier requires no external dependency and needs a project-specific fail-closed policy anyway. [ASSUMED] |

**Installation:** No external package installation. Add the workspace package only; consume Node built-ins and existing `@kehto/runtime`.

**Version verification:** `node v26.7.0`, `npm 11.19.0`, and `pnpm 10.8.0` are available in this environment. [VERIFIED: local environment] Existing peer contract is `@napplet/core 0.31.1` and `@napplet/nap 0.31.2` in the npm registry (published 2026-08-02); no change is required for Phase 107. [VERIFIED: npm registry]

## Package Legitimacy Audit

No external packages are installed by this phase. Node built-ins and workspace `@kehto/runtime` do not require the external-package legitimacy gate.

## Architecture Patterns

### System Architecture Diagram

```text
Host integrator
  │ immutable { windowId, dTag, aggregateHash, environment }
  ▼
Endpoint registrar ── creates private owned directory + short socket path
  │
  ▼
Dedicated node:net Server ── one endpoint address per registration
  │ accepted byte stream
  ▼
Bounded RFC-7464 codec
  │ valid canonical object only              invalid/oversize/truncated
  │                                          └──► destroy peer; emit diagnostic
  ▼
Endpoint record (host identity only) ──► later NAP-SHELL session coordinator
  │                                       (Phase 108)
  ▼
@kehto/runtime.handleMessage(windowId, envelope)
  │ runtime-originated envelope
  ▼
Per-endpoint ordered outbound queue ── write(false) ──► wait for drain
  │ queue overflow / close
  └───────────────────────────────────────────────► destroy peer; bounded cleanup
```

### Recommended Project Structure

```text
packages/ipc/
├── package.json                 # @kehto/shell-ipc, ESM, workspace deps only
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── src/
    ├── index.ts                 # only documented public exports
    ├── types.ts                 # immutable registration/options/diagnostics types
    ├── json-sequence.ts         # pure bounded RFC-7464 encode/decode
    ├── outbound-queue.ts        # ordered write + drain gate
    ├── socket-directory.ts      # owned private directory/path lifecycle
    ├── endpoint-registry.ts     # host identity and listener records
    └── ipc-shell.ts             # public factory; Phase 108 composes runtime

docs/packages/ipc.md             # required package-doc page when package ships
tests/unit/ipc-transport.test.ts # cross-module transport-level tests if needed
```

### Pattern 1: Host-Bound Immutable Registration

**What:** `registerEndpoint()` accepts a host-created identity and environment, freezes/copies the registration into a private record, creates its path, and only then starts listening. Incoming codec output is an envelope—not a source of identity. [VERIFIED: project REQUIREMENTS.md]

**When to use:** Every Phase 107 endpoint.

**Example:**

```typescript
export type EndpointRegistration = Readonly<{
  windowId: string;
  dTag: string;
  aggregateHash: string;
  environment: Readonly<Record<string, unknown>>;
}>;

// Experimental carrier policy: identity enters only here, never from a frame.
export async function registerEndpoint(input: EndpointRegistration): Promise<Endpoint> {
  const identity = Object.freeze({ ...input, environment: Object.freeze({ ...input.environment }) });
  return createOwnedPathAndListener(identity);
}
```

### Pattern 2: Strict Incremental Byte Framing

**What:** Keep undecoded bytes in codec state; find RS delimiters on bytes, require a following LF before parsing, enforce size before conversion, decode UTF-8 strictly, `JSON.parse`, then require a non-null object with string `type`. RFC 7464 specifies RS-prefixed UTF-8 JSON text with LF output framing. [CITED: https://www.rfc-editor.org/rfc/rfc7464.html]

**When to use:** Every inbound socket `data` event, including fixtures.

**Example:**

```typescript
const RS = 0x1e;
const LF = 0x0a;

export function encodeJsonSequence(envelope: Record<string, unknown>): Buffer {
  return Buffer.concat([Buffer.from([RS]), Buffer.from(JSON.stringify(envelope), 'utf8'), Buffer.from([LF])]);
}

// `push` appends bytes, detects a complete RS...LF record, size-checks it,
// then returns only validated envelope objects. Any error is terminal.
```

### Pattern 3: Single Ordered Egress Owner

**What:** One `OutboundQueue` owns all writes for one accepted socket. It appends already-encoded frames in call order, calls `socket.write()` until it returns `false`, and resumes only from that same socket's `drain` event. Node reports `false` when all or part of a write is queued in user memory and later emits `drain` when the buffer is free. [CITED: https://nodejs.org/api/net.html]

**When to use:** All egress including later runtime results and pushes.

**Anti-Patterns to Avoid**

- **One `data` event equals one envelope:** do not parse directly from stream chunks; chunks may be partial or coalesced. [CITED: https://nodejs.org/api/net.html]
- **Identity in `shell.ready` or any first frame:** do not parse `windowId`, dTag, aggregate hash, capabilities, or environment from peer traffic. [VERIFIED: project REQUIREMENTS.md]
- **Blind stale-path cleanup:** do not unlink a configured or peer-derived pathname; clean only an owned, contained socket path and directory.
- **Write-until-memory-exhausted:** do not ignore the return value of `socket.write()`; Node queues writes in memory when the peer is slow. [CITED: https://nodejs.org/api/net.html]
- **Silent RFC recovery:** do not skip malformed frames and continue. RFC recovery is permissive stream behavior, while this projection must fail closed. [CITED: https://www.rfc-editor.org/rfc/rfc7464.html]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unix-domain server/client plumbing | Native binding or custom socket abstraction | `node:net` | Stable standard IPC server/client API with stream/backpressure events. [CITED: https://nodejs.org/api/net.html] |
| Temporary private directory generation | Timestamp/PID directory name | `fs.mkdtemp` under a short host-selected base directory | Avoid predictable collisions; still validate ownership and containment. [ASSUMED] |
| UTF-8 chunk reassembly | Ad-hoc string concatenation | `node:string_decoder` or byte-only framing plus strict UTF-8 decode | Prevent split multibyte characters becoming replacement characters or parse ambiguity. [CITED: https://nodejs.org/api/string_decoder.html] |
| Domain authorization / canonical dispatch | IPC-local handler switch | Existing `@kehto/runtime` | Preserve ACL, firewall, and canonical envelope behavior. [VERIFIED: codebase-memory MCP] |

**Key insight:** Hand-roll only the small, testable policy layer that RFC 7464 and Node deliberately leave to the application: frame validity, finite bounds, identity binding, and endpoint ownership.

## Common Pitfalls

### Pitfall 1: Pathname length and crash leftovers

**What goes wrong:** Binding fails on a long working-directory-derived path, or a process crash leaves a path that blocks the next registration.

**Why it happens:** Unix-domain sockets use filesystem pathnames with typical limits of 107 bytes on Linux and 103 bytes on macOS; crash-created entries persist until unlinked. [CITED: https://nodejs.org/api/net.html]

**How to avoid:** Allocate one `mkdtemp` private base directory near a short host base; use short random endpoint basenames; reject a computed path before `listen` when its UTF-8 byte length is above a conservative `90` bytes. Only attempt stale cleanup after `lstat` confirms a socket within the directory created and retained by this instance. The `90`-byte threshold is experimental portability headroom. [ASSUMED]

**Warning signs:** A pathname includes `process.cwd()`, a dTag, or an aggregate hash; `EADDRINUSE` invokes unconditional unlink.

### Pitfall 2: Valid JSON but invalid protocol input

**What goes wrong:** A valid JSON scalar/array or object without `type` reaches runtime, creating an ingress mismatch with the existing browser shell.

**Why it happens:** RFC 7464 can frame every JSON value, but the Kehto browser bridge only delegates a non-null object with string `type`. [VERIFIED: codebase-memory MCP]

**How to avoid:** Keep codec-level syntax validation distinct from a canonical-envelope shape guard. Phase 107 can export only valid objects; Phase 108 must apply the exact browser-parity ingress guard before `runtime.handleMessage`.

### Pitfall 3: Invalid UTF-8 accidentally normalized

**What goes wrong:** UTF-8 decoding substitutes replacement characters and altered bytes get parsed or logged as a different record.

**Why it happens:** Strings hide byte-level decoding failures unless the implementation checks them explicitly.

**How to avoid:** Frame on `Buffer` bytes, then use a fatal UTF-8 `TextDecoder` or explicit decoder failure path before `JSON.parse`; use `StringDecoder` only where its incomplete-multibyte buffering semantics are intentionally paired with an explicit final `end()` truncation check. [CITED: https://nodejs.org/api/string_decoder.html]

### Pitfall 4: Queue limit specified only by count

**What goes wrong:** A peer stalls and a few gigantic frames consume unbounded memory despite a finite item count.

**How to avoid:** Bound both number of queued frames and queued encoded bytes, including the currently buffered frame. Close the peer on either overflow. [ASSUMED]

### Pitfall 5: Cleaning up a replacement registration

**What goes wrong:** A delayed close/error callback from an older listener unlinks a newer endpoint or destroys its session.

**How to avoid:** Store a private opaque generation token per registration; each close/error/cleanup callback compares it to the currently owned record before affecting registry or filesystem state. Phase 107 can establish the token; BIND-02/BIND-04 test full replacement lifecycle in Phase 108. [VERIFIED: project REQUIREMENTS.md]

## Code Examples

Verified patterns from official sources:

### Bounded backpressure loop

```typescript
// Source: https://nodejs.org/api/net.html
function flush(socket: import('node:net').Socket, queue: Buffer[]): boolean {
  while (queue.length > 0) {
    const frame = queue[0];
    if (!socket.write(frame)) return false; // wait for this socket's `drain`
    queue.shift();
  }
  return true;
}
```

`socket.write()` returning `false` means user-memory queuing occurred; `drain` signals the writable buffer is free. [CITED: https://nodejs.org/api/net.html]

### RFC-7464 boundary test matrix

```typescript
// Source: https://www.rfc-editor.org/rfc/rfc7464.html
for (let split = 1; split < frame.length; split += 1) {
  const decoder = createJsonSequenceDecoder(limits);
  expect(decoder.push(frame.subarray(0, split))).toEqual([]);
  expect(decoder.push(frame.subarray(split))).toEqual([envelope]);
}

expect(createJsonSequenceDecoder(limits).push(Buffer.concat([frame, frame]))).toEqual([
  envelope,
  envelope,
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Browser-only `postMessage` source binding | Separate host-bound POSIX IPC carrier | Experimental v1.30 projection | Keep all carrier-specific source lookup outside `@kehto/runtime`. [VERIFIED: project REQUIREMENTS.md] |
| Treat socket chunks as application messages | Incremental byte framing | Required by `net.Socket` stream semantics | Fragmentation and coalescing become deterministic test vectors. [CITED: https://nodejs.org/api/net.html] |
| Recovery after JSON-sequence parse failures | Fail-closed peer destruction | Experimental projection policy | Avoid parser differential/smuggling risk at an identity-bearing boundary. [ASSUMED] |

**Deprecated/outdated:** No existing IPC implementation exists in this repository. Do not reuse browser `originRegistry`; it depends on `Window`/`postMessage` semantics and would couple the projections. [VERIFIED: project research ARCHITECTURE.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A conservative 90-byte pathname threshold is sufficient for the project’s supported POSIX targets. | Common Pitfalls | Hosts with a shorter OS limit could fail to bind; use a configurable documented threshold if support matrix differs. |
| A2 | The experimental defaults are `maxFrameBytes: 1 MiB`, `maxBufferedInputBytes: 2 MiB`, `maxOutboundQueueFrames: 64`, and `maxOutboundQueueBytes: 1 MiB`. | Open Questions (RESOLVED) / Architecture Patterns | Workload may need different latency/memory trade-offs; values are experimental, configurable carrier policy rather than NAP requirements. |
| A3 | `fs.mkdtemp` plus guarded ownership/containment checks and host-held pathname distribution define the local threat boundary. | Open Questions (RESOLVED) / Don't Hand-Roll | This policy provides neither cryptographic peer authentication nor protection from a hostile same-UID process; either guarantee requires a separate OS credential/authentication design. |
| A4 | A fatal `TextDecoder` is preferable to a `StringDecoder` for final record decoding, while `StringDecoder` remains a documented option for chunk reassembly. | Common Pitfalls | Node `>=20` supplies the selected decoder and filesystem baseline. |
| A5 | `@kehto/shell-ipc` declares `engines.node: ">=20"`. | Open Questions (RESOLVED) / Standard Stack | Consumers on older Node releases are unsupported by this experimental package. |

## Open Questions (RESOLVED)

1. **What exact documented limit defaults should ship?**
   - Resolution: Ship `maxFrameBytes: 1 MiB`, `maxBufferedInputBytes: 2 MiB`, `maxOutboundQueueFrames: 64`, and `maxOutboundQueueBytes: 1 MiB` as validated, configurable experimental defaults. These values are carrier policy, not NAP requirements. [ASSUMED]

2. **What local threat boundary can the package claim?**
   - Resolution: Claim only private-directory containment and host-held pathname distribution. The package provides no cryptographic peer authentication and no protection from a hostile same-UID process. [ASSUMED]

3. **Which Node version is the package support floor?**
   - Resolution: Declare `engines.node: ">=20"` for `@kehto/shell-ipc`; Node 20 is the selected support floor for the fatal `TextDecoder`, filesystem, ESM, and test assumptions used by this phase. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | `node:net`, codec, test fixture | ✓ | `v26.7.0` | None |
| pnpm | workspace scripts | ✓ | `10.8.0` | None |
| npm | package registry verification | ✓ | `11.19.0` | pnpm for workspace work |
| POSIX Unix-domain sockets | endpoint listener | ✓ | macOS development environment | No Windows fallback in scope |
| Vitest | unit tests | ✓ | root dependency `4.1.2` | None |

**Missing dependencies with no fallback:** None for Phase 107 on this Node/POSIX development host.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.2` [VERIFIED: package.json] |
| Config file | `vitest.config.ts` [VERIFIED: vitest.config.ts] |
| Quick run command | `pnpm vitest run packages/ipc/src/json-sequence.test.ts packages/ipc/src/outbound-queue.test.ts --reporter=dot` |
| Full suite command | `pnpm test:unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IPC-01 | Creates a short path under an owned mode-`0700` temporary directory; refuses out-of-root cleanup; stale owned socket cleanup only. | unit + filesystem integration | `pnpm vitest run packages/ipc/src/socket-directory.test.ts -x` | ❌ Wave 0 |
| IPC-02 | Decodes every split point, coalesced records, and UTF-8 multibyte splits; encoder emits `RS + JSON + LF` unchanged. | unit | `pnpm vitest run packages/ipc/src/json-sequence.test.ts -x` | ❌ Wave 0 |
| IPC-03 | Rejects malformed JSON, missing RS/LF, fatal invalid UTF-8, EOF truncation, over-frame and over-buffer input before receiver invocation. | unit | `pnpm vitest run packages/ipc/src/json-sequence.test.ts -x` | ❌ Wave 0 |
| IPC-04 | Maintains enqueued order, stops on `write() === false`, resumes after `drain`, and closes/reports overflow at both frame and byte limits. | unit with controlled fake `net.Socket` write surface | `pnpm vitest run packages/ipc/src/outbound-queue.test.ts -x` | ❌ Wave 0 |
| BIND-01 | Host registration clones/freezes identity before `listen`; frames cannot set/replace identity; endpoint exposes only registered address/metadata. | unit + local socket smoke | `pnpm vitest run packages/ipc/src/endpoint-registry.test.ts -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted `pnpm vitest run packages/ipc/src/<touched>.test.ts -x`.
- **Per wave merge:** `pnpm test:unit`.
- **Phase gate:** `pnpm build`, `pnpm type-check`, `pnpm test:unit`, and relevant docs/AI-slop checks green before phase verification.

### Wave 0 Gaps

- [ ] `packages/ipc/package.json`, `tsconfig.json`, and `tsup.config.ts` — standard publishable ESM workspace skeleton.
- [ ] `vitest.config.ts` alias for `@kehto/shell-ipc` — needed only once integration tests import package root; direct source tests work through the existing include glob.
- [ ] `packages/ipc/src/json-sequence.test.ts` — covers IPC-02 and IPC-03 exhaustive framing vectors.
- [ ] `packages/ipc/src/socket-directory.test.ts` — covers IPC-01 ownership/containment vectors.
- [ ] `packages/ipc/src/outbound-queue.test.ts` — covers IPC-04 false-write/drain/overflow vectors.
- [ ] `packages/ipc/src/endpoint-registry.test.ts` — covers BIND-01 host ownership and immutability.

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so this section is required. ASVS Level 1 is the established project baseline for phase security verification. [VERIFIED: project planning history]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Do not claim socket pathname equals authenticated peer; host binds identity before peer traffic, and document same-host threat limits. |
| V3 Session Management | Later-phase dependency | Phase 107 establishes endpoint generation/diagnostic cleanup hooks; Phase 108 owns active-peer/session lifecycle. [VERIFIED: project REQUIREMENTS.md] |
| V4 Access Control | Yes | Do not bypass runtime dispatch; identity stays host-bound and no peer-selected endpoint routing exists. [VERIFIED: codebase-memory MCP] |
| V5 Input Validation | Yes | Byte bound → frame structure → fatal UTF-8 → JSON parse → object/string-`type` guard, before any receiver call. |
| V6 Cryptography | No new cryptography | Do not hand-roll authentication or claim path secrecy provides cryptographic integrity. RFC 7464 supplies none. [CITED: https://www.rfc-editor.org/rfc/rfc7464.html] |

### Known Threat Patterns for Node Unix-domain IPC

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Peer supplies `windowId`/dTag/hash in first frame | Spoofing | Host-only immutable registration; codec has no identity authority. |
| Malformed/oversized/incomplete frame | Denial of Service / Tampering | Byte bounds, fatal decoder, terminal close, no dispatch. |
| Slow/non-reading peer | Denial of Service | Ordered finite queue; honor `write()` result and `drain`; close on byte/count overflow. [CITED: https://nodejs.org/api/net.html] |
| Stale or substituted pathname removal | Tampering | Per-instance private directory; lstat/type/containment ownership checks before cleanup. |
| Parser differential / recovery smuggling | Tampering | Fail closed after first invalid record rather than RFC optional recovery. [CITED: https://www.rfc-editor.org/rfc/rfc7464.html] |
| Socket path disclosed to untrusted local process | Information Disclosure / Spoofing | Keep in private directory, redact diagnostics, and document no cryptographic local-peer authentication. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- Kehto codebase-memory MCP — browser `ShellBridge.handleMessage`, `handleShellReady`, runtime adapter shape, `Runtime.destroyWindow`, and session registry behavior.
- Project requirements/context/research — pinned authority and phase/milestone boundaries.

### Secondary (MEDIUM confidence)

- [Node `net` documentation](https://nodejs.org/api/net.html) — Unix IPC pathname behavior, path limits, server close lifecycle, stream data events, and write/drain backpressure.
- [Node `string_decoder` documentation](https://nodejs.org/api/string_decoder.html) — incomplete multibyte buffering behavior.
- [RFC 7464](https://www.rfc-editor.org/rfc/rfc7464.html) — UTF-8 JSON text-sequence format, RS/LF framing, incremental parsing, truncation, and security considerations.

### Tertiary (LOW confidence)

- Experimental default limits, pathname headroom, and threat-boundary policy are marked `[ASSUMED]` for implementation-time confirmation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — Node built-ins and existing workspace seams are directly verified; no external dependency is needed.
- Architecture: HIGH — matches existing browser→runtime ingress seam and approved milestone architecture. [VERIFIED: codebase-memory MCP]
- Pitfalls: MEDIUM — Node/RFC mechanics are authoritative; the exact resource limits, Node `>=20` floor, and local threat boundary are resolved experimental policy.

**Research date:** 2026-08-18
**Valid until:** 2026-09-17 for Node/RFC mechanics; revisit experimental policy before package publication.
