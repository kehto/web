---
phase: 107
slug: ipc-transport-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
---

# Phase 107 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run packages/shell-ipc/src --reporter=dot` |
| **Full suite command** | `pnpm test:unit` |
| **Estimated runtime** | ~5 seconds focused; ~10 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the focused test file or `pnpm vitest run packages/shell-ipc/src --reporter=dot`.
- **After every plan wave:** Run `pnpm test:unit`.
- **Before `$gsd-verify-work`:** `pnpm build`, `pnpm type-check`, and `pnpm test:unit` must be green.
- **Max feedback latency:** 10 seconds for focused transport tests.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 107-01-01 | 01 | 1 | BIND-01 | T-107-01 | A raw socket traverses the production endpoint bidirectionally while all wire identity claims fail before host callback. | local socket tracer | `pnpm vitest run packages/shell-ipc/src/ipc-shell.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-01-02 | 01 | 1 | BIND-01 | T-107-04 | The locked package name/path builds as ESM with no runtime/session or external transport dependency. | build + type + unit | `pnpm --filter @kehto/shell-ipc build && pnpm --filter @kehto/shell-ipc type-check && pnpm --filter @kehto/shell-ipc test:unit` | ❌ W0 | ⬜ pending |
| 107-02-01 | 02 | 2 | IPC-02 | T-107-06 | Every byte/UTF-8 split, coalesced record, empty stream, independent decoder, and callback order preserves canonical envelopes. | unit | `pnpm vitest run packages/shell-ipc/src/json-sequence.test.ts packages/shell-ipc/src/ipc-shell.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-03-01 | 03 | 4 | IPC-01 | T-107-10/T-107-11 | Mode-0700 path creation, liveness/fingerprint stale recovery, substitution refusal, and owned cleanup use real POSIX fixtures. | filesystem integration | `pnpm vitest run packages/shell-ipc/src/socket-directory.test.ts packages/shell-ipc/src/ipc-shell.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-03-02 | 03 | 4 | IPC-01 | T-107-12/T-107-13 | Parallel/failed/repeated registration and delayed cleanup preserve only the current generation's resources. | deterministic concurrency unit | `pnpm vitest run packages/shell-ipc/src/endpoint-registry.test.ts packages/shell-ipc/src/socket-directory.test.ts packages/shell-ipc/src/ipc-shell.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-04-01 | 04 | 2 | IPC-04 | T-107-15/T-107-17 | Empty/exact/+1 count-byte bounds and safe-integer validation use encoded Buffer accounting including callback-pending writes. | unit | `pnpm vitest run packages/shell-ipc/src/outbound-queue.test.ts packages/shell-ipc/src/ipc-shell.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-04-02 | 04 | 2 | IPC-04 | T-107-16/T-107-18 | One writer owner preserves FIFO across false/drain/reentrant/stale events and cannot resume after terminal close. | deterministic concurrency unit | `pnpm vitest run packages/shell-ipc/src/outbound-queue.test.ts packages/shell-ipc/src/ipc-shell.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-05-01 | 05 | 3 | BIND-01 | T-107-02 | Public host binding remains recursively frozen and private generations prevent stale record removal. | unit + declaration build | `pnpm vitest run packages/shell-ipc/src/ipc-shell.test.ts -x && pnpm --filter @kehto/shell-ipc build` | ❌ W0 | ⬜ pending |
| 107-05-02 | 05 | 3 | IPC-03 | T-107-05/T-107-07/T-107-08 | Invalid framing/UTF-8/JSON/shape, peer-binding claims, EOF truncation, and exact/+1 byte limits terminate before dispatch and cannot resynchronize. | unit | `pnpm vitest run packages/shell-ipc/src/json-sequence.test.ts packages/shell-ipc/src/ipc-shell.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shell-ipc/package.json`, `tsconfig.json`, and `tsup.config.ts` — publishable Node ESM workspace skeleton.
- [ ] `packages/shell-ipc/src/ipc-shell.test.ts` — production raw `node:net` tracer and immutable host-binding vectors.
- [ ] `packages/shell-ipc/src/json-sequence.test.ts` — exhaustive framing and rejection vectors for IPC-02 and IPC-03.
- [ ] `packages/shell-ipc/src/socket-directory.test.ts` — owned-path and containment vectors for IPC-01.
- [ ] `packages/shell-ipc/src/endpoint-registry.test.ts` — immutable host registration vectors for BIND-01.
- [ ] `packages/shell-ipc/src/outbound-queue.test.ts` — ordering, drain, and overflow vectors for IPC-04.
- [ ] `vitest.config.ts` alias for `@kehto/shell-ipc` if integration tests import the package root.

---

## Manual-Only Verifications

All Phase 107 behaviors have automated verification. The same-UID local-process
threat boundary is documented rather than treated as cryptographic peer
authentication.

---

## Validation Sign-Off

- [ ] All tasks have automated verification or explicit Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Feedback latency remains below 10 seconds for focused tests.
- [ ] `nyquist_compliant: true` is set in frontmatter after execution evidence exists.

**Approval:** pending
