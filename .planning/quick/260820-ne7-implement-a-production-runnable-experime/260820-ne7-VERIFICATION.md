---
phase: quick-260820-ne7
verified: 2026-08-20T16:39:07Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "Direct projection regressions now prove onPeerDisconnected post-teardown timing, exactly-once delivery, pre-ready and host-close suppression, and stale-peer isolation."
  gaps_remaining: []
  regressions: []
---

# Quick Task 260820-ne7: Runnable IPC Shell Verification Report

**Task Goal:** Implement a production-runnable experimental IPC shell in `@kehto/shell-ipc`, not merely a library/proof, with production process lifecycle, packaged CLI, and complete lifecycle/security tests.

**Verified:** 2026-08-20T16:39:07Z
**Status:** passed
**Re-verification:** Yes — final direct-callback revision `08318e1`

## Goal Achievement

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Public host API owns immutable registration, narrow adapter, executable argv, and one lifecycle. | VERIFIED | `launchIpcShellHost` is exported; direct host tests prove the frozen cloned registration. |
| 2 | Installed CLI uses locked grammar, `shell:false`, and child-derived status. | VERIFIED | Bin mapping and hashbang exist; process tests cover grammar, literal metacharacter argv, numeric exit, and signals. |
| 3 | Child gets only the projection socket fact; host identity stays host-bound. | VERIFIED | Direct and built-bin reports scrub stale `KEHTO_IPC_*`, retain only the generated socket path, and omit registration sentinels. |
| 4 | Terminal paths converge on one race-safe cleanup result. | VERIFIED | Direct test and reproduction prove exact `close()`/`waitForExit()` promise identity, deferred resolution, cleanup, and listener restoration. |
| 5 | Independent child HUP/INT/TERM preserve exact reason/status. | VERIFIED | Direct raw runs and test matrix return `independent-child-signal` with 129/130/143. |
| 6 | Current-ready peer loss is distinct and safely observed. | VERIFIED | `runtime-shell.test.ts` directly proves callback-after-session-teardown, exactly-once delivery, pre-ready and host-close suppression, and stale-peer isolation; host/bin tests prove forced peer-disconnect escalation. |
| 7 | Proof-only host delegates lifecycle ownership without cross-stream ordering oracle. | VERIFIED | Example exports configuration only; process proof uses source-local milestones. |
| 8 | Shell-owned CLI errors redact host/path data; child output remains deliberately inherited. | VERIFIED | Revised D-11 boundary is documented; built-bin config/spawn failures emit fixed redacted categories. |
| 9 | API, bin, declarations, docs, changeset, and evidence agree. | VERIFIED | Sources, docs, package metadata, changeset, and focused checks describe the same experimental boundary. |

**Score:** 9/9 truths verified

## Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| `ipc-shell-host.ts` | VERIFIED | Single deferred terminal promise; signal/grace lifecycle; env scrub and cleanup. |
| `runtime-shell.test.ts` | VERIFIED | Direct projection callback regression matrix added by `08318e1`. |
| `ipc-shell-host.test.ts` | VERIFIED | Direct API lifecycle, registration, environment, cleanup, and listener coverage. |
| `ipc-projection-process.test.ts` | VERIFIED | Published-bin grammar, lifecycle, redaction, argv, environment, and cleanup coverage. |
| CLI/package/docs/changeset | VERIFIED | Runnable executable and revised inherited-stdio boundary are aligned. |

## Key Link Verification

| From | To | Status | Evidence |
| --- | --- | --- | --- |
| `cli.ts` | `ipc-shell-host.ts` | WIRED | Strict parser calls `launchIpcShellHost`; exact built binary executed. |
| `ipc-shell-host.ts` | `ipc-shell.ts` | WIRED | Current-ready peer callback reaches the single terminal gate. |
| `ipc-shell.ts` | `runtime-shell.test.ts` | WIRED | Tests exercise callback timing and all exclusion paths against `createIpcShellProjection`. |
| Raw fixture | host | WIRED | Generated socket environment drives real RFC 7464 ready/init/service/push flow. |
| Reference config | CLI | WIRED | Named configuration factory loads without duplicated lifecycle ownership. |

## Behavioral Spot-Checks

| Behavior | Result | Status |
| --- | --- | --- |
| Source + host + built-bin focused tests | 51 passed | PASS |
| Final callback + host + built-bin focused tests | 46 passed | PASS |
| Package type-check and build | passed | PASS |
| Exact terminal-promise reproduction | `close1 === close2 === waitForExit` true | PASS |
| Graceful/direct self-signal reproduction | numeric 0; independent 129/130/143 | PASS |
| Built-bin disconnect-ignore-term reproduction | exit 137 with raw `sigterm` milestone | PASS |
| Built-bin stale IPC environment reproduction | only generated socket fact reported | PASS |
| Built-bin forwarding/argv/redaction targeted tests | 5 passed | PASS |

## Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| `IPC-HOST` — launch and own a raw napplet process over the existing Unix-socket projection | SATISFIED | Public host API and packaged CLI own real raw child/projection lifecycles with required terminal, security, and cleanup coverage. |

## Anti-Patterns Found

No blocker or warning anti-patterns found. No `TBD`, `FIXME`, or `XXX` markers were found in the changed runnable-shell sources.

---

_Verified: 2026-08-20T16:39:07Z_
_Verifier: the agent (gsd-verifier)_
