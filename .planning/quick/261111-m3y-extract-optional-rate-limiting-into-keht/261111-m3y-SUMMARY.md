---
phase: quick-261111-m3y
plan: 01
status: complete
subsystem: runtime
tags: [rate-limit, firewall, optional-policy]
completed: 2026-11-11
source_commit: 6744ace0
---

# Optional rate-limit extraction

Implemented independent `@kehto/rate-limit`. Runtime accepts optional structural
operation and prompt policies, constructs neither, and has no implementation
dependency on the new package. Both dispatch paths remain unthrottled by default.
Firewall exports approval policy only. Paja explicitly installs both limiters.
Legacy behavioral controls moved to `@kehto/rate-limit/legacy` and share the
canonical evaluator. Breaking migration, package metadata, docs and changesets
cover firewall, runtime, shell, Paja and the new package.

## Verification at source commit 6744ace0

- Build and type-check passed (20 tasks).
- Unit: 266 files, 3,368 tests passed.
- `KEHTO_HARNESS_PORT=43389 pnpm test:e2e`: 126 passed, one pre-existing skip.
- Strict TypeDoc and docs audit passed for 11 public packages.
- Frozen-lockfile install, changeset status, diff checks, package packing and
  built-package smoke passed.
- Runtime/shell emitted JavaScript and declarations have no limiter implementation
  imports. Runtime/shell manifests do not require the package outside test devDependencies.
- Lint command passed; no package lint tasks are configured.
- Pinned aislop 0.12.0: changed-file scan clean 100/100; full scan 100/100 with
  one unchanged baseline long-function warning. No rules changed.

Default-absence regressions failed before implementation at 20 storage operations
and eight prompts, then passed complete authorized sequences. Explicit operation
and prompt limits remain independently tested. Independent review found two
regressions: injected retirement callbacks interrupting cleanup and zero-capacity
legacy budgets throwing. Both were reproduced and fixed. New tests prove sibling
and service cleanup survives callback failure and zero budgets survive persistence.

## Protocol and remaining release work

Checked `napplet/naps@43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab`,
`naps/NAP-SHELL.md` and `projections/web.md` identity/trust. Host-policy extraction
is conformant to these checked boundaries; no wire or identity-authority changes.
Unrelated upstream optional-SHELL drift is outside this task.

npm Trusted Publisher and JSR registration for the new package remain unverified.
This task prepares a PR, not a registry release. Publishing remains CI-owned.

Graph Tier 2 discovery used project `kehto-optional-rate-limit`, generation
2026-11-11T14:55:09Z. Changed/new files and excluded tests/docs were inspected
directly after coverage checks reported stale or untracked metadata.
