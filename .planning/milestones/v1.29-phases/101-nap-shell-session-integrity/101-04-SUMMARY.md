---
phase: 101-nap-shell-session-integrity
plan: 04
subsystem: paja-shell-session-integrity
tags: [paja, nap-shell, origin-identity, srcdoc, immutable-environment]
requires:
  - phase: 101-03
    provides: "A unary injected NAP-SHELL receiver and host-only resolveShellEnvironment API"
provides:
  - "Paja bootstrap and shell.init environments resolved from the same trusted frame identity"
  - "Source registration before executable srcdoc for single frames and runtime-pointer tabs"
  - "Receiver, unary support, services, and shell.init parity for live Paja domains"
affects: [paja-browser-host, paja-runtime-tabs, shell-ready]
tech-stack:
  added: []
  patterns: ["Resolve each host-to-frame environment from trusted creation identity", "Register iframe source before writing executable srcdoc", "Refresh Paja navigation after asynchronous live service wiring changes"]
key-files:
  created: []
  modified: [packages/paja/src/browser-target-frame.ts, packages/paja/src/parity.ts, packages/paja/src/parity.test.ts, packages/paja/src/browser-host.ts, packages/paja/src/browser-runtime-tabs.ts, packages/paja/src/browser-adapter.ts, packages/paja/src/browser-host.test.ts, tests/e2e/paja-single-window.spec.ts]
key-decisions:
  - "Paja passes the immutable frame OriginIdentity directly to the host-only resolver and compares snapshot contents rather than object identity."
  - "The origin registry is the sole Paja shell.ready identity source; the state-derived onNip5dIframeCreate fallback was removed."
  - "Asynchronously available Blossom upload wiring triggers a fresh Paja navigation so shell.init remains truthful."
metrics:
  duration: 9min
  completed: 2026-07-23
  tasks: 2
  files: 8
status: complete
---

# Phase 101 Plan 04: Paja Shell Session Integrity Summary

**Paja now registers each trusted iframe identity before srcdoc execution and builds matching, isolated NAP-SHELL bootstrap and init environments from live host wiring.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-23T14:13:00Z
- **Completed:** 2026-07-23T14:22:25Z
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- Added parity coverage for independently frozen bootstrap and shell.init snapshots, disabled/unwired domains, and no domain resurrection on repeated resolution.
- Removed manifest-requirement shaping from the injected Paja receiver surface; optional receivers now come only from the resolver's live, granted domain membership while mandatory `shell` remains injected separately.
- Registered the exact `contentWindow` and frozen creation identity before assigning `srcdoc`, including runtime-pointer tabs, and retained per-registration ready idempotency/reload invalidation.
- Removed Paja's state-derived identity callback so shell.ready resolves only from the trusted origin registry; added a post-signer refresh for live Blossom upload availability.
- Extended browser proof so a disabled `media` domain disappears consistently from the receiver, unary `shell.supports`, and delivered services.

## Task Commits

1. **Task 1: Make Paja parity consume one trusted, domain-only environment** — `daba002` (feat)
2. **Task 2: Preserve Paja source identity and environment integrity through ready and reload** — `8110a9b` (feat)

## Files Created/Modified

- `packages/paja/src/browser-target-frame.ts` — resolves and registers an immutable creation identity before srcdoc bootstrap.
- `packages/paja/src/parity.ts` and `packages/paja/src/parity.test.ts` — compare environment membership and isolation without object identity.
- `packages/paja/src/browser-host.ts` and `packages/paja/src/browser-runtime-tabs.ts` — set registered ownership before document execution and preserve reload lifecycles.
- `packages/paja/src/browser-adapter.ts` — removes the untrusted state-derived identity path and refreshes async upload wiring.
- `packages/paja/src/browser-host.test.ts` and `tests/e2e/paja-single-window.spec.ts` — cover registration ordering and receiver/supports/init membership parity.

## Decisions Made

- Paja's receiver and shell.init each call `resolveShellEnvironment` with the same trusted `OriginIdentity`; snapshots must have equal content while retaining independent frozen nested objects.
- Manifest requirements are never grant authority. A domain is injected only when it is live and granted by the host resolver.
- A Paja frame's shell.ready identity is taken from the origin registry, which was populated before any executable artifact or injected bootstrap is assigned to `srcdoc`.

## Verification

- PASS `pnpm exec vitest run packages/paja/src/parity.test.ts packages/paja/src/browser-host.test.ts` — 15 tests.
- PASS `pnpm exec playwright test tests/e2e/paja-single-window.spec.ts --workers=1` — 5 tests, using a local Chromium executable because the repository config is pinned to unavailable `/usr/bin/chromium` on this macOS host.
- PASS `pnpm type-check`.
- PASS `pnpm build`.
- PASS `pnpm test:unit` — 104 files / 1316 tests.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Security] Removed Paja's state-derived creation-identity fallback**
   - **Found during:** Task 2
   - **Issue:** `onNip5dIframeCreate` could derive identity from mutable browser state instead of the frame's registered trusted identity.
   - **Fix:** Removed the adapter callback so shell.ready uses the origin registry identity recorded before srcdoc execution.
   - **Files modified:** `packages/paja/src/browser-adapter.ts`
   - **Commit:** `8110a9b`

2. **[Rule 2 - Correctness] Rebuilt Paja after asynchronous Blossom service wiring becomes live**
   - **Found during:** Task 2 browser verification
   - **Issue:** A signer can make Blossom upload live after the first resolver snapshot; without a reload, the injected receiver would correctly remain absent but fail to reflect newly live host wiring.
   - **Fix:** Refresh the Paja frame after upload identity resolution completes.
   - **Files modified:** `packages/paja/src/browser-adapter.ts`, `packages/paja/src/browser-host.ts`
   - **Commit:** `8110a9b`

3. **[Rule 3 - Blocking] Updated runtime-pointer tab navigation for the new pre-srcdoc registration seam**
   - **Found during:** Task 2
   - **Issue:** Tab navigation shared the old load-event registration API, which would have re-registered the frame after srcdoc execution.
   - **Fix:** Routed tabs through the same pre-srcdoc registration callback as the single-frame host.
   - **Files modified:** `packages/paja/src/browser-runtime-tabs.ts`
   - **Commit:** `8110a9b`

## Issues Encountered

- `npx --no-install aislop scan -d` could not run because `aislop@0.13.1` is not installed in this worktree; the command correctly refused to download an unverified package.

## Self-Check: PASSED

- Confirmed all six planned Paja source/test artifacts exist.
- Confirmed task commits `daba002` and `8110a9b` are present in git history.
