# Pitfalls Research

**Domain:** NIP-5D over Unix-domain stream sockets
**Researched:** 2026-08-18
**Confidence:** HIGH for transport/security pitfalls; MEDIUM for projection-specific policy

## Critical Pitfalls

### Pitfall 1: Confusing Stream Chunks with Envelopes

**What goes wrong:** Partial or coalesced reads produce parse errors, dropped messages, or accidental concatenation.

**Why it happens:** Unix `SOCK_STREAM` preserves byte order, not application message boundaries.

**How to avoid:** Use one documented incremental framing format, retain incomplete bytes across reads, and test every split point plus multiple frames per read.

**Warning signs:** `JSON.parse(chunk)` in a socket `data` handler; tests only write and read one message at a time.

**Phase to address:** Transport foundation.

---

### Pitfall 2: Trusting Peer-Supplied Identity

**What goes wrong:** A napplet claims another dTag/window identity and receives its capabilities or state.

**Why it happens:** A shared-socket design tempts implementers to add identity fields to the first frame.

**How to avoid:** Bind a dedicated listener/accepted socket to immutable host-supplied identity before parsing any envelope. Treat `shell.ready` as payload-free.

**Warning signs:** `dTag`, `aggregateHash`, `windowId`, capabilities, or services read from incoming `shell.ready`.

**Phase to address:** Endpoint identity and NAP-SHELL composition.

---

### Pitfall 3: Filesystem Path as Sufficient Authentication

**What goes wrong:** Another same-host process connects to a discoverable or permissive socket and acquires the registered endpoint identity.

**Why it happens:** Linux socket-file permissions appear stronger and more portable than they are; POSIX does not standardize their security effect.

**How to avoid:** Put per-endpoint sockets in a private host-created directory, verify ownership/mode, keep paths unguessable and short, accept one active connection, and document the same-user/process threat boundary. Do not claim cryptographic peer authentication.

**Warning signs:** Socket directly under `/tmp`, `readableAll`/`writableAll`, or identity assurance described without a threat model.

**Phase to address:** Socket lifecycle and security tests.

---

### Pitfall 4: Unbounded Input or Output

**What goes wrong:** A peer sends an unterminated frame or stops reading while the runtime emits messages, causing memory growth or process termination.

**Why it happens:** Node queues socket writes and stream parsers naturally accumulate partial input.

**How to avoid:** Configure maximum frame and queue sizes, stop writing after `write()` returns false until `drain`, and close the endpoint with a diagnostic on overflow.

**Warning signs:** Growing string concatenation, ignored `write()` return values, no oversized-frame tests.

**Phase to address:** Transport foundation.

---

### Pitfall 5: Stale Paths and Unsafe Cleanup

**What goes wrong:** A crash leaves a socket path that blocks restart, or cleanup unlinks a file not owned by this shell instance.

**Why it happens:** Pathname sockets persist after abnormal termination; blindly deleting `EADDRINUSE` targets creates TOCTOU and data-loss risk.

**How to avoid:** Own a unique private directory, never unlink outside it, inspect path type/ownership, clean only paths created by the instance, and prove clean restart after simulated stale state.

**Warning signs:** unconditional `unlink(configuredPath)` or socket paths accepted from untrusted input.

**Phase to address:** Socket lifecycle.

---

### Pitfall 6: Session State Outliving the Process

**What goes wrong:** INC subscriptions/channels, relay subscriptions, service state, or ACL-visible sessions remain live after disconnect.

**Why it happens:** Closing a file descriptor is mistaken for full runtime teardown.

**How to avoid:** Couple socket close/error/unregister to `Runtime.destroyWindow` and `sessionRegistry.unregister`, guarded by endpoint generation.

**Warning signs:** reconnecting under the same `windowId` sees old subscriptions or `instanceId`.

**Phase to address:** Runtime composition and integration proof.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Duplicate web shell-ready logic without parity guards | Avoids modifying shared code | IPC/web lifecycle drifts silently | Only if tests compare all mandatory invariants. |
| Fixed global socket path | Easy manual connection | Collisions, stale state, weak isolation, path hijacking | Never. |
| Shared socket without authentication | One listener | Identity forgery and routing ambiguity | Never. |
| Silently skip malformed frames | Keeps connection alive | Parser differential/smuggling risks and unclear spec behavior | Not for this security boundary; fail closed. |
| Unlimited frame size for resource messages | Avoids choosing a bound | Memory exhaustion | Never; expose/configure a bound and document trade-offs. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@kehto/runtime` ingress | Dispatch before session establishment | Only route non-shell envelopes after source-bound `shell.ready`. |
| Runtime egress | Write directly without endpoint lookup/generation check | Resolve the current bound connection and serialize through its ordered queue. |
| NAP-SHELL | Send `shell.init` on accept | Wait for the first bare `shell.ready`; send exactly once. |
| Host push | Bypass domain/capability eligibility | Reuse runtime/shell eligibility semantics before delivery. |
| Process fixture | Depend on `@kehto/shell-ipc` client code | Use raw `node:net` so the wire is independently demonstrated. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Repeated buffer concatenation | CPU/memory rises with fragmented large frames | Maintain bounded chunks/offsets or compact only when necessary | Large or highly fragmented envelopes. |
| Ignoring backpressure | `writableLength` and RSS grow | Per-endpoint ordered queue and `drain` gating | Slow/stalled napplet during push bursts. |
| Listener per endpoint without cleanup | File descriptors accumulate | Close listener after binding policy permits, and always close on unregister/destroy | Repeated process churn. |
| Parsing before size check | Oversized JSON allocates before rejection | Enforce byte bound during framing, then parse | First malicious oversized frame. |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Socket in a shared writable directory | Unauthorized local connection or path replacement | Private per-instance directory with verified permissions and ownership. |
| Identity accepted from wire | Cross-napplet impersonation | Host-bound immutable endpoint identity. |
| No duplicate-connection policy | Session takeover/race | One active connection; reject later peers until explicit re-registration. |
| Late close destroys replacement | Denial of service/state corruption | Generation-bound callbacks and teardown. |
| Parser recovers silently | Envelope smuggling or inconsistent state | Report malformed frame and close the connection. |
| Sensitive identity in diagnostics | Local information leakage | Structured event codes; redact socket paths/identity by default where appropriate. |

## "Looks Done But Isn't" Checklist

- [ ] **Framing:** Verify every split boundary, coalesced frames, UTF-8 splits, malformed JSON, truncation, and oversize.
- [ ] **Handshake:** Verify bare ready, exactly-one init, duplicate ready, pre-ready traffic, and no peer identity claims.
- [ ] **Identity:** Verify a second/unregistered client cannot inherit or override endpoint identity.
- [ ] **Lifecycle:** Verify graceful close, abrupt termination, host unregister, replacement generation, and stale path recovery.
- [ ] **Backpressure:** Verify ordering and bounded behavior when `write()` returns false.
- [ ] **Runtime parity:** Verify request/result, host push, ACL denial, and teardown through the actual runtime.
- [ ] **Interoperability:** Verify the napplet fixture imports no Kehto IPC client implementation.
- [ ] **Spec evidence:** Verify each projection choice is labeled experimental and the checked upstream ref is recorded.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stale owned socket | LOW | Confirm it is within the owned private directory, remove it, and recreate listener. |
| Malformed/oversized frame | LOW | Close offending connection, destroy endpoint lifecycle, report diagnostic; require explicit host re-registration. |
| Backpressure overflow | MEDIUM | Close endpoint deterministically, clean runtime state, tune bound only with measured evidence. |
| Identity/lifecycle drift | HIGH | Stop release, add parity tests, revise findings, and avoid upstreaming the invalid projection behavior. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stream chunk confusion | Transport foundation | Fragmentation/coalescing/UTF-8 vector tests. |
| Identity forgery | Endpoint identity | Forged ready fields and unauthorized connector tests. |
| Weak socket isolation | Socket lifecycle | Mode/ownership/path containment tests. |
| Unbounded resources | Transport foundation | Oversize and stalled-writer tests. |
| Stale/unsafe cleanup | Socket lifecycle | Crash-stale and guarded-unlink tests. |
| Runtime state leak | Integration proof | Disconnect/reconnect and subscription cleanup tests. |

## Sources

- https://nodejs.org/download/release/latest-v20.x/docs/api/net.html — stream behavior, socket lifecycle, stale paths, and backpressure.
- https://www.rfc-editor.org/info/rfc7464/ — framing, malformed sequences, and parser security considerations.
- https://man7.org/linux/man-pages/man7/unix.7.html — permissions are not portable authentication; pathname limits and credential portability.
- `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa` — identity must be runtime-derived; shell.ready carries no identity.
- Kehto graph — runtime pre-session gate and destroy paths.

---
*Pitfalls research for: Experimental NIP-5D Unix IPC projection*
*Researched: 2026-08-18*
