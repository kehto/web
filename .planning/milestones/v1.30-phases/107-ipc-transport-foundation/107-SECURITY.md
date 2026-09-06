---
phase: 107
slug: ipc-transport-foundation
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-08-18
---

# Phase 107 — Security

> ASVS L1 verification of the plan-time STRIDE register for the experimental POSIX IPC carrier.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Host registration → endpoint factory | Trusted host metadata is validated, cloned, and frozen before endpoint side effects. | Window and artifact identity plus JSON-compatible environment metadata |
| Local peer → Unix socket | Arbitrary local-process bytes enter a bounded RFC 7464 decoder. | Untrusted framed bytes and possible identity claims |
| Decoder → host callback | Only canonical envelopes without peer-controlled binding keys cross into host integration. | Validated NIP-5D envelope plus host-owned registration |
| Endpoint → filesystem | The host selects a base directory; the package owns private temporary resources beneath it. | Socket pathname, directory fingerprints, and lifecycle state |
| Host egress → peer queue | Trusted output can outpace a local consumer. | Encoded envelope buffers and backpressure state |
| Pinned NAP authority → public docs | Upstream protocol facts become integrator-facing normative or experimental claims. | Specification attribution and threat-boundary guidance |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Evidence | Status |
|-----------|----------|-----------|----------|-------------|---------------------|--------|
| T-107-01 | Spoofing | Endpoint ingress | high | mitigate | Registration is validated/cloned/frozen before listen; all binding keys are rejected before dispatch and covered by raw-socket tests. | closed |
| T-107-02 | Tampering | Endpoint registry cleanup | high | mitigate | Private monotonic generations guard every remove/close action; stale-generation regressions pass. | closed |
| T-107-03 | Information Disclosure | Socket pathname and diagnostics | medium | mitigate | Mode-0700 directory, host-handle-only path, redacted diagnostics, and explicit non-authentication documentation. | closed |
| T-107-04 | Elevation of Privilege | Transport/runtime boundary | high | mitigate | Phase 107 exports transport only; runtime/session/capability composition remains absent and canonical-object admission is tested. | closed |
| T-107-05 | Denial of Service | Decoder growth | high | mitigate | Frame and aggregate byte limits validate eagerly, enforce exact bounds, clear terminal buffers, and have raw-socket limit probes. | closed |
| T-107-06 | Tampering | UTF-8 and JSON interpretation | high | mitigate | Byte framing, fatal UTF-8 decoding, and every-byte multibyte split vectors prevent parser normalization or replacement. | closed |
| T-107-07 | Tampering | Parser resynchronization | high | mitigate | First invalid record irreversibly closes the decoder; later valid records cannot dispatch. | closed |
| T-107-08 | Spoofing | Peer binding claims | high | mitigate | Own top-level binding keys raise a terminal transport error before the host callback, including coalesced-record coverage. | closed |
| T-107-09 | Repudiation | Error classification | medium | mitigate | Stable typed diagnostic codes are asserted across the invalid-input matrix without exposing full paths. | closed |
| T-107-10 | Tampering | Stale/substituted path cleanup | high | mitigate | Device/inode fingerprints, immediate rechecks, socket-type validation, containment, and substitution fixtures guard unlink/rmdir. | closed |
| T-107-11 | Elevation of Privilege | Path derivation | high | mitigate | Host base resolution, `mkdtemp`, fixed basename, containment, and UTF-8 byte limits exclude peer/identity-derived paths. | closed |
| T-107-12 | Denial of Service | Parallel/failed registration | medium | mitigate | Synchronous reservation rejects duplicates and matching-generation rollback permits safe retry. | closed |
| T-107-13 | Tampering | Delayed cleanup callbacks | high | mitigate | Window ID plus generation comparisons prevent obsolete callbacks from mutating replacement state or resources. | closed |
| T-107-14 | Information Disclosure | Local socket address | medium | mitigate | Private directories, host-only pathname exposure, redacted diagnostics, and explicit same-UID limitations bound the claim. | closed |
| T-107-15 | Denial of Service | Slow peer | high | mitigate | Per-peer frame/byte budgets include callback-pending writes; overflow terminates and reports once without starving healthy peers. | closed |
| T-107-16 | Tampering | Egress ordering | high | mitigate | One FIFO queue owns each socket write path; false/drain schedules and reentrancy are deterministic in tests. | closed |
| T-107-17 | Denial of Service | Invalid queue limits | medium | mitigate | Non-negative safe-integer validation and checked totals reject invalid precision and overflow before operation. | closed |
| T-107-18 | Tampering | Stale drain callbacks | high | mitigate | Guarded flush/drain state and terminal listener detachment prevent duplicate, reordered, or revived output. | closed |
| T-107-19 | Repudiation | Queue termination cause | medium | mitigate | Typed overflow/write-failure/closed diagnostics retain host binding while redacting the socket path. | closed |
| T-107-20 | Spoofing | Upstream authority attribution | high | mitigate | Both public docs cite the exact checked commit, state it defines no IPC carrier, and distinguish carrier-neutral NAP-INC text. | closed |
| T-107-21 | Information Disclosure | Local-peer threat guidance | high | mitigate | Both public docs explicitly deny authentication/cryptographic identity and exclude hostile same-UID peers. | closed |
| T-107-22 | Tampering | Documentation gap scope | low | mitigate | Gap closure changed only the two verified public documents; targeted diff and docs checks passed. | closed |

## Accepted Risks Log

No accepted risks. Hostile same-UID peers are an explicit experimental carrier boundary, not an authentication guarantee or an implicitly accepted in-scope threat.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-18 | 22 | 22 | 0 | Codex autonomous security hook |

## Sign-Off

- [x] All threats have a disposition.
- [x] No accepted risks require logging.
- [x] `threats_open: 0` confirmed at ASVS L1 with `block_on: high`.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-08-18
