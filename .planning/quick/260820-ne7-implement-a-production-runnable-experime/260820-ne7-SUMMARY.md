---
status: complete
quick_task: 260820-ne7
subsystem: shell-ipc
completed: 2026-08-20
commits:
  - 56f6415
  - 13c8da7
  - f59ec1d
  - fee2c37
  - e198318
  - 540e7d3
  - 2032e6e
  - fba8786
  - bf2beb2
  - 08318e1
---

# Runnable experimental IPC shell

`@kehto/shell-ipc` now ships the `launchIpcShellHost` process owner and the
`kehto-ipc-shell --host <esm-module> -- <executable> [...argv]` binary for the
experimental Unix-socket NIP-5D projection. The host owns one immutable
registration/projection/child lifecycle and all terminal paths join one deferred
cleanup promise.

## Delivered and verified

- `close()` and `waitForExit()` return the same promise identity and only settle
  after child classification plus projection, endpoint, timer, and listener cleanup.
- Peer disappearance waits for a bounded exit-settle interval, preserving numeric
  and independent child-signal outcomes; a live disconnected peer receives SIGTERM
  and escalates to SIGKILL/status 137 when it ignores that signal.
- The raw built-in-only child fixture proves one bare ready/init, correlated service
  result, eligible push, literal argv, environment minimization, self-signals, host
  signal forwarding, disconnect escalation, and base cleanup.
- Strict binary grammar covers help, missing/duplicate `--host`, missing delimiter
  or command, extra host flags, missing/malformed modules, and missing/throwing/
  async factories. Shell-owned usage/config/spawn diagnostics are fixed redacted
  categories; inherited child stdout/stderr remains deliberately unfiltered.
- Direct API tests cover frozen caller registration isolation, stale `KEHTO_IPC_*`
  scrubbing, exact terminal promise identity, listener restoration, spawn-failure
  cleanup, real endpoint cleanup, and independent child signal reasons.

NAP-SHELL and NAP-INC were rechecked at `napplet/naps`
`origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`: the required lifecycle
and host-bound identity gates are retained. IPC remains an intentional carrier spec
gap, with no browser carrier, interface injection, Tauri, Electron, postMessage, or
napplet-side helper added.

## Verification

- Focused projection/host/built-bin tests — 46 passed, repeated twice, including
  current ready-peer callback timing, pre-ready and host-close exclusions, and stale
  generation isolation.
- `pnpm --filter @kehto/shell-ipc type-check` — passed.
- `pnpm --filter @kehto/shell-ipc build` — passed.
- `pnpm --filter @kehto/shell-ipc test:unit` — 117 passed.
- `pnpm build` — passed (33 packages).
- `pnpm type-check` — passed.
- `pnpm test:unit` — 1,801 passed (150 files) on the branch merged with current `origin/main`.
- `CI=1 pnpm test:e2e` — 81 Playwright tests passed on the final exact tree.
- `pnpm docs:check` — passed (10 public package docs).
- `pnpm dlx aislop@0.12.0 scan --changes --base origin/main` — 100/100.
- `git diff --check` — passed.

## Deviations

- [Rule 1 - test reliability] Replaced a timing-only SIGTERM-ignore assertion with
  a child-created readiness milestone and gave the intentional built-bin build a
  20-second test timeout under parallel full-suite load (`bf2beb2`).

## Preserved state

The pre-existing root `package.json` modification was intentionally not staged or
committed.
