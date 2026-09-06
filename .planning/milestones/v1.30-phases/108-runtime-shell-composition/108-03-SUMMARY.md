---
phase: 108
plan: 03
subsystem: shell-ipc
tags: [ipc, unix-socket, runtime, nap-shell, nap-inc]
dependency_graph:
  requires: [108-01, 108-02]
  provides: [shared-runtime-ipc-composition, generation-safe-endpoint-lifecycle, inc-survivor-proof]
  affects: [packages/shell-ipc]
tech_stack:
  added: []
  patterns: [host-private-endpoint-records, targeted-runtime-egress, retire-destroy-unregister-close]
key_files:
  created: []
  modified:
    - packages/shell-ipc/src/types.ts
    - packages/shell-ipc/src/ipc-shell.ts
    - packages/shell-ipc/src/index.ts
    - packages/shell-ipc/src/runtime-shell.test.ts
decisions:
  - "A registration-less factory returns a shared IPC composition; the registration-bearing overload retains the existing one-endpoint projection shape."
  - "Endpoint record identity plus private peer generations authorize teardown; host window IDs alone never authorize a stale cleanup."
  - "Endpoint closure removes its runtime route before Runtime.destroyWindow, then unregisters the matching session before carrier cleanup."
metrics:
  duration: 7m
  completed_date: 2026-08-20
  tasks_completed: 2
  files_modified: 4
status: complete
---

# Phase 108 Plan 03: Shared IPC Runtime Lifecycle Summary

`@kehto/shell-ipc` now exposes a multi-endpoint, single-Runtime composition with host-owned lifecycle controls and a raw-socket NAP-INC survivor regression.

## Accomplished

- Added `IpcShellComposition`, `IpcShellEndpoint`, and deliberate public exports while preserving the existing registration-bearing `createIpcShellProjection` convenience result.
- Composed runtime egress and domain checks through current host-private endpoint records, preserving frozen registrations, one-peer admission, exact bare `shell.ready`, and targeted canonical delivery.
- Bound graceful peer loss, endpoint close, host unregister, and composition shutdown to retire → `Runtime.destroyWindow` → session unregister → carrier cleanup.
- Added raw `node:net` proof that two ready endpoints share a runtime, open an INC channel, notify only the survivor with canonical `inc.channel.closed` when A closes, and keep B usable for `inc.channel.list`.
- Added a stale endpoint-handle regression so a closed prior generation cannot remove a replacement registered with the same window ID.

## Verification

- `pnpm vitest run packages/shell-ipc/src/runtime-shell.test.ts packages/shell-ipc/src/ipc-shell.test.ts packages/runtime/src/runtime.test.ts tests/unit/nap-inc-conformance.test.ts --reporter=dot` — 51 passed.
- `pnpm --filter @kehto/shell-ipc build` — passed.
- `pnpm --filter @kehto/shell-ipc type-check` — passed.
- `pnpm test:unit` — 148 files / 1,758 tests passed.
- `pnpm build`, `pnpm type-check`, and `pnpm docs:check` — passed.
- `git diff --check` — passed; no runtime or browser-shell source changes.
- `npx --no-install aislop scan -d` — 97/100 due to two pre-existing narrative-comment warnings in untouched `packages/shell-ipc/src/json-sequence.ts`.

## NAP Conformance

Checked `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, specifically NAP-SHELL. Exact bare readiness, first-ready session creation, one `shell.init`, duplicate-ready idempotence, and host-assigned identity remain conformant. The IPC carrier and endpoint topology remain an intentional experimental specification gap: the pinned authority defines no IPC carrier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made concurrent endpoint and composition closure await the same lifecycle promise.**

- **Found during:** Task 108-03-02
- **Issue:** A second endpoint close could return before the first in-flight carrier cleanup completed; a registration could begin while composition shutdown was starting.
- **Fix:** Reuse the endpoint close promise and reject new registrations once composition shutdown begins.
- **Files modified:** `packages/shell-ipc/src/ipc-shell.ts`, `packages/shell-ipc/src/runtime-shell.test.ts`
- **Commit:** `ed0f741`

## Known Stubs

None.

## Self-Check: PASSED

- Verified all four owned source/test files and this summary exist.
- Verified task commits `19aaffe`, `09d9a14`, and `ed0f741` exist.
