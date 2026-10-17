---
phase: 113-service-authorization-boundaries
plan: 05
subsystem: filesystem authorization
tags: [nap-fs, firewall, paja, revocation]
dependency_graph:
  requires: [113-02]
  provides: [operation-scoped-fs-approval, revocable-private-picker-handles]
  affects: [services, paja]
tech_stack:
  added: []
  patterns: [immutable-path-requirements, source-generation-guards, request-owned-cancellation]
key_files:
  modified:
    - packages/services/src/fs-service.ts
    - packages/services/src/fs-service.test.ts
    - packages/paja/src/browser-fs.ts
    - packages/paja/src/browser-fs.test.ts
decisions:
  - Picker prompts use an opaque picker scope; picked paths require a separate exact or directory operation grant.
  - Permission revocation releases Paja's source-owned handles and service-owned watches before later callbacks can deliver.
metrics:
  tasks_completed: 2
status: complete
---

# Phase 113 Plan 05: Filesystem Authorization Boundaries Summary

NAP-FS picker mediation, virtual-path operations, Paja handles, and watches now remain behind separate, revocable Firewall approvals.

## Delivered

- Validates virtual paths before asking for approval or touching a backend, then composes interface access with operation-specific exact or directory requirements.
- Uses an opaque picker-only requirement for each chooser. A chosen browser handle remains host-private and source-owned; a following read requires a distinct exact path approval.
- Requires separate source and destination-parent scopes for moves, rejects traversal and prefix-shaped paths before policy evaluation, and forwards request cancellation to browser picker and byte read work.
- Closes watches and invalidates Paja picker mounts on permission revocation. Source replacement discards late operation results and watch changes without affecting another window.
- Added regressions for denied invalid paths, picker/read separation, forged cross-window picked paths, two-scope moves, pending read cancellation, revocation, and late watch output.

## Protocol Authority

Checked NAP-FS PR #88 at `bd1b9e912f05203bf38f7a1b04f920744fe6d625` and NIP-5D PR #2303 at `5560820fa4f37f45b8ab742a11aeb3001b17dc67`. The implementation preserves canonical NAP-FS result/error envelopes and keeps picker metadata advisory.

## Verification

- `pnpm exec vitest run packages/services/src/fs-service.test.ts packages/paja/src/browser-fs.test.ts packages/paja/src/browser-dm-fs.test.ts packages/services/src/dm-service.test.ts tests/unit/dm-nip17-nak.test.ts` — 5 files, 36 tests passed.
- `pnpm --filter @kehto/services build` — passed.
- `pnpm --filter @kehto/paja type-check` — passed after rebuilding services declarations.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Critical functionality] Extended the backend contract with request cancellation and permission-revocation hooks.**
   - Browser reads and picker completion now reject after the approved signal is revoked, and Paja clears private mounts on revocation.
   - This closes the late completion path that a service-only authorization wrapper could not contain.

## Self-Check: PASSED
