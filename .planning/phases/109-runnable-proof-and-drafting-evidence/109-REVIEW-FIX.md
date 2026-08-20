---
phase: 109-runnable-proof-and-drafting-evidence
fixed_at: 2026-08-20T15:35:00Z
review_path: .planning/phases/109-runnable-proof-and-drafting-evidence/109-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 109: Code Review Fix Report

**Fixed at:** 2026-08-20T15:35:00Z
**Source review:** `.planning/phases/109-runnable-proof-and-drafting-evidence/109-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Documented standalone CLI command

**Files modified:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs`, `packages/shell-ipc/src/ipc-projection-process.test.ts`
**Commit:** bf53b84
**Applied fix:** The parser accepts `--mode` with optional `--base-dir` in either order and rejects duplicate or unknown arguments; tests execute the exact no-base-dir command.

### CR-02: Caller-owned base-directory deletion

**Files modified:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs`, `packages/shell-ipc/src/ipc-projection-process.test.ts`, `packages/shell-ipc/README.md`, `docs/packages/shell-ipc.md`
**Commit:** bf53b84
**Applied fix:** Only host-created temporary directories are recursively removed. Failure-path tests retain a caller sentinel and package docs state the ownership boundary.

### CR-03: Forged child transcript controls host proof

**Files modified:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs`, `packages/shell-ipc/src/ipc-projection-process.test.ts`, `packages/shell-ipc/tests/fixtures/adversarial-ipc-napplet.mjs`
**Commit:** bf53b84
**Applied fix:** Service dispatch/result and `sendToEligibleNapplet()` emit trusted host milestones; child stdout cannot invoke them. A forged child transcript fails the proof.

### CR-04: Literal route-cleanup evidence

**Files modified:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs`
**Commit:** bf53b84
**Applied fix:** After closing the endpoint, the host re-registers and closes the same window through the public composition API before reporting route absence.

### CR-05: Unawaited child transcript failure

**Files modified:** `packages/shell-ipc/examples/ipc-projection-reference-host.mjs`, `packages/shell-ipc/src/ipc-projection-process.test.ts`, `packages/shell-ipc/tests/fixtures/adversarial-ipc-napplet.mjs`
**Commit:** bf53b84
**Applied fix:** Parser failures reject an awaited promise, input is bounded before a newline, and `finally` terminates/reaps the exact child before closing the composition. Malformed, duplicate, unterminated, and oversize cases are covered.

### WR-01: Raw-child static boundary guard

**Files modified:** `packages/shell-ipc/src/ipc-projection-process.test.ts`
**Commit:** bf53b84
**Applied fix:** The guard requires the complete import list to equal `node:net` and rejects CommonJS, helper, package, and browser tokens.

## Verification

- `pnpm --filter @kehto/shell-ipc build` — passed.
- `pnpm vitest run packages/shell-ipc/src/ipc-projection-process.test.ts packages/shell-ipc/src/runtime-shell.test.ts --reporter=dot` — passed (21 tests).
- `pnpm --filter @kehto/shell-ipc type-check` — passed.
- `node --check` for both changed `.mjs` fixtures — passed.
- `pnpm docs:check` could not run in the isolated fixer worktree because its deliberately minimal dependency links omit unrelated workspace packages; the failure was missing-module/TypeDoc errors outside this change, not a documentation error.

---

_Fixed: 2026-08-20T15:35:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
