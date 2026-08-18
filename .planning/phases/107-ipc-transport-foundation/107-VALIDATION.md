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
| 107-01-01 | 01 | 1 | IPC-02 | T-107-01 | Framing preserves canonical envelopes across every stream split and coalesced record. | unit | `pnpm vitest run packages/shell-ipc/src/json-sequence.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-01-02 | 01 | 1 | IPC-03 | T-107-02 | Invalid UTF-8, malformed/truncated records, and finite-limit violations close before receiver dispatch. | unit | `pnpm vitest run packages/shell-ipc/src/json-sequence.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-02-01 | 02 | 2 | IPC-01 | T-107-03 | Endpoint creation and cleanup remain contained to a private owned directory and matching socket path. | filesystem integration | `pnpm vitest run packages/shell-ipc/src/socket-directory.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-02-02 | 02 | 2 | BIND-01 | T-107-04 | Host metadata is cloned and frozen before listen; peer frames cannot supply or replace identity. | unit + local socket smoke | `pnpm vitest run packages/shell-ipc/src/endpoint-registry.test.ts -x` | ❌ W0 | ⬜ pending |
| 107-03-01 | 03 | 3 | IPC-04 | T-107-05 | Egress remains ordered, pauses on `write() === false`, resumes on `drain`, and closes on count or byte overflow. | unit | `pnpm vitest run packages/shell-ipc/src/outbound-queue.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shell-ipc/package.json`, `tsconfig.json`, and `tsup.config.ts` — publishable Node ESM workspace skeleton.
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
