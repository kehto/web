---
phase: 103-identity-and-theme-wire-parity
reviewed: 2026-07-23T22:24:55Z
depth: deep
files_reviewed: 25
files_reviewed_list:
  - apps/playground/napplets/preferences/src/main.ts
  - apps/playground/src/demo-hooks.ts
  - apps/playground/src/main-preferences.ts
  - apps/playground/src/main-signer.ts
  - apps/playground/src/main.ts
  - apps/playground/src/shell-host.ts
  - docs/packages/shell.md
  - packages/runtime/src/dispatch.test.ts
  - packages/runtime/src/domain-results.ts
  - packages/runtime/src/identity-handler.ts
  - packages/shell/README.md
  - packages/shell/src/identity-proxy.test.ts
  - packages/shell/src/identity-proxy.ts
  - packages/shell/src/napplet-namespace.test.ts
  - packages/shell/src/napplet-namespace.ts
  - packages/shell/src/shell-bridge.test.ts
  - packages/shell/src/shell-bridge.ts
  - packages/shell/src/theme-proxy.test.ts
  - packages/shell/src/theme-proxy.ts
  - tests/e2e/nap-identity.spec.ts
  - tests/e2e/paja-single-window.spec.ts
  - tests/e2e/theme-broadcast.spec.ts
  - tests/unit/identity-theme-conformance-guard.test.ts
  - tests/unit/main-signer-identity.test.ts
  - tests/unit/playground-gateway-guard.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 103: Code Review Re-review Report

**Reviewed:** 2026-07-23T22:24:55Z  
**Depth:** deep  
**Files Reviewed:** 25  
**Status:** clean

## Summary

Re-reviewed the remediation commits `34025ed`, `5d22df4`, `871a84d`, `dfc012f`, `1695c6e`, and `cc1909c` against the prior Phase 103 review and the draft protocol authority previously checked at `napplet/naps@896c32c92deee68dc4d10fc1132b62df20cccb6f` (`NAP-IDENTITY.md`, `NAP-THEME.md`, and `projections/web.md`).

All three prior critical findings are resolved:

- **CR-01:** the runtime defaults, handler fallback, and injected binding now cover all nine sanctioned identity reads; `getList` preserves its `listType` payload.
- **CR-02:** the `window.napplet` accessor is non-configurable, and the regression test covers descriptor replacement and deletion attempts.
- **CR-03:** persisted theme state is seeded into `ThemeService` before shell boot; the untrusted `shell.ready` listener and readiness/load broadcasts are removed; the theme E2E covers a forged readiness message and one real host mutation.

The newly fail-closed `IdentityProxy.emit()` and `ThemeProxy.emit()` paths no longer bypass `ShellBridge` recipient eligibility checks. Production search found no remaining caller of either direct emit path; their focused tests assert they fail closed. The bridge remains the sole shell-to-napplet delivery path and retains live-session, granted-domain, and current-ACL filtering.

Focused verification passed:

```text
pnpm exec vitest run packages/runtime/src/dispatch.test.ts \
  packages/shell/src/napplet-namespace.test.ts \
  packages/shell/src/identity-proxy.test.ts \
  packages/shell/src/theme-proxy.test.ts \
  packages/shell/src/shell-bridge.test.ts \
  tests/unit/identity-theme-conformance-guard.test.ts \
  tests/unit/playground-gateway-guard.test.ts
# 7 files, 183 tests passed
```

WR-01 is resolved by `5f15fe4`. The production helper now owns identity-transition deduplication, is called directly by the UI listener, and its unit regression covers an initial disconnected snapshot, connecting states, the first pubkey, repeated identical connected callbacks, a connecting repeat, and repeated sign-out. The production-preview E2E retains its separate normal-then-sign-out proof. This is a proportionate and stronger split than relying on a preview-only source import.

## Narrative Findings (AI reviewer)

No remaining Critical, Warning, or Info findings.

---

_Reviewed: 2026-07-23T22:24:55Z_  
_Reviewer: gsd-code-reviewer_  
_Depth: deep_
