---
phase: 101-nap-shell-session-integrity
reviewed: 2026-07-23T15:17:06Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - apps/playground/src/demo-hooks.ts
  - apps/playground/src/shell-host.ts
  - packages/paja/src/browser-adapter.ts
  - packages/paja/src/browser-devtools.test.ts
  - packages/paja/src/browser-devtools.ts
  - packages/paja/src/browser-host.test.ts
  - packages/paja/src/browser-host.ts
  - packages/paja/src/browser-runtime-tabs.ts
  - packages/paja/src/browser-target-frame.ts
  - packages/paja/src/parity.test.ts
  - packages/paja/src/parity.ts
  - packages/runtime/src/dispatch.test.ts
  - packages/runtime/src/runtime.ts
  - packages/runtime/src/types.ts
  - packages/shell/README.md
  - packages/shell/src/index.ts
  - packages/shell/src/napplet-namespace.test.ts
  - packages/shell/src/napplet-namespace.ts
  - packages/shell/src/origin-registry.ts
  - packages/shell/src/shell-bridge.test.ts
  - packages/shell/src/shell-bridge.ts
  - packages/shell/src/shell-init.test.ts
  - packages/shell/src/shell-init.ts
  - packages/shell/src/shell-ready.ts
  - packages/shell/src/shell-supports-conformance.test.ts
  - packages/shell/src/types.ts
  - packages/shell/tests/no-window-nostr.test.ts
  - packages/shell/tests/perm-namespace.test.ts
  - tests/e2e/demo-service-toggle.spec.ts
  - tests/e2e/gateway-artifact-parity.spec.ts
  - tests/e2e/naps-path-conformance.spec.ts
  - tests/e2e/paja-single-window.spec.ts
  - tests/unit/nip5d-conformance-guard.test.ts
  - tests/unit/playground-gateway-guard.test.ts
  - tests/unit/playground-shell-host-proxy.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 101: Code Review Report

**Reviewed:** 2026-07-23T15:17:06Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** clean

## Summary

The earlier session-environment and bridge-state fixes remain sound: session-created capability environments are enforced before ACL, firewall, and dispatch; the same captured environment is used for namespace injection and `shell.init`; and handshake state is isolated to a bridge instance. The playground and Paja source-proxy adapters unwrap the captured environment lookup, while playground’s source-swap path restores its saved immutable snapshot before routing `shell.ready`.

The follow-up now canonicalizes both `notifications` and `notify` to one disabled-state key. Either input unregisters and restores both runtime service aliases, removes the native `notify` capability from newly created environments, persists canonical state, fail-closes required napplets, and preserves existing frame snapshots. The revised test uses a host page reload, so it creates a genuinely new iframe lifecycle rather than reusing an existing frame's frozen environment.

The playground build and all four focused service-toggle Playwright tests passed using the locally installed Google Chrome because the repository's `/usr/bin/chromium` path is unavailable on this macOS host.

## Narrative Findings (AI reviewer)

No narrative findings.

---

_Reviewed: 2026-07-23T15:17:06Z_
_Reviewer: gsd-code-reviewer with orchestrator follow-up verification_
_Depth: standard_
