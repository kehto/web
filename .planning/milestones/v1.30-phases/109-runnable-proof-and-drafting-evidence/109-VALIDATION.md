---
phase: 109
slug: runnable-proof-and-drafting-evidence
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-20
---

# Phase 109 — Validation Strategy

> Per-phase validation contract for the raw-process proof, public drafting evidence, and release gate.

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | Vitest 4.1.2 in Node; existing Playwright 1.59.1 selection for web regression |
| **Config files** | `vitest.config.ts`, `playwright.config.ts` |
| **Wave 0 command** | `pnpm --filter @kehto/shell-ipc build && pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts --reporter=dot` |
| **Focused process command** | `pnpm --filter @kehto/shell-ipc build && pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts packages/shell-ipc/src/runtime-shell.test.ts --reporter=dot` |
| **Package command** | `pnpm --filter @kehto/shell-ipc test:unit` |
| **Full unit command** | `pnpm test:unit` |
| **Relevant E2E** | `pnpm test:e2e -- tests/e2e/nip5d-contract-conformance.spec.ts` |
| **Docs command** | `pnpm docs:check` |
| **AI-slop command** | `npx --no-install aislop scan -d` (local 0.14.1; no install) |

All Vitest commands are one-shot `vitest run` invocations. No watch mode, invented count baseline, or unsupported short fail-fast option is used. The process harness owns bounded waits and exact child cleanup; the full repository gates are intentionally reserved for Wave 3.

## Sampling Rate

- **Wave 0 / Task 109-01-01:** create `ipc-projection-process.test.ts` first and observe the public-host process proof fail before adding host/child executables.
- **After Task 109-01-01:** run the freshly built public-package graceful proof.
- **After Task 109-01-02 / Wave 1:** run process proof plus existing runtime-shell tests and package type-check.
- **After Task 109-02-01:** run the process proof and strict docs audit so commands/API names cannot drift.
- **After Task 109-02-02 / Wave 2:** run docs audit plus exact authority/classification/discoverability checks.
- **After Task 109-03-01:** assert one exact minor Changeset.
- **After Task 109-03-02 / Wave 3:** run the complete focused/package/repository/relevant-E2E/docs/AI-slop/diff matrix.
- **Continuity:** no behavior- or contract-adding task completes without an automated one-shot command.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---:|---:|---|---|---|---|---|---|---|
| 109-01-01 | 01 | 1 | PROOF-02, PROOF-03, PROOF-05 | T-109-01..05, T-109-07 | Public-ESM host and raw built-in-only child prove exact ready/init, same-id real service result, eligible context push, redacted transcript, and graceful cleanup. | spawned-process integration + static fixture guard | `pnpm --filter @kehto/shell-ipc build && pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts --reporter=dot` | ✅ | ✅ green |
| 109-01-02 | 01 | 1 | PROOF-02, PROOF-03, PROOF-05 | T-109-04, T-109-06 | A real SIGKILL after result/push converges with graceful termination on matching session/path/directory cleanup. | spawned-process lifecycle/race integration | `pnpm --filter @kehto/shell-ipc build && pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts packages/shell-ipc/src/runtime-shell.test.ts --reporter=dot && pnpm --filter @kehto/shell-ipc type-check` | ✅ | ✅ green |
| 109-02-01 | 02 | 2 | SPEC-01 | T-109-09, T-109-10, T-109-12 | Public docs use real exports/commands and preserve experimental/no-auth/same-UID limits. | process regression + strict docs build | `pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts --reporter=dot && pnpm docs:check` | ✅ | ✅ green |
| 109-02-02 | 02 | 2 | SPEC-02, SPEC-03 | T-109-08..13 | Discoverable matrix/drafting record pins exact authority, classifies every responsibility, and separates invariants from local choices. | VitePress/TypeDoc audit + static wording | `pnpm docs:check` plus the positive `rg -q` checks in Plan 109-02 | ✅ | ✅ green |
| 109-03-01 | 03 | 3 | SPEC-04 | T-109-14 | Exactly one pending shell-ipc Changeset remains minor and describes complete shipped output. | release-metadata static guard | `test "$(rg -l '"@kehto/shell-ipc"' .changeset --glob '*.md')" = '.changeset/quiet-rice-queue.md' && rg -q '"@kehto/shell-ipc": minor' .changeset/quiet-rice-queue.md` | ✅ | ✅ green |
| 109-03-02 | 03 | 3 | SPEC-04 | T-109-15..19 | Final source passes focused/package/full/relevant-E2E/docs/scanner/diff/no-touch gates without fabricated or stale evidence. | integrated release gate | Full one-shot command in Plan 109-03 Task 02 | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠ flaky*

## Wave 0 Requirements

- [x] `packages/shell-ipc/src/ipc-projection-process.test.ts` — RED-first process proof now exercises graceful, SIGKILL, CLI, forged, malformed, duplicate, unterminated, oversize, and timeout boundaries.
- [x] `packages/shell-ipc/examples/ipc-projection-reference-host.mjs` — public-ESM host passes both direct and spawned proof.
- [x] `packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs` — local codec and exact `node:net` import are covered by static and behavioral checks.
- [x] Existing Vitest, Node >=20, shell-ipc build, and Unix-socket infrastructure require no installation.

## Phase Gate

Run in this order after Wave 3:

1. `pnpm --filter @kehto/shell-ipc build`
2. `pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts --reporter=dot`
3. `pnpm --filter @kehto/shell-ipc type-check`
4. `pnpm build`
5. `pnpm type-check`
6. `pnpm test:unit`
7. `pnpm test:e2e -- tests/e2e/nip5d-contract-conformance.spec.ts`
8. `pnpm docs:check`
9. `npx --no-install aislop scan -d`
10. `git diff --check`
11. `test -z "$(git diff --name-only 765989a..HEAD -- packages/runtime/src packages/shell/src tests/e2e)"`
12. Assert `.changeset/quiet-rice-queue.md` is the only pending shell-ipc Changeset and remains minor.

Every command must exit zero. The Playwright selection is an unchanged-browser regression gate only: Phase 109 has no UI and deliberately adds no browser test. Scanner findings in Phase 109-owned files must be fixed without changing `.aislop/config.yml`; unrelated/pre-existing state must be reported accurately rather than erased or called 100/100.

## Manual-Only Verifications

None. Protocol-authority/security wording is checked by exact source, docs audit, code review, and the later phase security audit; this phase does not claim to authenticate hostile same-UID peers.

## Multi-Source Coverage Audit

| Source | ID | Feature / constraint | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Maintainers can run/evaluate the publishable projection and use findings to draft an IPC contract. | 01-03 | COVERED | Process proof, public evidence, and release gates form one sequential outcome. |
| REQ | PROOF-02 | Correlated request/result across host and raw process. | 01 | COVERED | Real intent service sends same-id result through runtime dispatch. |
| REQ | PROOF-03 | Runtime-originated push on the same projection. | 01 | COVERED | Service context sends recipient-mapped intent.changed and must return true. |
| REQ | PROOF-05 | Raw node:net/local framing; no injected interface or helper. | 01 | COVERED | Fixture-local codec plus static import/source boundary. |
| REQ | SPEC-01 | Publishable ESM API/README/package docs/stability warning. | 02 | COVERED | Existing export boundary documented and docs audited. |
| REQ | SPEC-02 | Web/IPC parity matrix with four classifications. | 02 | COVERED | One navigable reference page owns the complete matrix. |
| REQ | SPEC-03 | Exact-ref drafting findings with choices/security/questions. | 02 | COVERED | Same page separates authority, local evidence, and unresolved questions. |
| REQ | SPEC-04 | Focused/process tests, one Changeset, docs, and all gates. | 03 | COVERED | Exact minor release intent plus final integrated matrix. |
| RESEARCH | R-01 | Built-public-package host launches raw child and emits deterministic transcript. | 01 | COVERED | Standalone example + process harness. |
| RESEARCH | R-02 | Real intent.available/result correlation through ServiceHandler. | 01 | COVERED | Host-local service uses runtime send callback. |
| RESEARCH | R-03 | Policy-checked intent.changed through retained ServiceRuntimeContext. | 01 | COVERED | No direct peer write or injectEvent path. |
| RESEARCH | R-04 | Graceful and SIGKILL cleanup before outer recursive removal. | 01 | COVERED | Independent cases and base-directory assertions. |
| RESEARCH | R-05 | No external package; Node built-ins and first-party workspace packages only. | 01, 03 | COVERED | No install task; scanner uses no-install. |
| RESEARCH | R-06 | README/package page and one navigable parity/drafting page. | 02 | COVERED | Four documentation files only. |
| RESEARCH | R-07 | Amend existing minor Changeset rather than duplicate. | 03 | COVERED | Exact single-path guard. |
| RESEARCH | R-08 | Existing relevant E2E only; no new Playwright IPC surface. | 03 | COVERED | One selected NIP-5D contract regression. |
| RESEARCH | R-09 | Exact NAP authority; carrier is an explicit specification gap. | 02 | COVERED | Pinned links and required wording. |
| RESEARCH | R-10 | Runtime/browser shell/carrier source remain read-only. | 01-03 | COVERED | File ownership plus final base-commit diff. |
| CONTEXT | D-01 | Standalone public-ESM host and raw node:net napplet. | 01 | COVERED | Host launches raw child; child has local codec. |
| CONTEXT | D-02 | Bare ready, one init, real same-id result, no synthetic/direct/helper path. | 01 | COVERED | Process transcript and static assertions. |
| CONTEXT | D-03 | Host push only via sendToEligibleNapplet with real mapping. | 01 | COVERED | intent.changed context route and true delivery result. |
| CONTEXT | D-04 | Clean and forced termination leave no route/socket resource. | 01 | COVERED | Graceful and SIGKILL cases. |
| CONTEXT | D-05 | One package; complete docs/runnable host/warnings. | 02 | COVERED | README and package page. |
| CONTEXT | D-06 | Reconcile one minor Changeset; keep ESM/peer/runtime dependency. | 03 | COVERED | One existing release file only. |
| CONTEXT | D-07 | Focused process suite + relevant existing E2E; no new browser test. | 01, 03 | COVERED | Process Vitest and selected Playwright gate. |
| CONTEXT | D-08 | One discoverable page with four-class parity matrix. | 02 | COVERED | Reference route linked from package docs/nav. |
| CONTEXT | D-09 | Exact ref, no IPC carrier, invariants/choices/questions separated. | 02 | COVERED | Complete drafting record. |
| CONTEXT | D-10 | Preserve frozen identity/readiness/peer/egress/eligibility/cleanup. | 01, 02 | COVERED | Runtime test regression and precise docs. |
| CONTEXT | D-11 | Exclude Windows/remote/broker/desktop/browser/helper/runtime-shell edits. | 01-03 | COVERED | Explicit ownership/no-touch diff; absent/unresolved docs classifications. |
| CONTEXT | Deferred | Windows, remote/broker, authentication standard, reusable client/injection, browser/runtime changes. | — | EXCLUDED | Explicitly deferred by the user; no task implements them. |

## Validation Sign-Off

- [x] Every task has an automated one-shot command.
- [x] Requirements are allocated exactly once across plan frontmatter: 3 in Plan 01, 3 in Plan 02, 1 in Plan 03.
- [x] Wave 0 creates the only missing process test before fixtures.
- [x] No three behavior/contract tasks occur without automated feedback.
- [x] Every D-01 through D-11 decision is cited and covered; deferred ideas are excluded.
- [x] No new external package or legitimacy checkpoint is needed.
- [x] No same-wave file overlap exists; waves are strictly 01 → 02 → 03.
- [x] No Playwright source is added because there is no UI/browser behavior.
- [x] Wave 0 files exist and pass.
- [x] `nyquist_compliant: true` and `status: validated` set after Nyquist audit.

**Approval:** Validated — all Phase 109 requirements have automated green evidence.

## Validation Audit 2026-08-20

| Metric | Count |
|--------|-------|
| Requirements audited | 7 |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

### Current Evidence

- `pnpm --filter @kehto/shell-ipc build && pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts packages/shell-ipc/src/runtime-shell.test.ts --reporter=dot` — 2 files, 22 tests green. This includes real raw-process request/result and push, SIGKILL cleanup, CLI parsing, forged child transcript rejection, malformed/duplicate/unterminated/oversize transcript rejection, and normal-versus-test timeout behavior.
- `node packages/shell-ipc/examples/ipc-projection-reference-host.mjs --mode graceful` — green, producing the ordered redacted raw-child/host transcript and all-true cleanup record.
- `pnpm docs:check` plus exact pinned-authority, route, and sole-minor-Changeset static checks — green.
- `node --check` passed for the reference host and both raw/adversarial child fixtures; `git diff --check` and the Phase 108 baseline no-touch scan for runtime/browser/E2E source were empty.

No test gap was safe or necessary to add: the existing process suite directly covers every Phase 109 requirement, including the adversarial regressions identified during review. The NAP source remains `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; it defines no IPC carrier, which is documented as an experimental specification gap rather than a conformance claim.
