---
phase: 108
slug: runtime-shell-composition
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
---

# Phase 108 — Validation Strategy

> Per-phase validation contract for runtime-shell composition feedback sampling.

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Verified one-shot syntax** | `pnpm vitest run <files> --reporter=dot` |
| **Quick run command after Wave 0** | `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts --reporter=dot` |
| **Full suite command** | `pnpm test:unit` |
| **Current baseline proof** | `pnpm vitest run packages/shell-ipc/src/ipc-shell.test.ts --reporter=dot` passed 18/18 on Vitest 4.1.2 before planning |
| **Estimated feedback** | under 10 seconds focused; repository suite sampled after each wave |

All commands are one-shot `vitest run` invocations. No watch flag and no unsupported short fail-fast option is used.

## Sampling Rate

- **Wave 0 inside the tracer:** create `packages/shell-ipc/src/runtime-shell.test.ts` first and observe the readiness path fail before production edits.
- **After Task 108-01-01:** run the focused runtime-shell plus existing IPC transport files, package build, and package type-check.
- **After Task 108-02-01:** run the focused lifecycle files plus `packages/runtime/src/runtime.test.ts`.
- **After Task 108-02-02 / wave completion:** run focused parity + NAP-INC conformance, then full build/type/unit/slop/diff gates.
- **After Task 108-03-01:** run the raw-socket lifecycle matrix plus the existing transport file and package type-check.
- **After Task 108-03-02 / gap-closure completion:** run the combined shell-ipc/runtime/NAP-INC one-shot command, then package build/type-check and the full phase gate.
- **Max feedback latency:** focused feedback should remain below 10 seconds; no three behavior-adding steps occur without an automated run.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---:|---:|---|---|---|---|---|---|---|
| 108-01-01 | 01 | 1 | BIND-03, PROOF-01 | T-108-01..06, T-108-SC | One admitted raw peer sends exact bare readiness, receives one init, binds host identity, and reaches the unchanged runtime while a concurrent peer/pre-ready/payload-ready path stays inert. | raw-socket tracer + declaration/static boundary | `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts --reporter=dot && pnpm --filter @kehto/shell-ipc build && pnpm --filter @kehto/shell-ipc type-check` | ❌ Wave 0 creates `runtime-shell.test.ts` | ⬜ pending |
| 108-02-01 | 02 | 2 | BIND-02, BIND-04 | T-108-07, T-108-08, T-108-11, T-108-12 | Graceful, abrupt, endpoint, unregister, and projection-close paths clean only the matching token; delayed old close preserves replacement and sibling state. | raw-socket lifecycle/race integration | `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts packages/runtime/src/runtime.test.ts --reporter=dot` | ❌ Wave 0 creates, task expands | ⬜ pending |
| 108-02-02 | 02 | 2 | PROOF-04 | T-108-09, T-108-10 | Real runtime environment/host domain gates, ACL, capability eligibility, source identity, targeted egress, and NAP-INC cleanup remain enforced. | runtime parity + conformance | `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts tests/unit/nap-inc-conformance.test.ts --reporter=dot` | ❌ Wave 0 creates, task expands | ⬜ pending |
| 108-03-01 | 03 | 3 | BIND-04 | T-108-13, T-108-15, T-108-16, T-108-17 | Public endpoint close/unregister and composition shutdown apply ordered generation-safe runtime/session/carrier teardown without harming replacements or siblings. | raw-socket lifecycle/race gap closure | `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts --reporter=dot && pnpm --filter @kehto/shell-ipc type-check` | ✅ existing file expands RED-first | ⬜ pending |
| 108-03-02 | 03 | 3 | PROOF-04 | T-108-14, T-108-18 | Two dedicated endpoints share one runtime; A close delivers runtime-produced canonical inc.channel.closed only to surviving, still-usable B. | raw-socket NAP-INC integration + conformance | `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts packages/runtime/src/runtime.test.ts tests/unit/nap-inc-conformance.test.ts --reporter=dot && pnpm --filter @kehto/shell-ipc build && pnpm --filter @kehto/shell-ipc type-check` | ✅ existing file expands RED-first | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

## Wave 0 Requirements

- [ ] `packages/shell-ipc/src/runtime-shell.test.ts` — first action of tracer Task 108-01-01 creates failing raw-socket fixtures for single-peer admission, exact readiness, host-bound session identity, payload-ready diagnostic, pre-ready inertness, and targeted runtime egress.
- [ ] The fixture builds a local `RuntimeAdapter` from public `@kehto/runtime` types; it does not import runtime test utilities or edit runtime/browser-shell code.
- [ ] The fixture reuses the established raw `node:net`, RFC 7464, close-wait, and `try/finally` patterns from `ipc-shell.test.ts` while owning its helpers locally.
- [ ] Wave 0 is complete only when the focused file exists and the initial readiness expectation has been observed red before production implementation.

## Phase Gate

Run in this order after Wave 3:

1. `pnpm vitest run packages/shell-ipc/src --reporter=dot`
2. `pnpm vitest run packages/runtime/src/runtime.test.ts tests/unit/nap-inc-conformance.test.ts --reporter=dot`
3. `pnpm --filter @kehto/shell-ipc build`
4. `pnpm --filter @kehto/shell-ipc type-check`
5. `pnpm build`
6. `pnpm type-check`
7. `pnpm test:unit`
8. `npx --no-install aislop scan -d`
9. `git diff --check`
10. `test -z "$(git diff --name-only -- packages/runtime/src packages/shell/src)"`

The first nine commands must exit zero. The final source-boundary assertion must produce no output. The executor must not manufacture numeric test-count baselines; passing process exit status is the gate.

## Manual-Only Verifications

None. Same-UID peer authentication remains an explicitly accepted Phase 107 carrier limitation, not a behavior Phase 108 can automate or claim to solve.

## Multi-Source Coverage Audit

| Source | ID | Feature / constraint | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Connected processes receive authenticated NAP-SHELL/runtime guarantees through IPC lifecycle binding. | 01, 02, 03 | COVERED | Executed plans establish the single-endpoint path; Plan 03 closes verified public-lifecycle and shared-runtime proof gaps. |
| REQ | BIND-02 | One active peer; delayed/stale events cannot destroy replacement. | 02 | COVERED | Plan 01 establishes the tracer seam; Plan 02 owns the complete requirement and frontmatter claim. |
| REQ | BIND-03 | Bare ready, one init, no capability handler before readiness. | 01 | COVERED | Exact key check, duplicate idempotency, payload-ready diagnostic, and pre-ready inertness. |
| REQ | BIND-04 | Matching graceful/abrupt/unregister/shutdown cleanup. | 02, 03 | GAP CLOSURE PLANNED | Verification found the Plan 02 implementation lacked host-usable endpoint close/unregister; Plan 03 exposes and proves it. |
| REQ | PROOF-01 | Public runtime composition without runtime/envelope/browser-shell change. | 01 | COVERED | First-party workspace dependency plus static source-boundary assertion. |
| REQ | PROOF-04 | ACL/capability/identity/handshake/lifecycle parity. | 02, 03 | GAP CLOSURE PLANNED | Local policy parity passed; Plan 03 adds the missing shared-runtime, two-endpoint NAP-INC survivor proof. |
| RESEARCH | R-01 | Opaque targeted peer lifecycle seam; generic broadcast remains compatible. | 01 | COVERED | Queue-bound handle exposes no Socket/path/token. |
| RESEARCH | R-02 | `createIpcShellProjection` owns peer/readiness/runtime state. | 01, 03 | COVERED | Plan 03 restores the researched multi-registration host composition while retaining the executed single-registration convenience. |
| RESEARCH | R-03 | Payload-bearing ready policy. | 01 | COVERED | Ignore without session/init and emit redacted `SHELL_READY_PAYLOAD_IGNORED`. |
| RESEARCH | R-04 | Add first-party `@kehto/runtime@workspace:^` and lock metadata. | 01 | COVERED | Strictly required by implementation/declaration imports. |
| RESEARCH | R-05 | Token-guard destroyWindow then session unregister. | 02, 03 | GAP CLOSURE PLANNED | Plan 03 binds the proven ordering to public endpoint/unregister/shutdown ownership and stale endpoint generations. |
| RESEARCH | R-06 | Runtime eligibility/ACL/INC behavior remains authoritative. | 02, 03 | COVERED | Plan 03 delegates channel authorization/cleanup/notification to one unchanged shared Runtime; no IPC-local dispatcher/ACL. |
| CONTEXT | D-01 | Keep @kehto/shell-ipc and POSIX Unix sockets only. | 01 | COVERED | Tracer and public types cite D-01. |
| CONTEXT | D-02 | Canonical envelopes unchanged; IPC metadata outside wire. | 01, 02 | COVERED | Targeted sender accepts NappletMessage only; tests assert unchanged objects. |
| CONTEXT | D-03 | Identity from host registration only. | 01, 02 | COVERED | Session and teardown keyed by frozen registration + private token. |
| CONTEXT | D-04 | No Tauri/Electron/browser postMessage/injection/helper. | 01 | COVERED | API and modified-file boundary exclude those surfaces. |
| CONTEXT | D-05 | Existing browser @kehto/shell unchanged. | 01, 02 | COVERED | Automated source-diff assertion in both waves. |
| CONTEXT | D-06 | Pinned NAP authority; IPC remains spec gap. | 01 | COVERED | Fixed in must-haves/threat boundary; normative carrier-neutral behavior only. |
| CONTEXT | Deferred | Standalone process, demo roundtrip/push, docs/changeset, parity matrix, drafting evidence. | — | EXCLUDED | Explicit Phase 109 ownership, not a Phase 108 gap. |

## Validation Sign-Off Checklist

- [ ] Every task has an automated command using Vitest 4.1.2 one-shot syntax.
- [ ] Wave 0 creates the only missing focused test before production implementation.
- [ ] The gap-closure plan repeats only the failed BIND-04 and PROOF-04 IDs; BIND-02, BIND-03, and PROOF-01 remain assigned only to their original plans.
- [ ] D-01 through D-06 are cited in executable plan bodies and covered by the source audit.
- [ ] Same-wave file overlap is zero; Plan 108-03 depends on 108-02 before reopening the tightly coupled public types/barrel, `ipc-shell.ts`, and lifecycle test.
- [ ] Runtime and browser-shell source remain unchanged.
- [ ] Phase 109 artifacts remain outside the modified-file sets.
- [ ] Set `nyquist_compliant: true`, `wave_0_complete: true`, and `status: validated` only after the recorded execution evidence is green.

**Approval:** draft — Wave 3 gap-closure coverage added; execution evidence pending
