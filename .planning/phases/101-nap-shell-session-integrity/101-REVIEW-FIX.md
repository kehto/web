---
phase: 101
fixed_at: 2026-07-23T14:50:51Z
review_path: /Users/sandwich/Develop/kehto-napplet-scheme-conformance/.planning/phases/101-nap-shell-session-integrity/101-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 101: Code Review Fix Report

**Fixed at:** 2026-07-23T14:50:51Z
**Source review:** `/Users/sandwich/Develop/kehto-napplet-scheme-conformance/.planning/phases/101-nap-shell-session-integrity/101-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: Per-identity capability narrowing does not authorize runtime dispatch

**Files modified:** `packages/runtime/src/types.ts`, `packages/runtime/src/runtime.ts`, `packages/runtime/src/dispatch.test.ts`, `packages/shell/src/shell-ready.ts`, `packages/shell/src/shell-bridge.ts`, `packages/shell/src/shell-bridge.test.ts`
**Commit:** ad00c3f
**Status:** fixed: requires human verification
**Applied fix:** The bridge now owns each handshake lifecycle and persists its immutable granted environment. Runtime ingress consults that environment before ACL, firewall, service routing, or domain dispatch. Regression coverage proves a manually posted excluded envelope stays inert.

### WR-01: Bootstrap and actual `shell.init` can describe different environments

**Files modified:** `packages/shell/src/types.ts`, `packages/shell/src/index.ts`, `packages/shell/src/shell-init.ts`, `packages/shell/src/origin-registry.ts`, `packages/shell/src/shell-ready.ts`, `packages/shell/src/shell-bridge.test.ts`, `packages/paja/src/browser-target-frame.ts`, `packages/paja/src/parity.test.ts`, `packages/paja/src/browser-host.test.ts`, `apps/playground/src/shell-host.ts`
**Commit:** 2bc14e6
**Applied fix:** Paja and playground capture one immutable environment before frame execution, attach it to the trusted registration, and reuse it at `shell.ready`. Tests cover mutable disabled-domain policy changes between prelude construction and handshake.

### WR-02: Module-global handshake guards break replacement ShellBridge lifecycles

**Files modified:** `packages/shell/src/shell-bridge.test.ts`
**Commit:** 38c7ab4
**Applied fix:** Added a replacement-bridge regression proving the per-bridge handshake state establishes the session and dispatches a capability after the same iframe delivers `shell.ready` to bridge B.

---

_Fixed: 2026-07-23T14:50:51Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
