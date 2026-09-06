---
phase: 86-nap-shell-handshake-correctness
plan: 01
subsystem: shell
tags: [nap-shell, handshake, shell.init, shell.ready, conformance, class]
requires:
  - "@kehto/shell shell-ready.ts handshake path"
provides:
  - "shell.init exactly-once-per-windowId guard (SHELL-01)"
  - "shell.init class wire type number|null (SHELL-02)"
affects:
  - "packages/shell/src/shell-ready.ts"
tech-stack:
  added: []
  patterns:
    - "module-scoped Set guard for exactly-once side effects (isolation via __resetInitSentForTests)"
    - "wire-boundary label→numeric mapping, internal label type preserved"
key-files:
  created:
    - ".changeset/nap-shell-handshake-correctness.md"
  modified:
    - "packages/shell/src/shell-ready.ts"
    - "packages/shell/src/shell-bridge.test.ts"
decisions:
  - "Used module-scoped initSent Set (not a SessionEntry field) because the no-identity path never registers an entry and @kehto/runtime SessionEntry must stay untouched; isolation via test-only reset hook."
  - "classToWireCode parses the trailing integer of 'class-N'; unrecognized non-null labels fail to null (permissive default) rather than emit a non-conformant value."
  - "Changeset scoped patch (not minor): wire value is a conformance correction no released shim relied on (shim 0.5.0 stores class opaquely; no test asserted a string class on the wire)."
metrics:
  duration: "~6m"
  completed: "2026-06-17"
  tasks: 3
  files: 3
---

# Phase 86 Plan 01: NAP-SHELL Handshake Correctness Summary

Two surgical NAP-SHELL conformance fixes in `shell-ready.ts`: `shell.init` is now sent exactly once per `windowId` (duplicate `shell.ready` is idempotent — no resend, no duplicate session), and the `shell.init` wire `class` field is emitted as `number | null` (opaque integer posture code) instead of the internal string label, with `enforce.ts`/ACL class logic left untouched.

## What Changed

- **SHELL-01 (`fix`, 8b109c5):** Added a module-scoped `initSent: Set<string>` in `shell-ready.ts`. `handleShellReady` now skips `postShellInit` (and the `buildShellCapabilities` work) when the `windowId` is already marked init-sent; `registerNip5dSessionIfNeeded` stays idempotent via its own early-return. Exported `__resetInitSentForTests` (`@internal`) for cross-test isolation. Regression test asserts exactly one `shell.init` across two `shell.ready` deliveries and that the session entry is not duplicated.
- **SHELL-02 (`feat`, aadd18b):** Added documented `classToWireCode(c: NappletClass): number | null` (`'class-1'→1`, `'class-2'→2`, `null→null`, unrecognized→`null`). `postShellInit` now emits `class: classToWireCode(resolvedClass)` and the payload type is `number | null`. Tests cover the null-class window (emits `null`) and a pre-seeded `'class-1'` window (emits numeric `1`).
- **Changeset (`feat`, de0bdc3):** `.changeset/nap-shell-handshake-correctness.md`, `@kehto/shell` `patch`, documenting both fixes and noting the internal label / `enforce.ts` logic are unchanged. No `@kehto/runtime` changeset.

## Verification Results

- `@kehto/shell` unit suite: **65 passed / 5 files** (includes the 3 new regression tests).
- `@kehto/runtime` unit suite: **153 passed / 13 files** (class mapping did not regress runtime).
- `pnpm type-check`: **13/13 tasks successful**.
- `pnpm build`: **24/24 tasks successful**.
- `git diff --stat packages/runtime/`: **empty** (types.ts + enforce.ts untouched).
- `grep "class:" packages/shell/src/*.test.ts`: no test asserts a string value on the `shell.init` wire `class` field.
- Playwright e2e: NOT run (deferred to phase close per instruction). No changes to capability payload shape, dual-emit, or napplet counts.

## Deviations from Plan

**Guard placement (refinement #1):** The plan-checker refinement preferred storing the "init already sent" flag on the session entry. That would require adding a field to `@kehto/runtime`'s `SessionEntry`, which the plan's hard constraints forbid (runtime must stay untouched; `git diff packages/runtime/` must be empty), and the no-NIP-5D-identity path never registers an entry at all. Per the refinement's explicit fallback ("If you must use a module Set, export a test-only reset and call it in the new test's `beforeEach`"), a module-scoped `Set` with `__resetInitSentForTests` wired into the describe blocks' `beforeEach`/`afterEach` was used. This matches the plan `<action>` (`contains: "initSent"`) and keeps runtime untouched. Tracked as `[Rule 3 - blocking constraint resolution]`.

Otherwise the plan executed as written, including refinement #2 (pre-seeding the `'class-1'` session entry before `shell.ready` so the wire code maps deterministically to `1`).

## Self-Check: PASSED
- FOUND: packages/shell/src/shell-ready.ts (initSent guard + classToWireCode)
- FOUND: packages/shell/src/shell-bridge.test.ts (3 new regression tests)
- FOUND: .changeset/nap-shell-handshake-correctness.md (@kehto/shell)
- FOUND commit 8b109c5 (SHELL-01)
- FOUND commit aadd18b (SHELL-02)
- FOUND commit de0bdc3 (changeset)
