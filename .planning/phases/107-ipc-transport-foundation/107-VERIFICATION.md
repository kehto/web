---
phase: 107-ipc-transport-foundation
verified: 2026-08-18T18:22:34Z
status: human_needed
score: 25/25 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 24/25
  gaps_closed:
    - "The public package labels all IPC carrier choices as experimental against napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Review the experimental-authority wording."
    expected: "No public API or documentation text presents carrier framing, lifecycle, limits, or trust choices as normative NAP/NIP authority."
    why_human: "This is a judgment-tier prohibition. Automated checks confirm the precise pinned-authority statement, but protocol-language approval is a human decision."
  - test: "Review the local-peer threat-boundary wording."
    expected: "The package continues to state that private paths and mode-0700 directories are neither authentication nor cryptographic protection, and that hostile same-UID peers are out of scope."
    why_human: "This is a judgment-tier prohibition. The required disclaimers are present, but human security review remains recommended."
---

# Phase 107: IPC Transport Foundation Verification Report

**Phase Goal:** Host integrators can create a bounded, private, identity-bound Unix-domain socket endpoint that safely transports canonical NIP-5D envelopes.
**Verified:** 2026-08-18T18:22:34Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Host registration is immutable before one dedicated pathname listener exists, and peer wire claims cannot replace it. | ✓ VERIFIED | `ipc-shell.ts` validates, clones, and recursively freezes before listener allocation; all four top-level binding claims are rejected before `onEnvelope`. Production local-socket tests cover caller mutation and claims. |
| 2 | Partial and coalesced raw input yields unchanged canonical envelopes with RFC 7464 framing. | ✓ VERIFIED | Byte-oriented `RS + UTF-8 JSON + LF` codec plus every-byte-split, coalesced-frame, multibyte, and decoder-isolation tests passed. |
| 3 | Malformed, truncated, invalid-UTF-8, oversized, and over-buffered input fails closed before dispatch. | ✓ VERIFIED | Decoder terminal state and invalid-input matrix remain covered; the prior built-package raw-socket oversized/over-buffer checks remain valid and no implementation changed. |
| 4 | Outbound messages are FIFO-bounded and obey socket backpressure. | ✓ VERIFIED | One queue owns each peer, halts on `write(false)`, resumes through one drain listener, and retains callback-pending accounting; queue/race tests passed. |
| 5 | Stale recovery and cleanup affect only resources owned by the matching registration. | ✓ VERIFIED | Fingerprint, containment, socket-type, private-directory, and generation guards remain wired and covered by filesystem/registry tests. |
| 6 | `@kehto/shell-ipc` is ESM-only, Node >=20/POSIX-only, and accurately labels this carrier as experimental rather than normative NAP/NIP authority. | ✓ VERIFIED | Package type-check/build passed; root declarations are explicit. Both public documents now cite the exact pinned ref and state that it defines no IPC carrier. |
| 7 | A socket pathname is available only from the host endpoint handle and is not peer authentication. | ✓ VERIFIED | `IpcEndpoint.path` is the public path; source and both docs explicitly deny authentication/cryptographic-identity claims and state the same-UID exclusion. |
| 8 | Empty ingress is a no-op; invalid separators, JSON, envelope shape, UTF-8, and EOF truncation fail closed. | ✓ VERIFIED | `json-sequence.test.ts` covers zero-record end, malformed/empty/scalar/array/null/missing-type/invalid-UTF-8 input, truncation, and permanent closure. |
| 9 | Decoder byte limits use exact UTF-8 bytes, accept only valid positive safe integers, and cannot resynchronize after failure. | ✓ VERIFIED | Exact-boundary, invalid-limit, and post-terminal-valid-frame tests passed. |
| 10 | Duplicate registration, rollback, idempotent close, and delayed old cleanup cannot tear down a replacement. | ✓ VERIFIED | Synchronous reservation plus monotonic generation comparisons are covered by real endpoint and private registry tests. |
| 11 | Directories are short, mode-0700, contained, and fingerprinted; active, substituted, or non-socket paths are left untouched. | ✓ VERIFIED | Real filesystem tests cover UTF-8 path threshold, active/refused stale sockets, files, symlinks, replacement directories, and compare-before-unlink. |
| 12 | Queue count/byte admission, encoded-byte accounting, zero policy, drain ownership, and terminal peer isolation are finite and ordered. | ✓ VERIFIED | Controlled-writer unit tests and two-peer integration coverage passed. |
| 13 | The exact pinned NAP authority is accurately represented in both public documents. | ✓ VERIFIED | Direct inspection of `napplet/naps@c0f7dd14460622fc3a9870ea57a538474cf776fa` found no IPC carrier. README and package docs now state that fact. |
| 14 | NAP-INC’s endpoint-binding statement is described as carrier-neutral, not as an IPC projection. | ✓ VERIFIED | `NAP-INC.md:365-367` says only that a projection defines how an authenticated endpoint is bound; both docs repeat the correct carrier-neutral interpretation. |
| 15 | Experimental/non-normative and hostile same-UID warnings remain conspicuous in both public documents. | ✓ VERIFIED | Direct wording scan found experimental, non-authentication, non-cryptographic, and same-UID limitations in both documents. |

**Score:** 25/25 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/shell-ipc/package.json` | Publishable ESM Node >=20 package boundary | ✓ VERIFIED | Correct package name, export map, engine, and no production runtime dependency. |
| `src/index.ts` and `src/types.ts` | Stable, documented public API only | ✓ VERIFIED | Generated declaration output exposes the planned factory/defaults/types/error and excludes transport internals. |
| `src/ipc-shell.ts` | Host binding, listener, ingress, ordered egress, lifecycle | ✓ VERIFIED | Production `node:net` factory is substantively wired to codec, queue, directory, and registry. |
| `src/json-sequence.ts` and tests | Bounded RFC 7464 codec | ✓ VERIFIED | Byte framing, fatal UTF-8, canonical guard, bounds, and terminal-state behavior tested. |
| `src/outbound-queue.ts` and tests | FIFO/backpressure finite queue | ✓ VERIFIED | Controlled-race tests cover ordering, false-write/drain, overflow, and stale callbacks. |
| `src/socket-directory.ts` and tests | Owned private socket lifecycle | ✓ VERIFIED | Real filesystem integration covers ownership and substitution defenses. |
| `src/endpoint-registry.ts` and tests | Generation-safe endpoint lifecycle | ✓ VERIFIED | Reservation and compare-before-removal behavior covered. |
| `packages/shell-ipc/README.md` | Accurate package-level authority and threat guidance | ✓ VERIFIED | Pinned source, no-IPC-carrier fact, carrier-neutral NAP-INC clarification, and threat boundaries present. |
| `docs/packages/shell-ipc.md` | Accurate documentation-site authority and threat guidance | ✓ VERIFIED | Synchronized with README and verified through `pnpm docs:check`. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ipc-shell.ts` | `json-sequence.ts` | accepted socket `data` → decoder → callback | ✓ WIRED | Bounded decoder runs before peer-claim guard and host callback. |
| `ipc-shell.ts` | `outbound-queue.ts` | `endpoint.send` → encoded frame → per-peer queue | ✓ WIRED | Encoded frames enter a socket-owned FIFO queue. |
| `ipc-shell.ts` | `socket-directory.ts` | registration generation → owned directory/listener | ✓ WIRED | Factory creates, listens through, and closes the directory handle. |
| `ipc-shell.ts` | `endpoint-registry.ts` | reservation/activation/current-generation cleanup | ✓ WIRED | Lifecycle uses matching-generation registry operations. |
| both public docs | pinned `napplet/naps` ref | explicit link + authority/spec-gap wording | ✓ WIRED | Plan 107-06 artifact/link query reports 2/2 verified. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `ipc-shell.ts` ingress | decoded `envelope` | raw accepted socket bytes → codec | Existing production local-socket test dispatches `shell.ready` unchanged | ✓ FLOWING |
| `ipc-shell.ts` egress | RFC 7464 response | `endpoint.send()` → queue → raw socket | Existing production local-socket test receives `shell.init` unchanged | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Type contract | `pnpm --filter @kehto/shell-ipc type-check` | Exit 0 | ✓ PASS |
| Focused transport behavior | `pnpm --filter @kehto/shell-ipc test:unit` | 5 files, 71 tests passed | ✓ PASS |
| ESM declaration build | `pnpm --filter @kehto/shell-ipc build` | ESM JS and declarations emitted | ✓ PASS |
| Public documentation | `pnpm docs:check` | TypeDoc, VitePress, and documentation audit passed | ✓ PASS |
| Exact authority wording | Direct pinned-object/tree/source scan | No IPC carrier exists; both docs state no IPC carrier and carrier-neutral NAP-INC clarification | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no conventional or phase-declared probe scripts exist.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
| --- | --- | --- | --- |
| IPC-01 | 107-03 | ✓ SATISFIED | Private endpoint allocation, guarded stale recovery, and owned cleanup remain tested. |
| IPC-02 | 107-02 | ✓ SATISFIED | Exhaustive split/coalesced UTF-8 RFC 7464 vectors remain tested. |
| IPC-03 | 107-05 | ✓ SATISFIED | Invalid/truncated/over-limit frames remain terminal before dispatch. |
| IPC-04 | 107-04 | ✓ SATISFIED | Per-peer FIFO/backpressure/finite queue behavior remains tested. |
| BIND-01 | 107-01, 107-06 | ✓ SATISFIED | Immutable host binding/no peer identity replacement and accurate non-authentication documentation are verified. |

No orphaned Phase 107 requirements were found: plan frontmatter accounts for exactly IPC-01 through IPC-04 and BIND-01.

### Anti-Patterns Found

No blocker or warning anti-patterns were found. No `TBD`, `FIXME`, or `XXX` debt markers occur in the Phase 107 implementation or public documentation.

### NAP Authority Check

The pinned local authority was inspected directly at `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`. Its NAP documents do not define an IPC, Unix-domain-socket, POSIX, or native OS-process carrier. `NAP-INC.md:365-367` establishes only the carrier-neutral rule that a projection defines binding for its authenticated endpoint.

Both public documents now accurately say that the pin defines no IPC carrier, identify the implementation as an experimental specification gap, and reject treating NAP-INC’s general binding sentence as IPC authority. Both also retain the required warning that private path distribution and permissions do not authenticate a peer or provide cryptographic identity, and that hostile same-UID processes are outside the threat model.

### Human Verification Required

### 1. Protocol authority language

**Test:** Review the public experimental/spec-gap wording.
**Expected:** No carrier implementation choice is represented as normative NAP/NIP authority.
**Why human:** This is a judgment-tier prohibition; direct source evidence is strong but protocol-language approval is a human decision.

### 2. Same-UID threat boundary

**Test:** Review the local-peer security limitation in both public documents.
**Expected:** Private paths and directory permissions are not presented as authentication or cryptographic protection, and hostile same-UID peers remain out of scope.
**Why human:** This is a judgment-tier prohibition; human security review is recommended.

### Re-verification Summary

The sole prior gap is closed with no implementation regression. The report is `human_needed`, rather than `passed`, only because Plan 107-01 includes two flagged judgment-tier prohibitions that require explicit human protocol/security acceptance; all automated and code-verifiable Phase 107 truths now pass.

---

_Verified: 2026-08-18T18:22:34Z_
_Verifier: the agent (gsd-verifier)_
