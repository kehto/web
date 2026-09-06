---
phase: 109-runnable-proof-and-drafting-evidence
plan: 02
subsystem: documentation
tags: [shell-ipc, posix, rfc-7464, nap-shell, nap-inc, vitepress]
requires:
  - phase: 109-01
    provides: Runnable host, raw Node peer, and process proof transcript
provides:
  - Host-facing composition guidance for @kehto/shell-ipc
  - Discoverable web/IPC parity matrix and experimental drafting record
affects: [packages/shell-ipc, docs, upstream-ipc-drafting]
tech-stack:
  added: []
  patterns: [pinned-NAP-authority, canonical-doc-route, explicit-security-boundary]
key-files:
  created:
    - docs/reference/experimental-ipc-projection.md
  modified:
    - packages/shell-ipc/README.md
    - docs/packages/shell-ipc.md
    - docs/.vitepress/config.ts
decisions:
  - "Pinned napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa is documented as carrier-neutral authority that defines no IPC carrier."
  - "Private path containment is explicitly documented as non-authentication; hostile same-UID resistance remains outside the projection threat model."
metrics:
  duration: 12m
  completed_date: 2026-08-20
  tasks_completed: 2
  files_changed: 4
status: complete
---

# Phase 109 Plan 02: IPC documentation and drafting evidence Summary

Published host-oriented IPC composition guidance and a navigable, non-normative web/POSIX IPC parity record tied to the runnable raw-process proof.

## Accomplishments

- Expanded the package README and package page from carrier-only guidance to the public `createIpcShellProjection()` composition API while retaining the transport API.
- Linked the actual standalone host, raw `node:net` napplet, and focused process proof, including reproducible graceful and forced-child commands.
- Made Node >=20, ESM-only, POSIX-only, experimental, unauthenticated, and hostile-same-UID exclusions prominent in both package documents.
- Added the canonical `/reference/experimental-ipc-projection` route to VitePress and linked it from both package documents.
- Recorded the exact upstream authority, a complete four-classification web/IPC responsibility matrix, bounded Kehto carrier choices, and unresolved upstream drafting questions.

## Verification

- `pnpm --filter @kehto/shell-ipc build` — passed.
- `pnpm --filter @kehto/shell-ipc type-check` — passed.
- `pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts --reporter=dot` — passed (1 file, 3 tests).
- `pnpm docs:check` — passed (TypeDoc, VitePress, and package documentation audit).
- Static authority/classification/canonical-route checks and `git diff --check` — passed.

## NAP Authority Check

Checked `napplet/naps origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`, directly reading NAP-SHELL and NAP-INC at that object. The result is conformant for the carrier-neutral handshake, identity, canonical-envelope, eligibility, and lifecycle claims recorded here. The upstream authority defines no IPC carrier; RFC 7464, pathname distribution, one-active-peer admission, terminal errors, finite limits, and local trust boundaries are intentionally documented as experimental Kehto choices and unresolved upstream specification questions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Documentation link] Corrected the generated TypeDoc media link to the canonical VitePress route.**
- **Found during:** Task 109-02-01 verification.
- **Issue:** The relative package-page reference was copied into `docs/api/media/shell-ipc.md` and resolved to a dead path during the VitePress build.
- **Fix:** Used `/reference/experimental-ipc-projection` as the canonical site route in both package documents.
- **Files modified:** `packages/shell-ipc/README.md`, `docs/packages/shell-ipc.md`.
- **Commit:** `06f71a9`.

## Known Stubs

None. The documentation uses no placeholder or unwired surface; browser injection, helpers, Windows, remote IPC, and brokered topology are explicit absences or unresolved questions, not stubs.

## Threat Flags

None. This plan adds documentation only and introduces no new network, authentication, file-access, or schema surface.

## Commits

- `06f71a9` — `docs(109-02): document IPC shell composition`
- `d30fde3` — `docs(109-02): add IPC projection drafting record`

## Self-Check: PASSED

- All four owned documentation files exist.
- Task commits `06f71a9` and `d30fde3` exist.
- The focused process, package build/type, and strict docs gates pass.
