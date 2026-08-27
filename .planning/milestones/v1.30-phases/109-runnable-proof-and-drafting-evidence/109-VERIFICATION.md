---
phase: 109-runnable-proof-and-drafting-evidence
verified: 2026-08-20T14:32:45Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 109: Runnable Proof and Drafting Evidence Verification Report

**Phase Goal:** Maintainers can run and evaluate the experimental projection as a publishable package and use its recorded findings to draft an upstream IPC contract.
**Verified:** 2026-08-20T14:32:45Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A reference host and raw `node:net` napplet complete a correlated request/result with no injected interface or Kehto client helper. | VERIFIED | Built public-ESM host imports only `@kehto/shell-ipc`, starts the separate raw fixture, and uses the runtime service `send` callback for `intent.available.result`. The raw fixture imports only `node:net`, owns RS/UTF-8/LF framing, writes exact bare `shell.ready`, and matches `ipc-proof-available`. The focused process suite passed 12/12, and the documented host command produced the same-id transcript. |
| 2 | The same process receives a runtime-originated push; graceful and abrupt termination leave no session route or owned socket resource. | VERIFIED | The service retains `ServiceRuntimeContext` and calls `sendToEligibleNapplet(WINDOW_ID, intent.changed)`; the runtime guards live session, domain, recipient capability, and ACL before adapter egress. The process tests prove graceful and real post-push `SIGKILL` paths, then assert one cleanup record with session, endpoint path, directory, and re-registration-route absence. Forged/malformed/duplicate/unterminated/oversize child transcripts fail within bounds and preserve caller-owned content. |
| 3 | `@kehto/shell-ipc` builds as a publishable ESM package with complete API/README/package documentation and a conspicuous Node/POSIX experimental warning. | VERIFIED | `package.json` has ESM `dist` entry/types, Node `>=20`, `@napplet/core` peer range, and `@kehto/runtime` workspace dependency; `src/index.ts` exports the public composition contracts. README and package page contain the exact build/run commands plus explicit experimental, POSIX-only, unauthenticated, same-UID limits. Current package and workspace builds/type-check passed. |
| 4 | A parity matrix and drafting record pin the authority and distinguish responsibilities, bounded carrier choices, assumptions, and unresolved questions. | VERIFIED | `docs/reference/experimental-ipc-projection.md`, linked from package docs and the VitePress Reference sidebar, pins `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, states it defines no IPC carrier, classifies all rows as shared/carrier-specific/intentionally absent/unresolved, and separately records invariants, RFC 7464/path choices, same-UID non-authentication, limits/errors, lifecycle, and seven upstream questions. |
| 5 | Focused/process tests, Changeset, build, type-check, unit, relevant E2E, docs, and AI-slop gates pass without prohibited browser/runtime changes. | VERIFIED | The sole pending shell-ipc Changeset is `.changeset/quiet-rice-queue.md` with a minor bump. Current final-tree full chain exited 0: `pnpm build`, `pnpm type-check`, `pnpm test:unit`, selected NIP-5D Playwright, `pnpm docs:check`, and `npx --no-install aislop scan -d`; `git diff --check` passed. The scanner is exit-zero (97/100, zero errors); its two warnings are pre-existing Phase 107 comments in `json-sequence.ts`, not Phase 109-owned files. `origin/main...HEAD` has no `packages/runtime/src`, `packages/shell/src`, `tests/e2e`, or `apps/playground` source diff. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/shell-ipc/examples/ipc-projection-reference-host.mjs` | Public-ESM host, real runtime adapter/service, coordinated child lifecycle | VERIFIED | 255 substantive lines; public self-import, host-owned registration, service result/policy push, bounded process handling, caller-directory preservation, and cleanup. Direct documented run exited 0. |
| `packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs` | Raw Node-only child with local RFC 7464 codec | VERIFIED | 117 substantive lines; sole import is `node:net`; no Kehto/Napplet/browser/helper/import escape. |
| `packages/shell-ipc/src/ipc-projection-process.test.ts` | Process, forced-cleanup, adversarial, and static-boundary proof | VERIFIED | 241 substantive lines; spawn/drain/timeout harness exercises documented, delayed-normal, argument-order, forced, forged, and malformed paths. Focused run: 12/12. |
| `packages/shell-ipc/README.md` and `docs/packages/shell-ipc.md` | Synchronized host API and stability documentation | VERIFIED | Both expose public composition, exact commands, Node/POSIX warning, no-auth/same-UID boundary, and link the runnable proof/reference page. Strict docs gate passed. |
| `docs/reference/experimental-ipc-projection.md` and `docs/.vitepress/config.ts` | Discoverable authority, matrix, and drafting record | VERIFIED | Complete matrix and upstream questions are present; sidebar route is `/reference/experimental-ipc-projection`. |
| `.changeset/quiet-rice-queue.md` | Sole minor release intent | VERIFIED | Only branch Changeset mentioning `@kehto/shell-ipc`; describes transport, composition, proof, and drafting evidence. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| Process test | Reference host | Spawned public process with drained JSON-line transcript and bounded exit | WIRED | `spawnHost()` plus `expectProof()` exercises exact command, graceful and SIGKILL lifecycle. |
| Reference host | `@kehto/shell-ipc` | Public ESM self-reference | WIRED | `import { createIpcShellProjection } from '@kehto/shell-ipc'`; build and direct execution succeed. |
| Reference host | `ServiceRuntimeContext.sendToEligibleNapplet` | Retained registered service context | WIRED | Host only emits `intent.changed` after real runtime handler result; runtime context returns `true`, child receives it. |
| Raw fixture | Endpoint | `node:net` plus local RFC 7464 framing | WIRED | Child connects only with passed pathname; focused test verifies protocol transcript. |
| README/package page | Executed example and drafting page | Exact commands and canonical links | WIRED | Documentation command was executed and docs audit passed. |
| VitePress nav/package page | Drafting record | Reference route | WIRED | Sidebar and package-page links resolve in strict docs build. |
| Changeset | Package | One minor release declaration | WIRED | Branch-only Changeset guard finds exactly one file. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Public host request/result, push, graceful cleanup | `node packages/shell-ipc/examples/ipc-projection-reference-host.mjs --mode graceful` | Exit 0; child ready/init/result/push and host `service-dispatch`, `service-result`, `context-push`, and all-true cleanup transcript | PASS |
| Graceful/SIGKILL/adversarial process behavior | `pnpm --filter @kehto/shell-ipc build && pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts --reporter=dot` | 1 file, 12 tests passed | PASS |
| Current workspace gates | `pnpm build && pnpm type-check && pnpm test:unit && pnpm test:e2e -- tests/e2e/nip5d-contract-conformance.spec.ts && pnpm docs:check && npx --no-install aislop scan -d` | Exit 0; selected Playwright 1/1; docs audit checked 10 public package docs; scanner 0 errors | PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| PROOF-02 | 109-01 | SATISFIED | Raw child sends `intent.available` and receives real `intent.available.result` with `ipc-proof-available` through the shared Runtime. |
| PROOF-03 | 109-01 | SATISFIED | Retained service context sends policy-checked `intent.changed`; child observes it on the same socket projection. |
| PROOF-05 | 109-01 | SATISFIED | Fixture-local codec, sole `node:net` import, no interface injection or Kehto napplet helper; static and behavioral checks pass. |
| SPEC-01 | 109-02 | SATISFIED | ESM package manifest/barrel/build plus README/package documentation and conspicuous warning verified. |
| SPEC-02 | 109-02 | SATISFIED | Navigable four-class responsibility matrix verified. |
| SPEC-03 | 109-02 | SATISFIED | Exact pinned authority, no-carrier finding, security/lifecycle/limits/choices/questions all recorded. |
| SPEC-04 | 109-03 | SATISFIED | Sole minor Changeset, focused process coverage, full final-tree gates, and no-touch diff verified. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None in Phase 109-owned code/docs | — | No debt markers, placeholder behavior, direct peer-result/push bypass, private source import, or prohibited carrier implementation found. | — | — |

## Disconfirmation Checks

- **Potential partial requirement:** a child could fabricate stdout milestones. The adversarial forged-child case proves those records cannot manufacture a host service dispatch or context-push proof; the host waits for actual runtime-side milestones and exits failure.
- **Potential misleading test:** a normal process transcript alone could hide cleanup. The focused suite separately holds the real socket open, observes actual `SIGKILL` after result/push, then asserts cleanup before test-directory removal.
- **Potential untested error path:** malformed/duplicate/unterminated/oversize control output is covered by four bounded failure cases that preserve a caller sentinel and leave no endpoint entry.

## Gaps Summary

None. The checked `napplet/naps` ref defines no IPC carrier; this remains an explicitly documented upstream specification gap, not a conformance claim or blocker for the requested experimental evidence.

---

_Verified: 2026-08-20T14:32:45Z_
_Verifier: the agent (gsd-verifier)_
