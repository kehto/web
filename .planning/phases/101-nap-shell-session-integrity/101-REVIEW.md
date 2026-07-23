---
phase: 101-nap-shell-session-integrity
reviewed: 2026-07-23T14:43:03Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - apps/playground/src/demo-hooks.ts
  - apps/playground/src/shell-host.ts
  - packages/paja/src/browser-adapter.ts
  - packages/paja/src/browser-host.test.ts
  - packages/paja/src/browser-host.ts
  - packages/paja/src/browser-runtime-tabs.ts
  - packages/paja/src/browser-target-frame.ts
  - packages/paja/src/parity.test.ts
  - packages/paja/src/parity.ts
  - packages/runtime/src/dispatch.test.ts
  - packages/runtime/src/runtime.ts
  - packages/shell/README.md
  - packages/shell/src/index.ts
  - packages/shell/src/napplet-namespace.test.ts
  - packages/shell/src/napplet-namespace.ts
  - packages/shell/src/shell-bridge.test.ts
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
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 101: Code Review Report

**Reviewed:** 2026-07-23T14:43:03Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

The session-existence gate correctly makes pre-handshake envelopes inert, and the injected receiver is installed before it emits `shell.ready`. However, the new per-identity environment is only advisory: it is not attached to the session or enforced by runtime dispatch. This lets an iframe invoke a domain the host deliberately excluded. I checked the governing NAP-SHELL draft at `/Users/sandwich/Develop/naps/naps/NAP-SHELL.md`; it requires the delivered capability set to be authoritative and says the runtime must scope it per napplet.

Targeted unit tests passed: 147 tests across the shell, Paja, and runtime test files. They do not cover the authorization or lifecycle cases below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Per-identity capability narrowing does not authorize runtime dispatch

**Classification:** BLOCKER

**File:** `/Users/sandwich/Develop/kehto-napplet-scheme-conformance/packages/shell/src/shell-init.ts:46`

**Issue:** `resolveShellEnvironment()` narrows the domains and services delivered to a specific identity, and `handleShellReady()` sends that result in `shell.init` (`packages/shell/src/shell-ready.ts:54-57`). But the result is discarded immediately. Runtime dispatch checks only whether *any* session exists (`packages/runtime/src/runtime.ts:312`) and then dispatches all domains. An untrusted iframe does not need the injected namespace to send `{ type: 'relay.subscribe', ... }` (or any other excluded envelope) with `parent.postMessage`; once it has sent `shell.ready`, the runtime will service it if its ordinary ACL permits it. Thus `CapabilityHooks.resolveEnvironment` and disabled-domain simulations can claim a domain is unavailable while still granting it, violating NAP-SHELL's authoritative per-napplet capability environment and creating an authorization bypass for hosts that use this policy hook.

**Fix:** Persist the resolved immutable environment at the handshake transition, keyed by the same trusted source registration/session, and make the runtime ingress gate reject envelopes whose domain is absent before ACL/firewall/service dispatch. Do not recompute policy from untrusted-message handling. For example, introduce a host-owned session-environment registry and pass an `isDomainAllowed(windowId, domain)` predicate into `createRuntime`; after splitting `envelope.type`, return without dispatch when it is not allowed. Add an integration test that removes `relay` for one identity, completes `shell.ready`, manually posts `relay.subscribe`, and proves no handler/ACL/firewall path executes.

## Warnings

### WR-01: Bootstrap and actual `shell.init` can describe different environments

**Classification:** WARNING

**File:** `/Users/sandwich/Develop/kehto-napplet-scheme-conformance/packages/paja/src/browser-target-frame.ts:73`

**Issue:** `resolvePajaFrameEnvironment()` resolves the policy twice only to compare the two immediate results, then uses only `bootstrap` to inject namespaces (`:75-93`). The actual response to `shell.ready` calls `resolveShellEnvironment()` again later (`packages/shell/src/shell-ready.ts:54-56`). Dynamic policy is explicitly supported: playground's `disabledDomains` getter reads mutable service-toggle state (`apps/playground/src/demo-hooks.ts:283-287`), and `loadNapplet()` takes its snapshot before awaiting `beforeRender` (`apps/playground/src/shell-host.ts:451-504`). A toggle or policy change in that interval can produce an injected `window.napplet` surface that differs from `shell.supports()`/`services` after init. In particular, enabling a domain after bootstrap makes `supports(domain)` true without installing its namespace; disabling it leaves an installed namespace while `supports` returns false.

**Fix:** Resolve one environment when registering the frame, store that exact frozen snapshot with the registration, use it for both prelude injection and `shell.init`, and retire the double-resolution equality check. Add an integration test that mutates the disabled-domain source between prelude construction and `shell.ready` and asserts the received environment and injected namespace remain identical.

### WR-02: Module-global handshake guards break replacement ShellBridge lifecycles

**Classification:** WARNING

**File:** `/Users/sandwich/Develop/kehto-napplet-scheme-conformance/packages/shell/src/shell-ready.ts:23`

**Issue:** `initSent` and `sessionRegistration` are module-global, but the session registry belongs to each `createShellBridge()` runtime. If a host destroys/recreates a bridge while a registered iframe remains alive (for example during host reinitialization), the same source window and registration id hit the early return at `:47-49`. The new runtime never gets a session entry, and its ingress gate then drops every capability call (`packages/runtime/src/runtime.ts:312`). The test suite resets the global state between tests, which masks this real lifecycle boundary.

**Fix:** Make the exactly-once/session-registration state owned by a bridge/runtime instance (or clean it when that bridge is destroyed), rather than module scoped. Add a regression that completes `shell.ready` on bridge A, creates bridge B without re-registering the same iframe, delivers a duplicate ready, and verifies bridge B establishes the expected session and can handle a capability envelope.

---

_Reviewed: 2026-07-23T14:43:03Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
