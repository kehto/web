---
phase: 107-ipc-transport-foundation
verified: 2026-08-18T17:08:50Z
status: gaps_found
score: 24/25 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "The public package labels all IPC carrier choices as experimental against napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa."
    status: failed
    reason: "Both public package documents attribute a native OS-process IPC projection to the pinned NAP source, but the authoritative tree contains no such IPC projection."
    artifacts:
      - path: "packages/shell-ipc/README.md"
        issue: "Lines 25-27 claim the NAP registry lists native OS-process IPC as a possible projection."
      - path: "docs/packages/shell-ipc.md"
        issue: "Lines 49-51 repeat the unsupported native OS-process IPC projection claim."
    missing:
      - "Replace the unsupported attribution with the accurate spec-gap statement: the pinned NAP source defines no IPC carrier; NAP-INC's generic projection-binding sentence is not an IPC projection."
human_verification:
  - test: "Review the experimental-authority wording after the documented correction."
    expected: "No public API or documentation text presents carrier framing, lifecycle, limits, or trust choices as normative NAP/NIP authority."
    why_human: "This is a judgment-tier prohibition; the automated verifier can locate claims but cannot authoritatively approve protocol-language interpretation."
  - test: "Review the local-peer threat-boundary wording after the documented correction."
    expected: "The package continues to state that private paths and mode-0700 directories are neither authentication nor cryptographic protection, and that hostile same-UID peers are out of scope."
    why_human: "This is a judgment-tier prohibition; the verifier found the required disclaimers but human security review remains recommended."
---

# Phase 107: IPC Transport Foundation Verification Report

**Phase Goal:** Host integrators can create a bounded, private, identity-bound Unix-domain socket endpoint that safely transports canonical NIP-5D envelopes.
**Verified:** 2026-08-18T17:08:50Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Host registration is immutable before one dedicated pathname listener exists, and peer wire claims cannot replace it. | ✓ VERIFIED | `ipc-shell.ts` validates, clones, and recursively freezes before registry reservation/listen; rejects own `windowId`, `dTag`, `aggregateHash`, and `environment` claims before `hooks.onEnvelope`. The raw-socket test exercises caller mutation and all four claims. |
| 2 | Partial and coalesced raw input yields unchanged canonical envelopes under RFC 7464 framing. | ✓ VERIFIED | Byte-oriented `RS + UTF-8 JSON + LF` codec and every-byte-split/coalesced-frame tests passed. |
| 3 | Malformed, truncated, invalid-UTF-8, oversized, and over-buffered input fails closed before host dispatch. | ✓ VERIFIED | Decoder tests cover syntax/shape/UTF-8/truncation/terminal state. Independent built-package socket probes with tight frame and aggregate-buffer limits both closed the peer with `dispatched: 0`. |
| 4 | Outbound messages are FIFO-bounded and obey backpressure. | ✓ VERIFIED | One queue owns each socket; `write(false)` installs one drain listener and accounting retains callback-pending frames. Queue and integration race tests passed. |
| 5 | Recovery and cleanup affect only matching owned endpoint resources. | ✓ VERIFIED | Mode-0700 directories, path/device/inode fingerprints, lstat rechecks, socket-type checks, and generation guards are exercised by filesystem and registry tests. |
| 6 | The public package is `@kehto/shell-ipc`, ESM-only, Node >=20/POSIX-only, and accurately frames the carrier as an experimental NAP spec gap at the pinned authority. | ✗ FAILED | Package/build surface and most warnings are correct, but README and package docs falsely say the pinned NAP source lists native OS-process IPC as a possible projection. |
| 7 | A pathname is host-handle connection information, not peer authentication. | ✓ VERIFIED | The only public path is `IpcEndpoint.path`; source/README/package docs explicitly reject pathname- or permission-based authentication and document the same-UID boundary. |
| 8 | Empty ingress is a no-op; empty records and malformed separators fail closed. | ✓ VERIFIED | `json-sequence.test.ts` covers zero-record end, empty JSON record, bytes before RS, terminal behavior, and decoder closure. |
| 9 | Multibyte envelopes preserve UTF-8 bytes across every split without normalization or replacement. | ✓ VERIFIED | Exhaustive byte-split test uses accented, CJK, and emoji payloads; encoder test asserts exact UTF-8 JSON bytes. |
| 10 | Decoder instances are isolated and coalesced records reach callbacks synchronously in wire order. | ✓ VERIFIED | Independent interleaved-decoder and synchronous coalesced-frame tests passed. |
| 11 | Repeated registration/close cycles are idempotent and create fresh endpoint generations. | ✓ VERIFIED | Registry transition and real replacement endpoint tests passed. |
| 12 | Duplicate registration, rollback, and delayed cleanup cannot affect a replacement. | ✓ VERIFIED | Reservation is synchronous before filesystem work; matching-generation guards are tested for duplicate, rollback, delayed old close, and replacement. |
| 13 | Directory ownership checks include private mode, UTF-8 path bounds, containment, fingerprints, and socket type. | ✓ VERIFIED | `createSocketDirectory` performs these checks and filesystem tests cover exact UTF-8 length and `0700` mode. |
| 14 | Active stale paths are preserved and substituted files, symlinks, directories, or fingerprints are not removed. | ✓ VERIFIED | Live-server, refused-stale, regular-file, symlink, substituted-path, and replacement-directory test vectors passed. |
| 15 | Diagnostics redact full paths while host endpoint handles retain them. | ✓ VERIFIED | `IpcDiagnostic` contains only code plus `windowId`/`dTag`/`aggregateHash`; `IpcEndpoint.path` is the only public full pathname. |
| 16 | Queue admission has exact frame/byte boundaries, including a deliberate zero-buffer policy. | ✓ VERIFIED | Controlled-writer boundary tests cover exact, one-over, and zero policies. |
| 17 | Queue accounting measures encoded Buffer bytes, including multibyte payloads. | ✓ VERIFIED | Queue tests use RFC-7464 encoded frames and multibyte payloads rather than JavaScript character counts. |
| 18 | Queue limits reject invalid precision values before operation. | ✓ VERIFIED | `validateQueueLimits` and table-driven invalid limit tests reject non-safe, negative, fractional, NaN, and infinity values. |
| 19 | Only one queue owner writes per peer; drain, enqueue, completion, close, and overflow races cannot overlap or resume terminal output. | ✓ VERIFIED | Guarded `flushing`/`waitingForDrain` state plus controlled writer tests cover false writes, repeated drains, stale callbacks, and terminal detachment. |
| 20 | A slow peer has finite pending frames/bytes and receives one terminal overflow diagnostic without suppressing later peers. | ✓ VERIFIED | Pending plus callback-pending accounting, terminal-once test, and two-peer broadcast integration test passed. |
| 21 | The documented public contract has the planned type/error surface while internal codec/queue/directory/registry helpers stay private. | ✓ VERIFIED | Root barrel and generated `dist/index.d.ts` expose only factory, defaults, listed public types, and `IpcTransportError`. |
| 22 | Endpoint generation is monotonic and obsolete callbacks cannot remove a current record. | ✓ VERIFIED | `createEndpointRegistry` compares `windowId` plus generation; focused stale-generation tests passed. |
| 23 | Decoder limits require positive safe integers and reject invalid values before accepting bytes. | ✓ VERIFIED | Constructor validation and table-driven tests cover NaN, infinities, negative, zero, fractional, and above-safe-integer inputs. |
| 24 | The first invalid record irreversibly closes the decoder; later bytes cannot resynchronize or dispatch. | ✓ VERIFIED | `fail()` clears the buffer and marks closed; invalid-matrix tests then assert `DECODER_CLOSED` for a later valid frame. |
| 25 | The code and documentation state the bounded same-UID threat model and deny cryptographic pathname authentication. | ✓ VERIFIED | `types.ts`, `ipc-shell.ts`, `socket-directory.ts`, README, and package docs contain explicit non-authentication and hostile-same-UID disclaimers. |

**Score:** 24/25 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/shell-ipc/package.json` | ESM Node >=20 workspace boundary | ✓ VERIFIED | Correct package name, ESM export map, Node engine, no runtime dependency. |
| `src/index.ts` / `src/types.ts` | Stable documented public transport API | ✓ VERIFIED | Build emitted the exact public declaration surface; carrier internals excluded. |
| `src/ipc-shell.ts` | Endpoint factory, registration binding, ingress/egress lifecycle | ✓ VERIFIED | Substantive `node:net` transport wired to all internal seams. |
| `src/json-sequence.ts` / `.test.ts` | Bounded RFC 7464 codec | ✓ VERIFIED | Production byte state machine and 10 focused tests. The artifact helper's literal `every split` check was a false negative; the actual test says `every possible byte split`. |
| `src/outbound-queue.ts` / `.test.ts` | FIFO backpressure owner | ✓ VERIFIED | Serialized write/drain state machine with 11 controlled-race tests. |
| `src/socket-directory.ts` / `.test.ts` | Private owned socket filesystem lifecycle | ✓ VERIFIED | Fingerprint/containment checks with six filesystem integration tests. |
| `src/endpoint-registry.ts` / `.test.ts` | Reservation and generation safety | ✓ VERIFIED | Private record lifecycle with six focused tests. |
| `packages/shell-ipc/README.md`, `docs/packages/shell-ipc.md` | Accurate experimental authority documentation | ✗ FAILED | Correct threat disclaimers, but unsupported NAP IPC-projection attribution remains. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ipc-shell.ts` | `json-sequence.ts` | `socket.on('data') → decoder.push → onEnvelope` | ✓ WIRED | Bounded decoder is called before peer-claim guard and host callback. |
| `ipc-shell.ts` | `outbound-queue.ts` | `endpoint.send → encode → queue.enqueue` | ✓ WIRED | One queue is created per accepted socket and receives encoded Buffer frames. |
| `ipc-shell.ts` | `socket-directory.ts` | registration generation → owned directory/listener | ✓ WIRED | Factory creates, listens through, and closes the owned directory handle. |
| `ipc-shell.ts` | `endpoint-registry.ts` | reservation/activation/current-generation cleanup | ✓ WIRED | Endpoint creation and close use matching-generation registry calls. |
| `socket-directory.ts` | `node:fs/promises` | lstat/fingerprint/containment before unlink/rmdir | ✓ WIRED | Direct `lstat`, `unlink`, `rmdir`, and recheck paths are present and exercised. |
| `outbound-queue.ts` | `node:net.Socket.write` | false-write pause and single drain resumption | ✓ WIRED | Controlled writer behavior and integration coverage confirm the connection. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `ipc-shell.ts` ingress | decoded `envelope` | Raw accepted `node:net` socket bytes → bounded decoder | Raw integration test dispatches `{ type: 'shell.ready' }` unchanged | ✓ FLOWING |
| `ipc-shell.ts` egress | encoded response frame | Host `endpoint.send()` → RFC 7464 queue → raw socket | Raw integration test receives `{ type: 'shell.init', version: 1 }` unchanged | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Package type contract | `pnpm --filter @kehto/shell-ipc type-check` | Exit 0 | ✓ PASS |
| Focused transport behavior | `pnpm --filter @kehto/shell-ipc test:unit` | 5 files, 71 tests passed | ✓ PASS |
| Publishable ESM output | `pnpm --filter @kehto/shell-ipc build` | ESM JS and declarations emitted | ✓ PASS |
| Frame limit terminal dispatch guard | built-package raw socket probe, `maxFrameBytes: 10` | Peer closed; `dispatched: 0` | ✓ PASS |
| Buffer limit terminal dispatch guard | built-package raw socket probe, `maxBufferedInputBytes: 10` | Peer closed; `dispatched: 0` | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no conventional or phase-declared probe scripts exist.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| IPC-01 | 107-03 | Dedicated private endpoint, guarded stale recovery, owned cleanup | ✓ SATISFIED | Socket-directory and endpoint-registry filesystem/race tests passed. |
| IPC-02 | 107-02 | RFC 7464 canonical envelopes across partial/coalesced chunks | ✓ SATISFIED | Exhaustive split, coalescing, UTF-8, and isolation tests passed. |
| IPC-03 | 107-05 | Invalid/truncated/oversized input fails before dispatch with finite limits | ✓ SATISFIED | Decoder matrix plus independent raw-socket oversized/over-buffer probes passed. |
| IPC-04 | 107-04 | Ordered bounded egress under backpressure | ✓ SATISFIED | Controlled queue races and endpoint peer-isolation integration passed. |
| BIND-01 | 107-01 | Host-only immutable identity before listen; no peer replacement | ✓ SATISFIED | Registration validation/freeze and production local-socket peer-claim tests passed. |

No orphaned Phase 107 requirements were found: plan frontmatter declares exactly IPC-01 through IPC-04 and BIND-01, matching `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `packages/shell-ipc/README.md` | 25-27 | Unsupported NAP authority attribution | 🛑 Blocker | Public experimental/spec-gap documentation is factually inaccurate. |
| `docs/packages/shell-ipc.md` | 49-51 | Unsupported NAP authority attribution | 🛑 Blocker | Package documentation repeats the same inaccurate authority claim. |

No `TBD`, `FIXME`, or `XXX` debt markers were found in Phase 107 implementation or documentation files.

### NAP Authority Check

The pinned authority was inspected directly from local `napplet/naps` at `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`. Its five NAP documents contain no IPC, Unix-domain socket, POSIX, or native OS-process IPC projection. `NAP-INC.md` only states generically that a projection defines how its authenticated endpoint is bound (line 367); it does not authorize or describe this carrier.

The source JSDoc is accurate: `types.ts` says the ref “defines no IPC carrier,” and it correctly limits the security claim. The same-UID boundary is also accurately and conspicuously described throughout the public surface. The two prose documents need the unsupported “lists native OS-process IPC” sentence removed or corrected.

### Human Verification Required

The two judgment-tier prohibitions in Plan 107-01 remain non-authoritative automated assessments. Human protocol/security review is recommended after correcting the authority sentence; the required non-normative and non-authentication language is present today.

### Gaps Summary

The transport goal is implemented and exercised: all five roadmap runtime success criteria and every mapped requirement have direct code/test evidence. Phase 107 cannot pass yet because its public README and package-doc page misstate what the exact pinned upstream NAP authority contains. Correct those two claims to say that no NAP defines this IPC carrier (without asserting that the registry lists native IPC), then re-run verification.

---

_Verified: 2026-08-18T17:08:50Z_
_Verifier: the agent (gsd-verifier)_
