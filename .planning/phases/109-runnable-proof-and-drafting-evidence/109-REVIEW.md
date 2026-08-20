---
phase: 109-runnable-proof-and-drafting-evidence
reviewed: 2026-08-20T15:45:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - docs/packages/shell-ipc.md
  - packages/shell-ipc/README.md
  - packages/shell-ipc/examples/ipc-projection-reference-host.mjs
  - packages/shell-ipc/src/ipc-projection-process.test.ts
  - packages/shell-ipc/tests/fixtures/adversarial-ipc-napplet.mjs
  - packages/shell-ipc/tests/fixtures/raw-ipc-napplet.mjs
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 109: Code Review Report

**Reviewed:** 2026-08-20T15:45:00Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Resolution

CR-01 through CR-05 and WR-01 are closed: the reference host now accepts the documented `--mode` command with an optional
`--base-dir` in either flag order, rejects duplicate and unknown flags, and
never removes a caller-owned base directory. Its trusted transcript milestones
are produced by real service dispatch/result handling and the service-context
push path; raw child stdout is observational only. The process proof includes
forged, malformed, duplicate, unterminated, and oversize child-output cases
that require a nonzero host exit while preserving a caller sentinel and
projection cleanup.

Route cleanup is established through a public same-window endpoint
re-registration after close rather than a literal. The raw fixture guard now
requires exactly `node:net` and rejects CommonJS/helper/browser/package tokens.
Focused process/runtime lifecycle tests and both exact direct README commands
pass. One test-time deadline needs correction before shipping.

## Narrative Findings (AI reviewer)

## Warnings

### WR-02 [WARNING]: Valid process proofs have an unrealistically short CI deadline

**File:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs:199-203`

**Issue:** Every host launched by the Vitest suite sets `NODE_ENV=test`
([process test](../../../packages/shell-ipc/src/ipc-projection-process.test.ts)
lines 49-56), which changes the full valid-proof deadline from 10 seconds to
one second. That deadline includes spawning a Node process, loading the public
workspace build and runtime dependencies, creating a Unix socket, and completing
the complete request/result/push lifecycle. It passed locally, but is liable to
flake under cold or contended CI. The five hostile-child cases are the only
ones that need a short failure deadline.

**Fix:** Keep the normal proof timeout at the documented 10 seconds. Pass a
separate test-only short timeout only for adversarial fixtures (or fail those
cases promptly by racing the proof against an observed child exit), and add a
test option rather than deriving behavioral timing from the broad `NODE_ENV`.

_Reviewed: 2026-08-20T15:45:00Z_
_Reviewer: gsd-code-reviewer_
_Depth: deep_
