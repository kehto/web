---
phase: 109-runnable-proof-and-drafting-evidence
reviewed: 2026-08-20T16:00:00Z
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
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 109: Code Review Report

**Reviewed:** 2026-08-20T16:00:00Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** clean

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
pass. Normal proof runs now preserve the ten-second deadline even when spawned
from the test process. An explicit test-only timeout is supplied only to hostile
fixtures, whose unterminated control output is verified to fail promptly.

_Reviewed: 2026-08-20T16:00:00Z_
_Reviewer: gsd-code-reviewer + gsd-code-fixer_
_Depth: deep_
