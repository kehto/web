---
phase: 107-ipc-transport-foundation
plan: 01
subsystem: ipc-transport
tags: [node, unix-socket, rfc-7464, typescript, vitest]
requires: []
provides:
  - "Experimental @kehto/shell-ipc ESM package boundary"
  - "Host-bound private Unix-socket endpoint tracer"
  - "RFC 7464 ingress and ordered egress seams"
affects: [107-02, 107-03, 107-04, 107-05]
tech-stack:
  added: ["@types/node (dev type dependency)"]
  patterns: ["host registration clone/freeze before listener allocation", "one socket-owned RFC 7464 writer"]
key-files:
  created:
    - packages/shell-ipc/src/ipc-shell.ts
    - packages/shell-ipc/src/ipc-shell.test.ts
    - packages/shell-ipc/package.json
  modified:
    - pnpm-lock.yaml
key-decisions:
  - "Bind a recursively frozen host registration before creating a private socket directory or listener."
  - "Treat private pathname distribution as host-only routing information, not peer authentication."
  - "Keep transport framing and queue helpers internal behind an explicit ESM barrel."
patterns-established:
  - "Experimental transport callback path: bounded RFC 7464 decoder → peer-claim guard → host callback."
  - "Endpoint lifecycle owns its server, peer queues, socket path, and private directory."
requirements-completed: [BIND-01]
coverage:
  - id: D1
    description: "Raw local peer exchanges unchanged canonical envelopes through the production Unix-socket endpoint while host identity remains immutable."
    requirement: BIND-01
    verification:
      - kind: integration
        ref: "packages/shell-ipc/src/ipc-shell.test.ts#createIpcTransport carries an immutable host-bound envelope"
        status: pass
    human_judgment: false
  - id: D2
    description: "@kehto/shell-ipc builds as a Node >=20 ESM package with its explicit public declaration surface."
    requirement: BIND-01
    verification:
      - kind: unit
        ref: "pnpm --filter @kehto/shell-ipc build && pnpm --filter @kehto/shell-ipc type-check && pnpm --filter @kehto/shell-ipc test:unit"
        status: pass
    human_judgment: false
duration: 6m
completed: 2026-08-18
status: complete
---

# Phase 107 Plan 01: IPC Transport Tracer Summary

**An experimental Node/POSIX ESM package that carries one immutable host-bound canonical envelope through a private RFC 7464 Unix socket endpoint and back to the raw peer.**

## Performance

- **Duration:** 6m
- **Started:** 2026-08-18T16:07:29Z
- **Completed:** 2026-08-18T16:13:00Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

- Added `@kehto/shell-ipc` with a declaration-producing ESM build, Node >=20 floor, and public root barrel.
- Implemented the production tracer: a mode-0700 private socket directory, host registration cloning/freezing, RFC 7464 byte framing, and socket-owned FIFO egress.
- Added raw `node:net` integration coverage for split ingress, unchanged response framing, recursive identity immutability, and rejection of every peer binding claim.

## Task Commits

1. **Task 1: Carry one bound envelope through a real Unix socket in both directions** — `a0b7c32` (`feat`)
2. **Task 2: Establish the @kehto/shell-ipc ESM workspace boundary** — `36809c7` (`feat`)

## Files Created/Modified

- `packages/shell-ipc/src/ipc-shell.ts` — endpoint factory, frozen host binding, diagnostics, and lifecycle.
- `packages/shell-ipc/src/json-sequence.ts` — bounded RFC 7464 frame codec.
- `packages/shell-ipc/src/outbound-queue.ts` — one FIFO writer per accepted socket.
- `packages/shell-ipc/src/socket-directory.ts` — private owned directory/path lifecycle.
- `packages/shell-ipc/src/ipc-shell.test.ts` — raw Unix-socket BIND-01 tracer.
- `packages/shell-ipc/package.json`, `tsconfig.json`, `tsup.config.ts`, `src/index.ts`, `jsr.json` — publishable package boundary and explicit public API.
- `pnpm-lock.yaml` — shell-ipc importer and Node declaration type resolution.

## Decisions Made

- Clone and recursively freeze the complete registration before filesystem/listener creation, then bind all socket callbacks to that clone.
- Reject peer-owned top-level identity claims before callback dispatch; diagnostics retain registration identity but never the socket pathname.
- Mark the carrier as experimental projection policy against `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`; a private pathname is not cryptographic authentication.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the supported Vitest focused-test command**
- **Found during:** Task 1
- **Issue:** Vitest 4 rejects the plan's obsolete `-x` flag.
- **Fix:** Ran the equivalent focused test command without `-x`.
- **Verification:** `pnpm vitest run packages/shell-ipc/src/ipc-shell.test.ts` passed.
- **Committed in:** `a0b7c32`

**2. [Rule 1 - Bug] Corrected strict TypeScript narrowing in the codec**
- **Found during:** Task 2
- **Issue:** Declaration generation rejected an unassigned decoded string and an unsafe object property access.
- **Fix:** Initialized the decoded value and narrowed parsed JSON through a record before reading `type`.
- **Files modified:** `packages/shell-ipc/src/json-sequence.ts`
- **Verification:** package build and type-check passed.
- **Committed in:** `36809c7`

**3. [Rule 3 - Blocking] Added Node declaration types for the Node-only package**
- **Found during:** Task 2
- **Issue:** `node:net`, `node:os`, `Buffer`, and `structuredClone` could not be declared without a direct Node type dependency.
- **Fix:** Added dev-only `@types/node@^20.0.0`; pnpm regenerated peer-resolution metadata alongside the new importer.
- **Files modified:** `packages/shell-ipc/package.json`, `pnpm-lock.yaml`
- **Verification:** package build, type-check, focused test, and full unit suite passed.
- **Committed in:** `36809c7`

**4. [Rule 2 - Missing Critical] Added the required JSR package manifest**
- **Found during:** Task 2
- **Issue:** The repository-wide unit gate requires every public `@kehto/*` package to be release-workflow publishable.
- **Fix:** Added source-only `packages/shell-ipc/jsr.json` without introducing docs or a Changeset.
- **Verification:** `pnpm test:unit` passed all 1,679 tests.
- **Committed in:** `36809c7`

**Total deviations:** 4 auto-fixed (1 Rule 1, 1 Rule 2, 2 Rule 3).

## Verification Notes

- Passed: package build, package type-check, package focused test, and full `pnpm test:unit` (143 files / 1,679 tests).
- Unrun: local AI-slop gate; the `aislop` executable is not installed in this workspace.

## Known Stubs

None.

## Next Phase Readiness

Plans 107-02 through 107-05 can harden the established codec, socket-directory, queue, and public-contract seams without changing the package surface.

## Self-Check: PASSED

- Confirmed task commits `a0b7c32` and `36809c7` exist.
- Confirmed the package manifest, root barrel, tracer implementation, and integration test exist.
